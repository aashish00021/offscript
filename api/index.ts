import { createApp } from '../server/app.js';
import { providersFromEnv } from '../server/config.js';

/**
 * Vercel entry point: the same Express API as `npm start`, run as one serverless
 * function. vercel.json rewrites every /api/* request here; the static UI is served
 * from dist/. SARVAM_API_KEY comes from the project's environment variables.
 */
export default createApp(providersFromEnv(process.env), { log: (line) => console.log(line) });
