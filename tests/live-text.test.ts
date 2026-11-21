import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyCoachFinding } from '../src/core/coach';
import { buildActorRequest, buildCoachRequest } from '../src/core/requests';
import { reducer } from '../src/core/session';
import { activePath } from '../src/core/tree';
import { createSarvamChat, stringFields } from '../server/providers/sarvam';
import { drillOutput } from '../src/shared/api';
import { ProviderError } from '../server/providers/types';
import { started, turn } from './helpers';

const KEY = 'unit-test-key';
const signal = new AbortController().signal;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => vi.unstubAllGlobals());

describe('live English text loop, without calling Sarvam', () => {
  it('keeps the original attempt, then accepts a quote and an approved cue', async () => {
    const seen: Array<{ model: string; messages: unknown; response_format?: unknown; reasoning_effort?: unknown }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        seen.push(body);
        const headers = new Headers(init.headers);
        expect(headers.get('api-subscription-key')).toBe(KEY);
        expect(headers.get('Authorization')).toBe(`Bearer ${KEY}`);
        expect(JSON.stringify(body)).not.toContain(KEY);
        if (body.model === 'sarvam-105b-conversations') {
          return jsonResponse({ choices: [{ message: { content: 'Who covers your part, then?' } }] });
        }
        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  finding: {
                    kind: 'observation',
                    messageId: 't2', // the model sees short ids; t2 is uB on this path
                    quote: "I'm not available this weekend.",
                    note: 'Your point is in this reply.',
                  },
                }),
              },
            },
          ],
        });
      }),
    );

    let s = turn(started(), 'Um, maybe Saturday morning.', 'So that is a yes?', { u: 'uA', a: 'aA', r: 'r1' });
    s = reducer(s, { type: 'START_ALTERNATIVE', checkpointId: 'root' });
    s = reducer(s, { type: 'SUBMIT_REPLY', requestId: 'live-1', text: "I'm not available this weekend.", origin: 'typed' });
    const chat = createSarvamChat(KEY, 'sarvam-105b-conversations', 'sarvam-105b');
    const actorReq = buildActorRequest(s, 'live-1', 'root', "I'm not available this weekend.");
    const reply = await chat.actor(actorReq, signal);
    expect(reply).toBe('Who covers your part, then?');
    expect(JSON.stringify(seen[0])).not.toContain('maybe Saturday');
    // The user-written situation reaches the model as data, not as instructions.
    const system = (seen[0].messages as Array<{ content: string }>)[0].content;
    expect(system).toMatch(/<data>\{"situation_title":"Saying no to weekend work","your_name":"Ravi"/);

    s = reducer(s, {
      type: 'ACTOR_RESPONSE',
      requestId: 'live-1',
      epoch: s.epoch,
      userMessageId: 'uB',
      actorMessageId: 'aB',
      text: reply,
      now: 50,
    });
    expect(activePath(s).map((m) => m.id)).toEqual(['root', 'uB', 'aB']);
    expect(s.messages.uA.text).toBe('Um, maybe Saturday morning.');

    s = reducer(s, { type: 'SWITCH_TO', nodeId: 'uA' });
    expect(activePath(s).map((m) => m.id)).toEqual(['root', 'uA', 'aA']);
    s = reducer(s, { type: 'SWITCH_TO', nodeId: 'uB' });

    const finding = await chat.coach(buildCoachRequest(s, 'coach-1'), signal);
    expect(seen[1]).toMatchObject({
      model: 'sarvam-105b',
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
    });
    const verified = verifyCoachFinding(s, finding);
    expect(verified?.quote).toBe("I'm not available this weekend.");
    expect(s.intentions).toHaveLength(1);

    s = reducer(s, {
      type: 'APPROVE_CUE',
      id: 'c1',
      fields: { mainPoint: "I'm not available this weekend.", opening: '', fallback: '' },
      now: 60,
    });
    expect(s.cues[0].mainPoint).toBe("I'm not available this weekend.");
    expect(seen[0]).toMatchObject({ model: 'sarvam-105b-conversations', temperature: 0.8 });
    expect(seen[0].reasoning_effort).toBeUndefined();
    expect(seen[0].response_format).toBeUndefined();
  });

  it('surfaces a provider failure and does not invent a reply', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: { message: 'nope' } }, 503)));
    const chat = createSarvamChat(KEY, 'sarvam-105b-conversations', 'sarvam-105b');
    const s = started();
    await expect(chat.actor(buildActorRequest(s, 'x', 'root', 'I need the weekend.'), signal)).rejects.toMatchObject({
      code: 'provider_failed',
    });
    const failed = reducer(reducer(s, { type: 'SUBMIT_REPLY', requestId: 'x', text: 'I need the weekend.', origin: 'typed' }), {
      type: 'ACTOR_FAILED',
      requestId: 'x',
      epoch: s.epoch,
      error: 'Provider returned HTTP 503.',
    });
    expect(failed.messages.root).toBeDefined();
    expect(Object.keys(failed.messages)).toEqual(['root']);
    expect(failed.drafts.root).toBe('I need the weekend.');
    try {
      await chat.actor(buildActorRequest(s, 'y', 'root', 'again'), signal);
    } catch (e) {
      expect(e).toBeInstanceOf(ProviderError);
      expect((e as Error).message).not.toContain(KEY);
    }
  });
});

