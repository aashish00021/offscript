import type { ActorRequest, CoachRequest, CueSuggestRequest, OpeningRequest, ScenarioPayload } from '../shared/api';
import { activeIntention, activePath, getIntention, intentionForNode, latestIntention, pathTo } from './tree';
import { scenarioIsReady, type IntentionVersion, type Scenario, type Session } from './types';

/** What the server needs to know about the situation. Opening line and voice stay client-side. */
export const scenarioPayload = (sc: Scenario): ScenarioPayload => ({
  title: sc.title.trim(),
  counterpartName: sc.counterpartName.trim(),
  counterpartRole: sc.counterpartRole.trim(),
  situation: sc.situation.trim(),
});

const cardPayload = (v: IntentionVersion) => ({
  version: v.version,
  needToSay: v.needToSay,
  preferNotToAgree: v.preferNotToAgree,
  couldOffer: v.couldOffer,
});

/**
 * Exact context for the actor: the root-to-parent prefix of ONE branch plus the
 * card that applies at that parent. Siblings and later messages are never read.
 */
export function buildActorRequest(s: Session, requestId: string, parentId: string, reply: string): ActorRequest {
  const card = intentionForNode(s, parentId);
  if (!card || !scenarioIsReady(s.scenario)) throw new Error('No approved card or scenario');
  return {
    requestId,
    scenario: scenarioPayload(s.scenario),
    language: s.language,
    card: cardPayload(card),
    transcript: pathTo(s, parentId).map((m) => ({ id: m.id, speaker: m.speaker, text: m.text })),
    reply,
  };
}

/** Asks for the counterpart's first line when the user left it blank. */
export function buildOpeningRequest(s: Session, requestId: string): OpeningRequest {
  const card = latestIntention(s);
  if (!card || !scenarioIsReady(s.scenario)) throw new Error('No approved card or scenario');
  return { requestId, scenario: scenarioPayload(s.scenario), language: s.language, card: cardPayload(card) };
}

export function buildCoachRequest(s: Session, requestId: string): CoachRequest {
  const path = activePath(s);
  const versions = new Map<string, IntentionVersion>();
  for (const m of path) {
    const v = getIntention(s, m.intentionVersionId);
    if (v) versions.set(v.id, v);
  }
  const current = activeIntention(s);
  if (current) versions.set(current.id, current);
  return {
    requestId,
    language: s.language,
    transcript: path.map((m) => ({
      id: m.id,
      speaker: m.speaker,
      text: m.text,
      cardVersion: getIntention(s, m.intentionVersionId)?.version ?? 0,
    })),
    cards: [...versions.values()].sort((a, b) => a.version - b.version).map(cardPayload),
  };
}

export function buildCueRequest(s: Session, requestId: string): CueSuggestRequest {
  const card = activeIntention(s);
  if (!card) throw new Error('No approved card');
  return {
    requestId,
    language: s.language,
    card: cardPayload(card),
    userReplies: activePath(s)
      .filter((m) => m.speaker === 'user')
      .map((m) => m.text)
      .slice(-6),
  };
}
