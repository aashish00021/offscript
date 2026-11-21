import { z } from 'zod';

const id = z.string().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/);
const text = (max: number) => z.string().max(max);

export const LANGUAGES = [
  { code: 'en-IN', label: 'English' },
  { code: 'ml-IN', label: 'Malayalam (മലയാളം)' },
  { code: 'hi-IN', label: 'Hindi (हिन्दी)' },
  { code: 'ta-IN', label: 'Tamil (தமிழ்)' },
  { code: 'kn-IN', label: 'Kannada (ಕನ್ನಡ)' },
  { code: 'te-IN', label: 'Telugu (తెలుగు)' },
  { code: 'bn-IN', label: 'Bengali (বাংলা)' },
  { code: 'mr-IN', label: 'Marathi (मराठी)' },
  { code: 'gu-IN', label: 'Gujarati (ગુજરાતી)' },
  { code: 'pa-IN', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'od-IN', label: 'Odia (ଓଡ଼ିଆ)' },
] as const;
export const languageCode = z.enum(LANGUAGES.map((l) => l.code) as [string, ...string[]]);

export const intentionFields = z.object({
  needToSay: text(300),
  preferNotToAgree: text(300),
  couldOffer: text(300),
});

export const cueFields = z.object({
  mainPoint: text(300),
  opening: text(300),
  fallback: text(300),
});

const card = intentionFields.extend({ version: z.number().int().min(1).max(999) });

const turn = z.object({
  id,
  speaker: z.enum(['user', 'actor']),
  text: text(600),
});

export const actorRequest = z.object({
  requestId: id,
  scenarioId: id,
  language: languageCode,
  card,
  transcript: z.array(turn).min(1).max(13),
  reply: z.string().trim().min(1).max(600),
});
export type ActorRequest = z.infer<typeof actorRequest>;

export const actorOutput = z.object({ text: z.string().trim().min(1).max(600) });

export const coachRequest = z.object({
  requestId: id,
  scenarioId: id,
  language: languageCode,
  transcript: z.array(turn.extend({ cardVersion: z.number().int() })).min(1).max(13),
  cards: z.array(card).min(1).max(20),
});
export type CoachRequest = z.infer<typeof coachRequest>;

export const coachFinding = z.object({
  kind: z.enum(['observation', 'possible_change']),
  messageId: id,
  quote: z.string().min(1).max(400),
  note: z.string().max(400).optional(),
  field: z.enum(['needToSay', 'preferNotToAgree', 'couldOffer']).optional(),
  suggestion: z.string().max(400).optional(),
});
export type CoachFindingRaw = z.infer<typeof coachFinding>;
export const coachOutput = z.object({ finding: coachFinding.nullable() });

export const intentionSuggestRequest = z.object({
  requestId: id,
  scenarioId: id,
  language: languageCode,
  thoughts: z.string().trim().min(1).max(2000),
});
export type IntentionSuggestRequest = z.infer<typeof intentionSuggestRequest>;

export const cueSuggestRequest = z.object({
  requestId: id,
  scenarioId: id,
  language: languageCode,
  card,
  userReplies: z.array(text(600)).max(6),
});
export type CueSuggestRequest = z.infer<typeof cueSuggestRequest>;

export type ProviderName = 'mock' | 'sarvam';

export interface StatusResponse {
  mode: 'mock' | 'live' | 'unavailable';
  chat: { provider: ProviderName; model: string | null; reason: string | null };
  speech: { available: boolean; reason: string | null; sttModel: string | null; ttsModel: string | null };
}

export interface ApiError {
  error: string;
  message: string;
}
