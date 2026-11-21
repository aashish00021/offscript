import {
  EMPTY_SCENARIO,
  LIMITS,
  scenarioIsReady,
  type CueFields,
  type IntentionFields,
  type Message,
  type Phase,
  type Scenario,
  type Session,
} from './types';
import { childrenOf, descendToLeaf, intentionForNode, latestIntention, pathTo, userTurnCount } from './tree';

export function initialSession(epoch = 0, language = 'en-IN'): Session {
  return {
    epoch,
    phase: 'setup',
    scenario: EMPTY_SCENARIO,
    language,
    messyThoughts: '',
    intentionDraft: null,
    intentions: [],
    intentionAtNode: {},
    messages: {},
    rootId: null,
    activeLeafId: null,
    lastChild: {},
    pending: null,
    drafts: {},
    completedRequestIds: [],
    lastError: null,
    paused: false,
    cueDraft: null,
    cues: [],
  };
}

export type Action =
  | { type: 'SET_LANGUAGE'; language: string }
  | { type: 'SET_SCENARIO'; scenario: Scenario }
  | { type: 'SET_MESSY_THOUGHTS'; text: string }
  | { type: 'SET_INTENTION_DRAFT'; fields: IntentionFields | null }
  | { type: 'APPROVE_INTENTION'; id: string; fields: IntentionFields; now: number }
  | { type: 'START_PRACTICE'; openingId: string; openingLine: string; now: number }
  | { type: 'SET_DRAFT'; nodeId: string; text: string }
  | { type: 'SUBMIT_REPLY'; requestId: string; text: string; origin: 'typed' | 'speech' }
  | {
      type: 'ACTOR_RESPONSE';
      requestId: string;
      epoch: number;
      userMessageId: string;
      actorMessageId: string;
      text: string;
      now: number;
    }
  | { type: 'ACTOR_FAILED'; requestId: string; epoch: number; error: string }
  | { type: 'CANCEL_PENDING' }
  | { type: 'START_ALTERNATIVE'; checkpointId: string; draft?: string }
  | { type: 'SWITCH_TO'; nodeId: string }
  | { type: 'SET_PAUSED'; paused: boolean }
  | { type: 'GO_TO_PHASE'; phase: Exclude<Phase, 'setup'> }
  | { type: 'SET_CUE_DRAFT'; fields: CueFields | null }
  | { type: 'APPROVE_CUE'; id: string; fields: CueFields; now: number }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET' };

const clamp = (t: string, n: number) => t.trim().slice(0, n);

function cleanIntention(f: IntentionFields): IntentionFields {
  return {
    needToSay: clamp(f.needToSay, LIMITS.maxFieldChars),
    preferNotToAgree: clamp(f.preferNotToAgree, LIMITS.maxFieldChars),
    couldOffer: clamp(f.couldOffer, LIMITS.maxFieldChars),
  };
}

function sameIntention(a: IntentionFields, b: IntentionFields) {
  return a.needToSay === b.needToSay && a.preferNotToAgree === b.preferNotToAgree && a.couldOffer === b.couldOffer;
}

/** Why a reply can't be submitted from the active leaf right now, or null if it can. */
export function submitBlocker(s: Session): string | null {
  if (s.phase !== 'practice') return 'Practice has not started.';
  if (s.paused) return 'Paused.';
  if (s.pending) return 'Waiting for the counterpart to reply.';
  const leaf = s.activeLeafId ? s.messages[s.activeLeafId] : undefined;
  if (!leaf || leaf.speaker !== 'actor') return 'Waiting for the counterpart to reply.';
  if (userTurnCount(s, leaf.id) >= LIMITS.maxUserTurnsPerBranch)
    return `This practice is capped at ${LIMITS.maxUserTurnsPerBranch} replies per attempt. Try another reply at a checkpoint, or finish with your cue card.`;
  if (childrenOf(s, leaf.id).length >= LIMITS.maxAttemptsPerCheckpoint)
    return `This checkpoint already has ${LIMITS.maxAttemptsPerCheckpoint} attempts.`;
  return null;
}

