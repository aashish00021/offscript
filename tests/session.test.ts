import { describe, expect, it } from 'vitest';
import { verifyCoachFinding } from '../src/core/coach';
import { findInsertedCommitments } from '../src/core/cue';
import { buildActorRequest } from '../src/core/requests';
import { initialSession, reducer } from '../src/core/session';
import { activeIntention, activePath, childrenOf } from '../src/core/tree';
import { CARD_V1, apply, deepFreeze, started, turn } from './helpers';

const texts = (s: ReturnType<typeof started>) => activePath(s).map((m) => m.text);

describe('forks', () => {
  it('keeps the original attempt intact when an alternative is added', () => {
    let s = turn(started(), 'Maybe Saturday?', 'So that is a yes.', { u: 'uA', a: 'aA', r: 'r1' });
    s = turn(s, 'Actually no.', 'Hm.', { u: 'uA2', a: 'aA2', r: 'r2' });
    const before = structuredClone(s.messages);

    s = reducer(s, { type: 'START_ALTERNATIVE', checkpointId: 'root' });
    expect(s.activeLeafId).toBe('root');
    s = turn(s, "I'm not available this weekend.", 'Who covers it then?', { u: 'uB', a: 'aB', r: 'r3' });

    for (const [id, m] of Object.entries(before)) expect(s.messages[id]).toEqual(m);
    expect(childrenOf(s, 'root').map((m) => m.id)).toEqual(['uA', 'uB']);
    expect(texts(s)).toEqual(['Saturday works, right?', "I'm not available this weekend.", 'Who covers it then?']);
  });

  it('caps attempts per checkpoint', () => {
    let s = turn(started(), 'a', 'x');
    for (const t of ['b', 'c', 'd']) {
      s = reducer(s, { type: 'START_ALTERNATIVE', checkpointId: 'root' });
      s = turn(s, t, 'y');
    }
    expect(childrenOf(s, 'root')).toHaveLength(3);
  });
});

describe('actor context', () => {
  it('contains only the active prefix: no siblings, no future messages', () => {
    let s = turn(started(), 'Attempt A text', 'reply to A', { u: 'uA', a: 'aA', r: 'r1' });
    s = turn(s, 'A follow-up', 'later in A', { u: 'uA2', a: 'aA2', r: 'r2' });
    s = reducer(s, { type: 'START_ALTERNATIVE', checkpointId: 'root' });

    const req = buildActorRequest(s, 'rq', s.activeLeafId!, 'Attempt B text');
    expect(req.transcript.map((t) => t.id)).toEqual(['root']);
    const blob = JSON.stringify(req);
    for (const leaked of ['Attempt A text', 'reply to A', 'A follow-up', 'later in A']) expect(blob).not.toContain(leaked);

    const mid = buildActorRequest(s, 'rq2', 'aA', 'x');
    expect(mid.transcript.map((t) => t.id)).toEqual(['root', 'uA', 'aA']);
    expect(JSON.stringify(mid)).not.toContain('later in A');
  });
});

describe('intention versions', () => {
  it('branch switching restores the card version that applies on that branch', () => {
    let s = turn(started(), 'A reply', 'ok', { u: 'uA', a: 'aA', r: 'r1' });
    s = reducer(s, { type: 'START_ALTERNATIVE', checkpointId: 'root' });
    s = reducer(s, {
      type: 'APPROVE_INTENTION',
      id: 'v2',
      fields: { ...CARD_V1, couldOffer: 'Hand over notes by Friday evening.' },
      now: 10,
    });
    expect(activeIntention(s)?.version).toBe(2);
    s = turn(s, 'B reply', 'hmm', { u: 'uB', a: 'aB', r: 'r2' });
    expect(s.messages.uB.intentionVersionId).toBe('v2');

    s = reducer(s, { type: 'SWITCH_TO', nodeId: 'uA' });
    expect(s.activeLeafId).toBe('aA');
    expect(activeIntention(s)?.version).toBe(1);

    s = reducer(s, { type: 'SWITCH_TO', nodeId: 'uB' });
    expect(s.activeLeafId).toBe('aB');
    expect(activeIntention(s)?.version).toBe(2);
    expect(s.intentions.map((v) => v.version)).toEqual([1, 2]);
  });

  it('a proposed change (draft) never becomes approved without APPROVE_INTENTION', () => {
    let s = started();
    s = reducer(s, { type: 'SET_INTENTION_DRAFT', fields: { ...CARD_V1, preferNotToAgree: '' } });
    expect(s.intentions).toHaveLength(1);
    expect(activeIntention(s)?.preferNotToAgree).toBe(CARD_V1.preferNotToAgree);
    s = reducer(s, { type: 'APPROVE_INTENTION', id: 'v2', fields: s.intentionDraft!, now: 5 });
    expect(activeIntention(s)?.version).toBe(2);
    expect(s.intentionDraft).toBeNull();
  });

  it('rejects an approval with an empty main point and keeps earlier wording', () => {
    const s = reducer(started(), { type: 'APPROVE_INTENTION', id: 'v2', fields: { ...CARD_V1, needToSay: '  ' }, now: 5 });
    expect(s.intentions).toHaveLength(1);
    expect(s.intentions[0].needToSay).toBe(CARD_V1.needToSay);
  });
});

