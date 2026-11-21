import { reducer, initialSession, type Action } from '../src/core/session';
import type { IntentionFields, Scenario, Session } from '../src/core/types';

export const CARD_V1: IntentionFields = {
  needToSay: "I'm not available this weekend.",
  preferNotToAgree: 'Working Saturday or Sunday.',
  couldOffer: 'Stay late Thursday and Friday.',
};

export const SCENARIO: Scenario = {
  title: 'Saying no to weekend work',
  counterpartName: 'Ravi',
  counterpartRole: 'my team lead',
  situation: 'He wants me to work this weekend for a Monday client review.',
  openingLine: '',
  voice: 'shubh',
};

let n = 0;
export const uid = (p: string) => `${p}${++n}`;

export function apply(s: Session, ...actions: Action[]): Session {
  return actions.reduce(reducer, s);
}

/** Setup complete, practice started with the weekend scenario and card v1. */
export function started(): Session {
  return apply(
    initialSession(),
    { type: 'SET_SCENARIO', scenario: SCENARIO },
    { type: 'APPROVE_INTENTION', id: 'v1', fields: CARD_V1, now: 1 },
    { type: 'START_PRACTICE', openingId: 'root', openingLine: 'Saturday works, right?', now: 2 },
  );
}

/** Submit + respond in one go from the active leaf. */
export function turn(s: Session, text: string, reply: string, ids = { u: uid('u'), a: uid('a'), r: uid('r') }): Session {
  const sent = reducer(s, { type: 'SUBMIT_REPLY', requestId: ids.r, text, origin: 'typed' });
  return reducer(sent, {
    type: 'ACTOR_RESPONSE',
    requestId: ids.r,
    epoch: sent.epoch,
    userMessageId: ids.u,
    actorMessageId: ids.a,
    text: reply,
    now: Date.now() + n,
  });
}

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}
