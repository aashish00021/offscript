import type { CueFields, IntentionFields } from '../../src/core/types.js';
import type {
  ActorRequest,
  CoachFindingRaw,
  CoachRequest,
  CueSuggestRequest,
  DrillOption,
  DrillRequest,
  IntentionSuggestRequest,
  OpeningRequest,
  ProviderName,
} from '../../src/shared/api.js';

export interface ChatProvider {
  name: ProviderName;
  model: string | null;
  actor(req: ActorRequest, signal: AbortSignal): Promise<string>;
  /** The counterpart's first line, for a situation whose opening the user left blank. */
  opening(req: OpeningRequest, signal: AbortSignal): Promise<string>;
  /** Read-only: receives a copy of the transcript and returns a proposal, nothing else. */
  coach(req: CoachRequest, signal: AbortSignal): Promise<CoachFindingRaw | null>;
  suggestIntention(req: IntentionSuggestRequest, signal: AbortSignal): Promise<IntentionFields>;
  suggestCue(req: CueSuggestRequest, signal: AbortSignal): Promise<CueFields>;
  /** Three replies for one moment: one keeps the point, one concedes, one is vague. */
  drill(req: DrillRequest, signal: AbortSignal): Promise<DrillOption[]>;
}

export interface SpeechProvider {
  sttModel: string;
  ttsModel: string;
  transcribe(audio: Buffer, mime: string, language: string, signal: AbortSignal): Promise<string>;
  speak(text: string, language: string, signal: AbortSignal, voice?: string): Promise<{ audioBase64: string; mime: string }>;
  /** MP3 bytes as they are synthesised, for playback that starts before synthesis finishes. */
  speakStream?(text: string, language: string, signal: AbortSignal, voice?: string): Promise<ReadableStream<Uint8Array>>;
}

export class ProviderError extends Error {
  constructor(
    public code: 'provider_unavailable' | 'provider_failed' | 'provider_bad_output' | 'empty_audio' | 'timeout',
    message: string,
  ) {
    super(message);
  }
}