describe('coach', () => {
  it('cannot mutate approved state', () => {
    const s = deepFreeze(turn(started(), 'Fine, I can do Saturday morning.', 'Great.', { u: 'u1', a: 'a1', r: 'r1' }));
    const snapshot = structuredClone(s);
    const f = verifyCoachFinding(s, {
      kind: 'possible_change',
      messageId: 'u1',
      quote: 'I can do Saturday morning',
      field: 'preferNotToAgree',
    });
    expect(f?.question).toContain('Card v1');
    expect(f?.question).toContain('Is that an intentional change?');
    expect(s).toEqual(snapshot);
  });

  it('rejects invented or mismatched quotes', () => {
    let s = turn(started(), "I'm not available this weekend.", 'Who covers it?', { u: 'u1', a: 'a1', r: 'r1' });
    s = reducer(s, { type: 'START_ALTERNATIVE', checkpointId: 'root' });
    s = turn(s, 'Sure, Saturday is fine.', 'Great.', { u: 'u2', a: 'a2', r: 'r2' });
    const base = { kind: 'observation' as const, note: 'n' };

    expect(verifyCoachFinding(s, { ...base, messageId: 'u2', quote: 'I will work all weekend' })).toBeNull();
    expect(verifyCoachFinding(s, { ...base, messageId: 'u2', quote: 'not available this weekend' })).toBeNull();
    expect(verifyCoachFinding(s, { ...base, messageId: 'u1', quote: 'not available this weekend' })).toBeNull();
    expect(verifyCoachFinding(s, { ...base, messageId: 'a2', quote: 'Great' })).toBeNull();
    expect(verifyCoachFinding(s, { ...base, messageId: 'nope', quote: 'Sure' })).toBeNull();
    expect(verifyCoachFinding(s, { ...base, kind: 'possible_change', messageId: 'u2', quote: 'Saturday is fine' })).toBeNull();

    const ok = verifyCoachFinding(s, { ...base, messageId: 'u2', quote: 'saturday  is fine' });
    expect(ok?.quote).toBe('Saturday is fine');
  });

  it('labels the card version the message was sent under, and a newer one if present', () => {
    let s = turn(started(), 'Saturday is fine.', 'Great.', { u: 'u1', a: 'a1', r: 'r1' });
    s = reducer(s, { type: 'APPROVE_INTENTION', id: 'v2', fields: { ...CARD_V1, preferNotToAgree: 'Working Sunday.' }, now: 9 });
    const f = verifyCoachFinding(s, { kind: 'possible_change', messageId: 'u1', quote: 'Saturday is fine', field: 'preferNotToAgree' });
    expect(f?.cardVersion).toBe(1);
    expect(f?.newerCardVersion).toBe(2);
    expect(f?.question).toContain('says: “Working Saturday or Sunday”. Is that');
  });
});

