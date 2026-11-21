import type {
  ActorRequest,
  CoachFindingRaw,
  CoachRequest,
  CueSuggestRequest,
  IntentionSuggestRequest,
  StatusResponse,
} from '../shared/api';
import type { CueFields, IntentionFields } from '../core/types';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const isAbort = (e: unknown) => (e as Error)?.name === 'AbortError';

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch (e) {
    if (isAbort(e)) throw e;
    throw new ApiError('network', 'Could not reach the local server.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error ?? 'http_error', body?.message ?? `Request failed (HTTP ${res.status}).`);
  }
  return body as T;
}

const postJson = <T>(path: string, body: unknown, signal?: AbortSignal) =>
  request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });

export const api = {
  status: () => request<StatusResponse>('/api/status', {}),
  actor: (b: ActorRequest, signal: AbortSignal) => postJson<{ requestId: string; text: string }>('/api/actor', b, signal),
  coach: (b: CoachRequest, signal: AbortSignal) =>
    postJson<{ finding: CoachFindingRaw | null }>('/api/coach', b, signal),
  suggestIntention: (b: IntentionSuggestRequest, signal: AbortSignal) =>
    postJson<{ fields: IntentionFields }>('/api/intention/suggest', b, signal),
  suggestCue: (b: CueSuggestRequest, signal: AbortSignal) => postJson<{ fields: CueFields }>('/api/cue/suggest', b, signal),
  transcribe: (audio: Blob, language: string, signal: AbortSignal) =>
    request<{ transcript: string }>(`/api/speech/transcribe?language=${encodeURIComponent(language)}`, {
      method: 'POST',
      headers: { 'Content-Type': audio.type || 'audio/webm' },
      body: audio,
      signal,
    }),
  speak: (text: string, language: string, signal: AbortSignal) =>
    postJson<{ audioBase64: string; mime: string }>('/api/speech/speak', { text, language }, signal),
};

export const newId = (prefix = '') => prefix + crypto.randomUUID();
