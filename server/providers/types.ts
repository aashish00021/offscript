import type { CueFields, IntentionFields } from '../../src/core/types';
import type {
  ActorRequest,
  CoachFindingRaw,
  CoachRequest,
  CueSuggestRequest,
  IntentionSuggestRequest,
  ProviderName,
} from '../../src/shared/api';

export interface ChatProvider {
  name: ProviderName;
  model: string | null;
  actor(req: ActorRequest, signal: AbortSignal): Promise<string>;
  /** Read-only: receives a copy of the transcript and returns a proposal, nothing else. */
  coach(req: CoachRequest, signal: AbortSignal): Promise<CoachFindingRaw | null>;
  suggestIntention(req: IntentionSuggestRequest, signal: AbortSignal): Promise<IntentionFields>;
  suggestCue(req: CueSuggestRequest, signal: AbortSignal): Promise<CueFields>;
}

export interface SpeechProvider {
  sttModel: string;
  ttsModel: string;
  transcribe(audio: Buffer, mime: string, language: string, signal: AbortSignal): Promise<string>;
  speak(text: string, language: string, signal: AbortSignal): Promise<{ audioBase64: string; mime: string }>;
}

export class ProviderError extends Error {
  constructor(
    public code: 'provider_unavailable' | 'provider_failed' | 'provider_bad_output' | 'empty_audio' | 'timeout',
    message: string,
  ) {
    super(message);
  }
}