describe('model output cleanup', () => {
  it('treats placeholder-only fields as empty so the server retries', () => {
    const f = stringFields('{"needToSay": "...", "preferNotToAgree": "…", "couldOffer": " I can help find a cab. "}', [
      'needToSay',
      'preferNotToAgree',
      'couldOffer',
    ]);
    expect(f).toEqual({ needToSay: '', preferNotToAgree: '', couldOffer: 'I can help find a cab.' });
    expect(stringFields('{"needToSay": "मुझे रविवार चाहिए"}', ['needToSay']).needToSay).toBe('मुझे रविवार चाहिए');
  });

  it('retries a placeholder card and returns the real one', async () => {
    const replies = [
      '{"needToSay": "...", "preferNotToAgree": "...", "couldOffer": "..."}',
      '{"needToSay": "I need Sunday to myself.", "preferNotToAgree": "", "couldOffer": ""}',
    ];
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ choices: [{ message: { content: replies.shift() } }] })));
    const chat = createSarvamChat(KEY, 'sarvam-105b-conversations', 'sarvam-105b');
    const f = await chat.suggestIntention({ requestId: 'i1', language: 'en-IN', thoughts: 'I need Sunday to myself.' }, signal);
    expect(f.needToSay).toBe('I need Sunday to myself.');
    expect(replies).toHaveLength(0);
  });
});

describe('drills', () => {
  const req = {
    requestId: 'd1',
    scenario: { title: 'Weekend work', counterpartName: 'Ravi', counterpartRole: 'my team lead', situation: 'He wants me this weekend.' },
    language: 'en-IN',
    card: { version: 1, needToSay: "I'm not available this weekend.", preferNotToAgree: 'Working Saturday', couldOffer: '' },
    theirLine: 'Saturday morning at least?',
    yourReply: 'I guess I could come in for a few hours.',
  };
  const opts = (holds: string) => ({
    options: [
      { kind: 'holds', text: holds, why: 'Keeps your point.' },
      { kind: 'concedes', text: 'Fine, Saturday morning.', why: 'Gives up Saturday.' },
      { kind: 'vague', text: "I'll see.", why: 'Leaves it open.' },
    ],
  });

  it('needs exactly one reply of each kind', () => {
    expect(drillOutput.safeParse(opts('No.').options).success).toBe(true);
    const twoHolds = [...opts('No.').options.slice(0, 2), { kind: 'holds', text: 'x', why: 'y' }];
    expect(drillOutput.safeParse(twoHolds).success).toBe(false);
  });

  it('retries when the model copies template slots, and returns the real drill', async () => {
    const replies = [JSON.stringify(opts('<reply>')), JSON.stringify(opts("I'm not available this weekend."))];
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ choices: [{ message: { content: replies.shift() } }] })));
    const chat = createSarvamChat(KEY, 'sarvam-105b-conversations', 'sarvam-105b');
    const out = await chat.drill(req, signal);
    expect(out.find((o) => o.kind === 'holds')?.text).toBe("I'm not available this weekend.");
    expect(replies).toHaveLength(0);
  });
});
