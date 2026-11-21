import type { StatusResponse } from '../src/shared/api.js';
import { createSarvamChat, createSarvamSpeech } from './providers/sarvam.js';
import { ProviderError, type ChatProvider, type SpeechProvider } from './providers/types.js';

export interface Providers {
  chat: ChatProvider;
  speech: SpeechProvider | null;
  status: StatusResponse;
}

/**
 * Reads configuration from env. Never returns or logs the key itself.
 * There is no scripted fallback: without a key, every AI call fails with a clear error.
 */
export function providersFromEnv(env: NodeJS.ProcessEnv): Providers {
  const key = env.SARVAM_API_KEY?.trim() || '';
  const missingKey = 'SARVAM_API_KEY is not set on the server.';

  let chat: ChatProvider;
  if (key) {
    chat = createSarvamChat(
      key,
      env.SARVAM_ACTOR_MODEL || 'sarvam-105b-conversations',
      env.SARVAM_COACH_MODEL || 'sarvam-105b',
    );
  } else {
    const refuse = async (): Promise<never> => {
      throw new ProviderError('provider_unavailable', `${missingKey} Add it to .env and restart.`);
    };
    chat = {
      name: 'sarvam',
      model: null,
      actor: refuse,
      opening: refuse,
      coach: refuse,
      suggestIntention: refuse,
      suggestCue: refuse,
      drill: refuse,
    };
  }

  const speechWanted = env.SPEECH_ENABLED !== 'false';
  const speech =
    key && speechWanted
      ? createSarvamSpeech(
          key,
          env.SARVAM_STT_MODEL || 'saaras:v4',
          env.SARVAM_TTS_MODEL || 'bulbul:v3',
          env.SARVAM_TTS_SPEAKER || 'shubh',
        )
      : null;

  return {
    chat,
    speech,
    status: {
      mode: key ? 'live' : 'unavailable',
      chat: { provider: 'sarvam', model: chat.model, reason: key ? null : missingKey },
      speech: {
        available: !!speech,
        reason: speech ? null : key ? 'SPEECH_ENABLED=false on the server.' : missingKey,
        sttModel: speech?.sttModel ?? null,
        ttsModel: speech?.ttsModel ?? null,
      },
    },
  };
}
