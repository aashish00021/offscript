import type { ActorRequest, CoachRequest, CueSuggestRequest } from '../shared/api';
import { activeIntention, activePath, getIntention, intentionForNode, pathTo } from './tree';
import type { IntentionVersion, Session } from './types';

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
  if (!card || !s.scenarioId) throw new Error('No approved card or scenario');
  return {
    requestId,
    scenarioId: s.scenarioId,
    language: s.language,
    card: cardPayload(card),
    transcript: pathTo(s, parentId).map((m) => ({ id: m.id, speaker: m.speaker, text: m.text })),
    reply,
  };
}

export function buildCoachRequest(s: Session, requestId: string): CoachRequest {
  if (!s.scenarioId) throw new Error('No scenario');
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
    scenarioId: s.scenarioId,
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
  if (!card || !s.scenarioId) throw new Error('No approved card or scenario');
  return {
    requestId,
    scenarioId: s.scenarioId,
    language: s.language,
    card: cardPayload(card),
    userReplies: activePath(s)
      .filter((m) => m.speaker === 'user')
      .map((m) => m.text)
      .slice(-6),
  };
}
