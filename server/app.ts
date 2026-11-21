import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import {
  actorOutput,
  actorRequest,
  coachRequest,
  cueSuggestRequest,
  intentionSuggestRequest,
  languageCode,
} from '../src/shared/api';
import type { Providers } from './config';
import { ProviderError } from './providers/types';

/** Remembers in-flight/recent results per requestId so a duplicate submit runs the provider once. */
class Idempotency {
  private map = new Map<string, { kind: string; at: number; result: Promise<unknown> }>();
  run<T>(kind: string, requestId: string, fn: () => Promise<T>): Promise<T> | 'conflict' {
    const now = Date.now();
    for (const [k, v] of this.map) if (now - v.at > 120_000) this.map.delete(k);
    const hit = this.map.get(requestId);
    if (hit) return hit.kind === kind ? (hit.result as Promise<T>) : 'conflict';
    const result = fn();
    this.map.set(requestId, { kind, at: now, result });
    result.catch(() => this.map.delete(requestId));
    if (this.map.size > 500) this.map.delete(this.map.keys().next().value!);
    return result;
  }
}

function sendError(res: Response, status: number, error: string, message: string) {
  res.status(status).json({ error, message });
}

function handleProviderError(res: Response, e: unknown) {
  if (e instanceof ProviderError) {
    const status = e.code === 'empty_audio' ? 422 : e.code === 'timeout' ? 504 : e.code === 'provider_unavailable' ? 503 : 502;
    return sendError(res, status, e.code, e.message);
  }
  if ((e as Error)?.message === 'aborted') return sendError(res, 499, 'cancelled', 'Request cancelled.');
  return sendError(res, 500, 'internal', 'Something went wrong on the server.');
}

/** Abort provider work when the browser disconnects (cancel button, tab closed). */
function abortOnClose(req: Request, res: Response): AbortSignal {
  const ctrl = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) ctrl.abort();
  });
  req.on('aborted', () => ctrl.abort());
  return ctrl.signal;
}

export function createApp(providers: Providers, opts: { log?: (line: string) => void } = {}) {
  const app = express();
  const idem = new Idempotency();
  const log = opts.log ?? (() => {});

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const start = Date.now();
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    // Metadata only: never request or response bodies.
    res.on('finish', () => {
      if (req.path.startsWith('/api/')) log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });

  app.get('/api/status', (_req, res) => res.json(providers.status));

  function jsonRoute<S extends z.ZodTypeAny>(
    path: string,
    schema: S,
    fn: (body: z.infer<S>, signal: AbortSignal) => Promise<unknown>,
  ) {
    app.post(path, express.json({ limit: '64kb' }), async (req, res) => {
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return sendError(res, 400, 'invalid_request', 'Request did not match the expected shape.');
      const signal = abortOnClose(req, res);
      const run = idem.run(path, parsed.data.requestId, () => fn(parsed.data, signal));
      if (run === 'conflict') return sendError(res, 409, 'duplicate_request_id', 'Request ID reused for a different call.');
      try {
        const result = await run;
        if (!res.headersSent) res.json({ requestId: parsed.data.requestId, provider: providers.chat.name, ...result as object });
      } catch (e) {
        if (!res.headersSent) handleProviderError(res, e);
      }
    });
  }

  jsonRoute('/api/actor', actorRequest, async (body, signal) => {
    const out = actorOutput.safeParse({ text: await providers.chat.actor(body, signal) });
    if (!out.success) throw new ProviderError('provider_bad_output', 'Counterpart reply was empty or too long.');
    return out.data;
  });
  jsonRoute('/api/coach', coachRequest, async (body, signal) => ({
    finding: await providers.chat.coach(structuredClone(body), signal),
  }));
  jsonRoute('/api/intention/suggest', intentionSuggestRequest, async (body, signal) => ({
    fields: await providers.chat.suggestIntention(body, signal),
  }));
  jsonRoute('/api/cue/suggest', cueSuggestRequest, async (body, signal) => ({
    fields: await providers.chat.suggestCue(body, signal),
  }));

  const speechOff = (res: Response) =>
    sendError(res, 503, 'speech_unavailable', providers.status.speech.reason ?? 'Speech is unavailable.');

  app.post(
    '/api/speech/transcribe',
    express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '2mb' }),
    async (req, res) => {
      if (!providers.speech) return speechOff(res);
      const lang = languageCode.safeParse(req.query.language);
      if (!lang.success) return sendError(res, 400, 'unsupported_language', 'That language is not supported for speech.');
      const audio = req.body;
      if (!Buffer.isBuffer(audio) || audio.length < 1000)
        return sendError(res, 422, 'empty_audio', 'That clip was empty or too short. Try again, or type instead.');
      try {
        const transcript = await providers.speech.transcribe(
          audio,
          String(req.headers['content-type'] ?? 'audio/webm'),
          lang.data,
          abortOnClose(req, res),
        );
        res.json({ transcript });
      } catch (e) {
        handleProviderError(res, e);
      }
    },
  );

  app.post('/api/speech/speak', express.json({ limit: '8kb' }), async (req, res) => {
    if (!providers.speech) return speechOff(res);
    const parsed = z.object({ text: z.string().trim().min(1).max(600), language: languageCode }).safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, 'invalid_request', 'Request did not match the expected shape.');
    try {
      res.json(await providers.speech.speak(parsed.data.text, parsed.data.language, abortOnClose(req, res)));
    } catch (e) {
      handleProviderError(res, e);
    }
  });

  app.use('/api', (_req, res) => sendError(res, 404, 'not_found', 'Unknown endpoint.'));
  return app;
}