describe('requests', () => {
  it('late responses land under the branch they were sent from', () => {
    let s = turn(started(), 'A', 'reply A', { u: 'uA', a: 'aA', r: 'r1' });
    s = reducer(s, { type: 'START_ALTERNATIVE', checkpointId: 'root' });
    s = turn(s, 'B', 'reply B', { u: 'uB', a: 'aB', r: 'r2' });
    s = reducer(s, { type: 'SWITCH_TO', nodeId: 'uA' });
    s = reducer(s, { type: 'SUBMIT_REPLY', requestId: 'late', text: 'A2', origin: 'typed' });
    s = reducer(s, { type: 'SWITCH_TO', nodeId: 'uB' });
    s = reducer(s, { type: 'ACTOR_RESPONSE', requestId: 'late', epoch: s.epoch, userMessageId: 'uA2', actorMessageId: 'aA2', text: 'reply A2', now: 99 });

    expect(s.messages.uA2.parentId).toBe('aA');
    expect(s.messages.aA2.parentId).toBe('uA2');
    expect(s.activeLeafId).toBe('aB');
    expect(texts(s)).not.toContain('A2');
  });

  it('drops responses after cancel, for unknown request IDs, and from before a reset', () => {
    let s = turn(started(), 'A', 'reply');
    const sent = reducer(s, { type: 'SUBMIT_REPLY', requestId: 'r', text: 'next', origin: 'typed' });
    const cancelled = reducer(sent, { type: 'CANCEL_PENDING' });
    const resp = { type: 'ACTOR_RESPONSE' as const, requestId: 'r', epoch: sent.epoch, userMessageId: 'x', actorMessageId: 'y', text: 'late', now: 5 };
    expect(reducer(cancelled, resp).messages.x).toBeUndefined();
    expect(cancelled.drafts[s.activeLeafId!]).toBe('next');

    expect(reducer(sent, { ...resp, requestId: 'other' }).messages.x).toBeUndefined();

    const reset = reducer(sent, { type: 'RESET' });
    const after = reducer(reset, { ...resp, epoch: sent.epoch });
    expect(after).toEqual(reset);
  });

  it('does not duplicate a double submit', () => {
    let s = started();
    s = reducer(s, { type: 'SUBMIT_REPLY', requestId: 'r1', text: 'hello', origin: 'typed' });
    const again = reducer(s, { type: 'SUBMIT_REPLY', requestId: 'r1', text: 'hello', origin: 'typed' });
    const other = reducer(s, { type: 'SUBMIT_REPLY', requestId: 'r2', text: 'hello', origin: 'typed' });
    expect(again).toBe(s);
    expect(other).toBe(s);

    const resp = { type: 'ACTOR_RESPONSE' as const, requestId: 'r1', epoch: s.epoch, userMessageId: 'u', actorMessageId: 'a', text: 'hi', now: 3 };
    s = reducer(s, resp);
    s = reducer(s, { ...resp, userMessageId: 'u-dup', actorMessageId: 'a-dup' });
    expect(Object.keys(s.messages).sort()).toEqual(['a', 'root', 'u']);
    expect(reducer(s, { type: 'SUBMIT_REPLY', requestId: 'r1', text: 'again', origin: 'typed' }).pending).toBeNull();
  });

  it('API failure preserves the draft and commits nothing', () => {
    let s = started();
    s = reducer(s, { type: 'SET_DRAFT', nodeId: 'root', text: 'my careful wording' });
    s = reducer(s, { type: 'SUBMIT_REPLY', requestId: 'r1', text: 'my careful wording', origin: 'typed' });
    s = reducer(s, { type: 'ACTOR_FAILED', requestId: 'r1', epoch: s.epoch, error: 'Network error' });
    expect(s.drafts.root).toBe('my careful wording');
    expect(s.pending).toBeNull();
    expect(s.lastError).toBe('Network error');
    expect(Object.keys(s.messages)).toEqual(['root']);
  });

  it('enforces the per-branch turn limit instead of compressing', () => {
    let s = started();
    for (let i = 0; i < 6; i++) s = turn(s, `t${i}`, `r${i}`);
    const blocked = reducer(s, { type: 'SUBMIT_REPLY', requestId: 'over', text: 'one more', origin: 'typed' });
    expect(blocked.pending).toBeNull();
    expect(activePath(s)).toHaveLength(13);
  });
});

describe('reset', () => {
  it('clears all app-controlled state and bumps the epoch', () => {
    let s = turn(started(), 'A', 'B');
    s = reducer(s, { type: 'APPROVE_CUE', id: 'c1', fields: { mainPoint: 'x', opening: 'y', fallback: '' }, now: 1 });
    const r = reducer(s, { type: 'RESET' });
    expect(r).toEqual(initialSession(s.epoch + 1, s.language));
  });
});

describe('cue card', () => {
  it('requires a main point and stores the approved wording verbatim (trimmed)', () => {
    let s = turn(started(), 'A', 'B');
    s = reducer(s, { type: 'APPROVE_CUE', id: 'c0', fields: { mainPoint: ' ', opening: 'x', fallback: '' }, now: 1 });
    expect(s.cues).toHaveLength(0);
    s = reducer(s, { type: 'APPROVE_CUE', id: 'c1', fields: { mainPoint: " I'm not available. ", opening: 'Hi', fallback: '' }, now: 1 });
    expect(s.cues[0]).toMatchObject({ mainPoint: "I'm not available.", version: 1, intentionVersionId: 'v1' });
  });

  it('flags promises the user never wrote', () => {
    const cue = { mainPoint: "I'm not available this weekend.", opening: "I promise I'll finish Friday.", fallback: '' };
    expect(findInsertedCommitments(cue, ["I'm not available this weekend."])).toEqual(['promise', "I'll"]);
    expect(findInsertedCommitments(cue, ["I promise I'll finish Friday."])).toEqual([]);
  });
});

describe('setup', () => {
  it('cannot start practice without an approved card', () => {
    const s = apply(initialSession(), { type: 'CHOOSE_SCENARIO', scenarioId: 'weekend-deadline' }, { type: 'START_PRACTICE', openingId: 'r', openingLine: 'x', now: 1 });
    expect(s.phase).toBe('setup');
  });
});