export function reducer(s: Session, a: Action): Session {
  switch (a.type) {
    case 'SET_LANGUAGE':
      return s.phase === 'setup' ? { ...s, language: a.language } : s;

    case 'SET_SCENARIO': {
      if (s.phase !== 'setup') return s;
      const L = LIMITS.scenario;
      const sc = a.scenario;
      return {
        ...s,
        scenario: {
          title: sc.title.slice(0, L.title),
          counterpartName: sc.counterpartName.slice(0, L.counterpartName),
          counterpartRole: sc.counterpartRole.slice(0, L.counterpartRole),
          situation: sc.situation.slice(0, L.situation),
          openingLine: sc.openingLine.slice(0, L.openingLine),
          voice: sc.voice === 'shubh' ? 'shubh' : 'priya',
        },
      };
    }

    case 'SET_MESSY_THOUGHTS':
      return { ...s, messyThoughts: a.text.slice(0, LIMITS.maxThoughtsChars) };

    case 'SET_INTENTION_DRAFT':
      return { ...s, intentionDraft: a.fields };

    case 'APPROVE_INTENTION': {
      const fields = cleanIntention(a.fields);
      if (!fields.needToSay) return s;
      if (s.intentions.some((v) => v.id === a.id)) return s;
      const current = s.phase === 'setup' ? latestIntention(s) : intentionForNode(s, s.activeLeafId);
      if (current && sameIntention(current, fields)) return { ...s, intentionDraft: null };
      const version = { ...fields, id: a.id, version: s.intentions.length + 1, approvedAt: a.now };
      const next = { ...s, intentions: [...s.intentions, version], intentionDraft: null };
      if (s.phase !== 'setup' && s.activeLeafId) {
        next.intentionAtNode = { ...s.intentionAtNode, [s.activeLeafId]: a.id };
      }
      return next;
    }

    case 'START_PRACTICE': {
      const card = latestIntention(s);
      const openingLine = a.openingLine.trim().slice(0, LIMITS.maxMessageChars);
      if (s.phase !== 'setup' || !scenarioIsReady(s.scenario) || !card || !openingLine) return s;
      const root: Message = {
        id: a.openingId,
        parentId: null,
        speaker: 'actor',
        text: openingLine,
        intentionVersionId: card.id,
        createdAt: a.now,
        origin: 'scenario',
      };
      return { ...s, phase: 'practice', messages: { [root.id]: root }, rootId: root.id, activeLeafId: root.id };
    }

    case 'SET_DRAFT':
      return { ...s, drafts: { ...s.drafts, [a.nodeId]: a.text.slice(0, LIMITS.maxMessageChars) } };

    case 'SUBMIT_REPLY': {
      const text = a.text.trim();
      if (!text || text.length > LIMITS.maxMessageChars) return s;
      if (s.completedRequestIds.includes(a.requestId)) return s;
      if (submitBlocker(s)) return s;
      const parentId = s.activeLeafId!;
      return {
        ...s,
        pending: { requestId: a.requestId, parentId, text, origin: a.origin },
        drafts: { ...s.drafts, [parentId]: text },
        lastError: null,
      };
    }

    case 'ACTOR_RESPONSE': {
      const p = s.pending;
      if (a.epoch !== s.epoch || !p || p.requestId !== a.requestId) return s;
      const text = a.text.trim();
      if (!text || s.messages[a.userMessageId] || s.messages[a.actorMessageId]) return s;
      const card = intentionForNode(s, p.parentId);
      if (!card || !s.messages[p.parentId]) return { ...s, pending: null };
      const user: Message = {
        id: a.userMessageId,
        parentId: p.parentId,
        speaker: 'user',
        text: p.text,
        intentionVersionId: card.id,
        createdAt: a.now,
        origin: p.origin,
      };
      const actor: Message = {
        id: a.actorMessageId,
        parentId: user.id,
        speaker: 'actor',
        text: text.slice(0, LIMITS.maxMessageChars),
        intentionVersionId: card.id,
        createdAt: a.now + 1,
        origin: 'model',
      };
      const { [p.parentId]: _sent, ...drafts } = s.drafts;
      return {
        ...s,
        messages: { ...s.messages, [user.id]: user, [actor.id]: actor },
        lastChild: { ...s.lastChild, [p.parentId]: user.id, [user.id]: actor.id },
        activeLeafId: s.activeLeafId === p.parentId ? actor.id : s.activeLeafId,
        drafts,
        pending: null,
        completedRequestIds: [...s.completedRequestIds, a.requestId].slice(-100),
      };
    }

    case 'ACTOR_FAILED': {
      if (a.epoch !== s.epoch || s.pending?.requestId !== a.requestId) return s;
      return { ...s, pending: null, lastError: a.error };
    }

    case 'CANCEL_PENDING':
      return s.pending ? { ...s, pending: null } : s;

    case 'START_ALTERNATIVE': {
      const cp = s.messages[a.checkpointId];
      if (s.phase !== 'practice' || s.pending || !cp || cp.speaker !== 'actor') return s;
      const kids = childrenOf(s, cp.id);
      if (kids.length === 0 || kids.length >= LIMITS.maxAttemptsPerCheckpoint) return s;
      const drafts = a.draft !== undefined ? { ...s.drafts, [cp.id]: a.draft.slice(0, LIMITS.maxMessageChars) } : s.drafts;
      return { ...s, activeLeafId: cp.id, drafts };
    }

    case 'SWITCH_TO': {
      if (!s.messages[a.nodeId]) return s;
      const lastChild = { ...s.lastChild };
      for (const m of pathTo(s, a.nodeId)) if (m.parentId) lastChild[m.parentId] = m.id;
      const withPath = { ...s, lastChild };
      return { ...withPath, activeLeafId: descendToLeaf(withPath, a.nodeId) };
    }

    case 'SET_PAUSED':
      return { ...s, paused: a.paused };

    case 'GO_TO_PHASE':
      return s.rootId ? { ...s, phase: a.phase, paused: false } : s;

    case 'SET_CUE_DRAFT':
      return { ...s, cueDraft: a.fields };

    case 'APPROVE_CUE': {
      const card = intentionForNode(s, s.activeLeafId);
      const mainPoint = clamp(a.fields.mainPoint, LIMITS.maxFieldChars);
      if (!card || !mainPoint) return s;
      const cue = {
        id: a.id,
        version: s.cues.length + 1,
        approvedAt: a.now,
        intentionVersionId: card.id,
        mainPoint,
        opening: clamp(a.fields.opening, LIMITS.maxFieldChars),
        fallback: clamp(a.fields.fallback, LIMITS.maxFieldChars),
      };
      return { ...s, cues: [...s.cues, cue], cueDraft: null };
    }

    case 'CLEAR_ERROR':
      return { ...s, lastError: null };

    case 'RESET':
      return initialSession(s.epoch + 1, s.language);
  }
}
