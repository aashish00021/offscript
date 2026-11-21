import path from 'node:path';
import express from 'express';
import { createApp } from './app';
import { providersFromEnv } from './config';

try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: variables may still come from the shell.
}

const prod = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 5173);
const providers = providersFromEnv(process.env);
const app = createApp(providers, { log: (l) => console.log(l) });

if (prod) {
  const dist = path.resolve('dist');
  app.use((_req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; media-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:",
    );
    next();
  });
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

// Local dev stays on loopback; a production deploy must accept outside connections. HOST overrides both.
const host = process.env.HOST ?? (prod ? '0.0.0.0' : '127.0.0.1');

app.listen(port, host, () => {
  const s = providers.status;
  console.log(`Offscript → http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
  console.log(
    `  chat: ${s.mode === 'live' ? `live via ${s.chat.provider}` : `UNAVAILABLE (${s.chat.reason})`}`,
  );
  console.log(`  speech: ${s.speech.available ? 'available' : `unavailable (${s.speech.reason})`}`);
});
