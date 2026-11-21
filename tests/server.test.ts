import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../server/app';
import { providersFromEnv } from '../server/config';
import { createMockProvider } from '../server/providers/mock';
import type { ChatProvider } from '../server/providers/types';

const actorBody = (requestId: string) => ({
  requestId,
  scenarioId: 'weekend-deadline',
  language: 'en-IN',
  card: { version: 1, needToSay: "I'm not available this weekend.", preferNotToAgree: 'Working Saturday', couldOffer: '' },
  transcript: [{ id: 'root', speaker: 'actor', text: 'Saturday works, right?' }],
  reply: "I can't do Saturday.",
});

async function serve(providers: ReturnType<typeof providersFromEnv>, logs: string[] = []) {
  const server: Server = createApp(providers, { log: (l) => logs.push(l) }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, base };
}

const post = (base: string, path: string, body: unknown) =>
  fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('server without credentials', () => {
  let ctx: Awaited<ReturnType<typeof serve>>;
  const logs: string[] = [];
  beforeAll(async () => {
    ctx = await serve(providersFromEnv({ CHAT_PROVIDER: 'sarvam', MOCK_DELAY_MS: '0' }), logs);
  });
  afterAll(() => ctx.server.close());

  it('reports live unavailable and does not describe itself as demo', async () => {
    const status = await (await fetch(ctx.base + '/api/status')).json();
    expect(status.mode).toBe('unavailable');
    expect(status.chat.reason).toMatch(/SARVAM_API_KEY is not set/);
    expect(JSON.stringify(status)).not.toMatch(/sk_|Bearer /);
    expect(status.speech.available).toBe(false);
  });

  it('refuses text practice instead of returning a scripted reply', async () => {
    const res = await post(ctx.base, '/api/actor', actorBody('t1'));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('provider_unavailable');
    expect(json.text).toBeUndefined();
    expect(json.message).not.toMatch(/So after ten|Who do you suggest/);
  });

  it('speech endpoints fail recoverably with 503', async () => {
    const res = await fetch(ctx.base + '/api/speech/transcribe?language=ml-IN', {
      method: 'POST',
      headers: { 'Content-Type': 'audio/webm' },
      body: new Uint8Array(2000),
    });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('speech_unavailable');
  });

  it('rejects malformed requests', async () => {
    const res = await post(ctx.base, '/api/actor', { ...actorBody('t2'), transcript: [] });
    expect(res.status).toBe(400);
    const bad = await post(ctx.base, '/api/actor', { ...actorBody('../../etc'), language: 'xx' });
    expect(bad.status).toBe(400);
  });

  it('logs metadata only, never message content', () => {
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.join('\n')).not.toMatch(/Saturday|weekend/i);
  });
});

describe('server idempotency and failures', () => {
  it('runs the provider once for a duplicated request ID', async () => {
    let calls = 0;
    const mock = createMockProvider(30);
    const chat: ChatProvider = { ...mock, actor: async (r, s) => (calls++, mock.actor(r, s)) };
    const base = providersFromEnv({});
    const ctx = await serve({ ...base, chat });
    const [a, b] = await Promise.all([post(ctx.base, '/api/actor', actorBody('dup')), post(ctx.base, '/api/actor', actorBody('dup'))]);
    expect(await a.json()).toEqual(await b.json());
    expect(calls).toBe(1);
    ctx.server.close();
  });

  it('turns provider failure into a clean error the client can recover from', async () => {
    const mock = createMockProvider(0);
    const chat: ChatProvider = { ...mock, actor: async () => { throw new Error('boom secret-ish detail'); } };
    const ctx = await serve({ ...providersFromEnv({}), chat });
    const res = await post(ctx.base, '/api/actor', actorBody('f1'));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret-ish');
    ctx.server.close();
  });

  it('coach receives a copy and cannot mutate the request it was given', async () => {
    const mock = createMockProvider(0);
    let seen: unknown;
    const chat: ChatProvider = {
      ...mock,
      coach: async (r) => {
        seen = r;
        (r.cards[0] as { needToSay: string }).needToSay = 'mutated';
        return null;
      },
    };
    const ctx = await serve({ ...providersFromEnv({}), chat });
    const res = await post(ctx.base, '/api/coach', {
      requestId: 'c1',
      scenarioId: 'weekend-deadline',
      language: 'en-IN',
      transcript: [{ id: 'u1', speaker: 'user', text: 'hi', cardVersion: 1 }],
      cards: [{ version: 1, needToSay: 'x', preferNotToAgree: '', couldOffer: '' }],
    });
    expect((await res.json()).finding).toBeNull();
    expect(seen).toBeDefined();
    ctx.server.close();
  });
});

describe('mock fixtures', () => {
  it('flags a possible concession only from the user’s own words, as a proposal', async () => {
    const mock = createMockProvider(0);
    const f = await mock.coach(
      {
        requestId: 'c',
        scenarioId: 'weekend-deadline',
        language: 'en-IN',
        transcript: [
          { id: 'root', speaker: 'actor', text: 'Saturday?', cardVersion: 1 },
          { id: 'u1', speaker: 'user', text: "I can't do Sunday. I could do a few hours Saturday morning.", cardVersion: 1 },
        ],
        cards: [{ version: 1, needToSay: "I'm not available this weekend.", preferNotToAgree: 'Working Saturday or Sunday.', couldOffer: '' }],
      },
      new AbortController().signal,
    );
    expect(f).toMatchObject({ kind: 'possible_change', messageId: 'u1', quote: 'I could do a few hours Saturday morning.' });
  });

  it('intention suggestion only reuses sentences the user wrote', async () => {
    const thoughts = "Third weekend in a row. I need to say I'm not available. I could stay late Friday.";
    const f = await createMockProvider(0).suggestIntention(
      { requestId: 'i', scenarioId: 'weekend-deadline', language: 'en-IN', thoughts },
      new AbortController().signal,
    );
    expect(f).toEqual({ needToSay: "I'm not available.", preferNotToAgree: '', couldOffer: 'I could stay late Friday.' });
    const g = await createMockProvider(0).suggestIntention(
      { requestId: 'j', scenarioId: 'weekend-deadline', language: 'en-IN', thoughts: "I'd prefer not to agree to working Sunday." },
      new AbortController().signal,
    );
    expect(g.preferNotToAgree).toBe('Working Sunday.');
    expect(g.needToSay).toBe('');
  });
});
