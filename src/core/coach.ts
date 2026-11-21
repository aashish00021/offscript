import type { CoachFindingRaw } from '../shared/api';
import { activeIntention, activePath, getIntention } from './tree';
import type { IntentionFields, Message, Session } from './types';

export const FIELD_LABELS: Record<keyof IntentionFields, string> = {
  needToSay: 'What I need to say',
  preferNotToAgree: "What I'd prefer not to agree to",
  couldOffer: 'What I could offer',
};

export interface VerifiedFinding {
  kind: 'observation' | 'possible_change';
  message: Message;
  /** Exact text taken from the referenced message, never from the model. */
  quote: string;
  note: string;
  question: string | null;
  suggestion: string | null;
  cardVersion: number;
  newerCardVersion: number | null;
}

const collapse = (t: string) => t.replace(/\s+/g, ' ').trim();

/** Locate `quote` inside `text`; returns the slice of the original text, or null. */
export function findQuote(text: string, quote: string): string | null {
  const hay = collapse(text);
  const needle = collapse(quote).replace(/^["'“”‘’]+|["'“”‘’]+$/g, '');
  if (needle.length < 3) return null;
  const exact = hay.indexOf(needle);
  if (exact >= 0) return hay.slice(exact, exact + needle.length);
  const lower = hay.toLowerCase();
  if (lower.length !== hay.length) return null;
  const i = lower.indexOf(needle.toLowerCase());
  return i >= 0 ? hay.slice(i, i + needle.length) : null;
}

/**
 * Checks a model-proposed finding against the transcript the code owns.
 * Returns null (show no finding) if anything is ungrounded. Never mutates the session.
 */
export function verifyCoachFinding(s: Session, raw: CoachFindingRaw | null): VerifiedFinding | null {
  if (!raw) return null;
  const message = activePath(s).find((m) => m.id === raw.messageId);
  if (!message || message.speaker !== 'user') return null;
  const quote = findQuote(message.text, raw.quote);
  if (!quote) return null;
  const card = getIntention(s, message.intentionVersionId);
  if (!card) return null;
  const current = activeIntention(s);
  const newerCardVersion = current && current.version !== card.version ? current.version : null;

  let question: string | null = null;
  if (raw.kind === 'possible_change') {
    const value = raw.field ? card[raw.field].trim().replace(/[.!?]+$/, '') : '';
    if (!raw.field || !value) return null;
    question =
      `You said “${quote}” here. Card v${card.version}, under “${FIELD_LABELS[raw.field]}”, says: “${value}”. ` +
      'Is that an intentional change?';
  }
  return {
    kind: raw.kind,
    message,
    quote,
    note: collapse(raw.note ?? '').slice(0, 280),
    question,
    suggestion: raw.suggestion ? collapse(raw.suggestion).slice(0, 300) || null : null,
    cardVersion: card.version,
    newerCardVersion,
  };
}
