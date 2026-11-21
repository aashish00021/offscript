import type { StatusResponse } from '../src/shared/api';
import { createMockProvider } from './providers/mock';
import { createSarvamChat, createSarvamSpeech } from './providers/sarvam';
import { ProviderError, type ChatProvider, type SpeechProvider } from './providers/types';

export interface Providers {
  chat: ChatProvider;
  speech: SpeechProvider | null;
  status: StatusResponse;
}

/** Reads configuration from env. Never returns or logs the key itself. */
export function providersFromEnv(env: NodeJS.ProcessEnv): Providers {
  const key = env.SARVAM_API_KEY?.trim() || '';
  const wantLive = env.CHAT_PROVIDER === 'sarvam';
  const mockDelay = Number(env.MOCK_DELAY_MS ?? 600);

  const missingKey = 'CHAT_PROVIDER=sarvam but SARVAM_API_KEY is not set on the server.';
  let chat: ChatProvider;
  let chatReason: string | null = null;
  let mode: 'mock' | 'live' | 'unavailable';
  if (wantLive && key) {
    mode = 'live';
    chat = createSarvamChat(
      key,
      env.SARVAM_ACTOR_MODEL || 'sarvam-105b-conversations',
      env.SARVAM_COACH_MODEL || 'sarvam-105b',
    );
  } else if (wantLive) {
    mode = 'unavailable';
    chatReason = missingKey;
    const refuse = async () => {
      throw new ProviderError('provider_unavailable', missingKey + ' Demo replies are not used in its place.');
    };
    chat = { name: 'sarvam', model: null, actor: refuse, coach: refuse, suggestIntention: refuse, suggestCue: refuse };
  } else {
    mode = 'mock';
    chat = createMockProvider(mockDelay);
    chatReason = 'CHAT_PROVIDER is not set to sarvam.';
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
      mode,
      chat: { provider: chat.name, model: chat.model, reason: chatReason },
      speech: {
        available: !!speech,
        reason: speech ? null : key ? 'SPEECH_ENABLED=false on the server.' : 'SARVAM_API_KEY is not set on the server.',
        sttModel: speech?.sttModel ?? null,
        ttsModel: speech?.ttsModel ?? null,
      },
    },
  };
}
