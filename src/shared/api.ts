import { z } from 'zod';

const id = z.string().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/);
const text = (max: number) => z.string().max(max);

/**
 * Every language Sarvam's speech-to-text (saaras:v4) accepts: English plus the 22
 * scheduled Indian languages. `voice` marks the 11 that text-to-speech (bulbul:v3)
 * can also speak; in the others, replies are shown as text only.
 * Checked against docs.sarvam.ai on 2026-11-22.
 */
export const LANGUAGES = [
  { code: 'en-IN', label: 'English', voice: true },
  { code: 'hi-IN', label: 'Hindi (हिन्दी)', voice: true },
  { code: 'bn-IN', label: 'Bengali (বাংলা)', voice: true },
  { code: 'ta-IN', label: 'Tamil (தமிழ்)', voice: true },
  { code: 'te-IN', label: 'Telugu (తెలుగు)', voice: true },
  { code: 'mr-IN', label: 'Marathi (मराठी)', voice: true },
  { code: 'gu-IN', label: 'Gujarati (ગુજરાતી)', voice: true },
  { code: 'kn-IN', label: 'Kannada (ಕನ್ನಡ)', voice: true },
  { code: 'ml-IN', label: 'Malayalam (മലയാളം)', voice: true },
  { code: 'pa-IN', label: 'Punjabi (ਪੰਜਾਬੀ)', voice: true },
  { code: 'od-IN', label: 'Odia (ଓଡ଼ିଆ)', voice: true },
  { code: 'as-IN', label: 'Assamese (অসমীয়া)', voice: false },
  { code: 'ur-IN', label: 'Urdu (اردو)', voice: false },
  { code: 'ne-IN', label: 'Nepali (नेपाली)', voice: false },
  { code: 'kok-IN', label: 'Konkani (कोंकणी)', voice: false },
  { code: 'ks-IN', label: 'Kashmiri (کٲشُر)', voice: false },
  { code: 'sd-IN', label: 'Sindhi (سنڌي)', voice: false },
  { code: 'sa-IN', label: 'Sanskrit (संस्कृतम्)', voice: false },
  { code: 'sat-IN', label: 'Santali (ᱥᱟᱱᱛᱟᱲᱤ)', voice: false },
  { code: 'mni-IN', label: 'Manipuri (ꯃꯩꯇꯩꯂꯣꯟ)', voice: false },
  { code: 'brx-IN', label: 'Bodo (बड़ो)', voice: false },
  { code: 'mai-IN', label: 'Maithili (मैथिली)', voice: false },
  { code: 'doi-IN', label: 'Dogri (डोगरी)', voice: false },
] as const;
export const languageCode = z.enum(LANGUAGES.map((l) => l.code) as [string, ...string[]]);
/** Languages the counterpart's replies can be spoken in. */
export const voiceLanguageCode = z.enum(LANGUAGES.filter((l) => l.voice).map((l) => l.code) as [string, ...string[]]);
export const speaksLanguage = (code: string) => LANGUAGES.some((l) => l.code === code && l.voice);

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

const req = (max: number) => z.string().trim().min(1).max(max);
/** The user-written situation, as sent to the server. The opening line and voice stay in the browser. */
export const scenarioPayload = z.object({
  title: req(120),
  counterpartName: req(60),
  counterpartRole: req(200),
  situation: req(600),
});
export type ScenarioPayload = z.infer<typeof scenarioPayload>;

const turn = z.object({
  id,
  speaker: z.enum(['user', 'actor']),
  text: text(600),
});

export const actorRequest = z.object({
  requestId: id,
  scenario: scenarioPayload,
  language: languageCode,
  card,
  transcript: z.array(turn).min(1).max(13),
  reply: z.string().trim().min(1).max(600),
});
export type ActorRequest = z.infer<typeof actorRequest>;

export const actorOutput = z.object({ text: z.string().trim().min(1).max(600) });

/** The counterpart's first line, when the user left it blank. */
export const openingRequest = z.object({
  requestId: id,
  scenario: scenarioPayload,
  language: languageCode,
  card,
});
export type OpeningRequest = z.infer<typeof openingRequest>;

/** A practice drill for one moment: what they said, and the reply the user gave. */
export const drillRequest = z.object({
  requestId: id,
  scenario: scenarioPayload,
  language: languageCode,
  card,
  theirLine: z.string().trim().min(1).max(600),
  yourReply: z.string().trim().min(1).max(600),
});
export type DrillRequest = z.infer<typeof drillRequest>;

export const drillKinds = ['holds', 'concedes', 'vague'] as const;
export const drillOption = z.object({
  kind: z.enum(drillKinds),
  text: z.string().trim().min(1).max(300),
  why: z.string().trim().min(1).max(300),
});
export type DrillOption = z.infer<typeof drillOption>;
/** Exactly one option of each kind, so there is always one reply that keeps the point. */
export const drillOutput = z
  .array(drillOption)
  .length(3)
  .refine((opts) => drillKinds.every((k) => opts.filter((o) => o.kind === k).length === 1), 'one option of each kind');

export const coachRequest = z.object({
  requestId: id,
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
  language: languageCode,
  thoughts: z.string().trim().min(1).max(2000),
});
export type IntentionSuggestRequest = z.infer<typeof intentionSuggestRequest>;

export const cueSuggestRequest = z.object({
  requestId: id,
  language: languageCode,
  card,
  userReplies: z.array(text(600)).max(6),
});
export type CueSuggestRequest = z.infer<typeof cueSuggestRequest>;

export type ProviderName = 'sarvam';

export interface StatusResponse {
  mode: 'live' | 'unavailable';
  chat: { provider: ProviderName; model: string | null; reason: string | null };
  speech: { available: boolean; reason: string | null; sttModel: string | null; ttsModel: string | null };
}

export interface ApiError {
  error: string;
  message: string;
}
