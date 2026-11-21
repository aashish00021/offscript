import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../server/app';
import { providersFromEnv } from '../server/config';
import type { ChatProvider } from '../server/providers/types';

/** A stand-in chat provider for routing tests. The app itself has no scripted mode. */
function fakeChat(delayMs = 0): ChatProvider {
  const wait = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), delayMs));
  return {
    name: 'sarvam',
    model: 'fake',
    actor: () => wait('So who covers Saturday?'),
    opening: () => wait('We need to talk about the weekend.'),
    coach: () => wait(null),
    suggestIntention: () => wait({ needToSay: 'x', preferNotToAgree: '', couldOffer: '' }),
    suggestCue: () => wait({ mainPoint: 'x', opening: '', fallback: '' }),
  };
}

const scenario = {
  title: 'Saying no to weekend work',
  counterpartName: 'Ravi',
  counterpartRole: 'my team lead',
  situation: 'He wants me to work this weekend.',
};

const actorBody = (requestId: string) => ({
  requestId,
  scenario,
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
    ctx = await serve(providersFromEnv({}), logs);
  });
  afterAll(() => ctx.server.close());

  it('reports that the AI is unavailable without a key', async () => {
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
    const noName = await post(ctx.base, '/api/actor', { ...actorBody('t3'), scenario: { ...scenario, counterpartName: '  ' } });
    expect(noName.status).toBe(400);
    const tooLong = await post(ctx.base, '/api/actor', { ...actorBody('t4'), scenario: { ...scenario, situation: 'x'.repeat(601) } });
    expect(tooLong.status).toBe(400);
  });

  it('logs metadata only, never message content', () => {
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.join('\n')).not.toMatch(/Saturday|weekend/i);
  });
});

describe('server idempotency and failures', () => {
  it('runs the provider once for a duplicated request ID', async () => {
    let calls = 0;
    const base0 = fakeChat(30);
    const chat: ChatProvider = { ...base0, actor: async (r, s) => (calls++, base0.actor(r, s)) };
    const base = providersFromEnv({});
    const ctx = await serve({ ...base, chat });
    const [a, b] = await Promise.all([post(ctx.base, '/api/actor', actorBody('dup')), post(ctx.base, '/api/actor', actorBody('dup'))]);
    expect(await a.json()).toEqual(await b.json());
    expect(calls).toBe(1);
    ctx.server.close();
  });

  it('turns provider failure into a clean error the client can recover from', async () => {
    const chat: ChatProvider = { ...fakeChat(), actor: async () => { throw new Error('boom secret-ish detail'); } };
    const ctx = await serve({ ...providersFromEnv({}), chat });
    const res = await post(ctx.base, '/api/actor', actorBody('f1'));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret-ish');
    ctx.server.close();
  });

  it('coach receives a copy and cannot mutate the request it was given', async () => {
    let seen: unknown;
    const chat: ChatProvider = {
      ...fakeChat(),
      coach: async (r) => {
        seen = r;
        (r.cards[0] as { needToSay: string }).needToSay = 'mutated';
        return null;
      },
    };
    const ctx = await serve({ ...providersFromEnv({}), chat });
    const res = await post(ctx.base, '/api/coach', {
      requestId: 'c1',
      language: 'en-IN',
      transcript: [{ id: 'u1', speaker: 'user', text: 'hi', cardVersion: 1 }],
      cards: [{ version: 1, needToSay: 'x', preferNotToAgree: '', couldOffer: '' }],
    });
    expect((await res.json()).finding).toBeNull();
    expect(seen).toBeDefined();
    ctx.server.close();
  });
});

describe('opening line', () => {
  it('returns the provider line for a user-written situation', async () => {
    const ctx = await serve({ ...providersFromEnv({}), chat: fakeChat() });
    const res = await post(ctx.base, '/api/opening', {
      requestId: 'o1',
      scenario,
      language: 'en-IN',
      card: { version: 1, needToSay: "I'm not available this weekend.", preferNotToAgree: '', couldOffer: '' },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).text).toBe('We need to talk about the weekend.');
    ctx.server.close();
  });
});
