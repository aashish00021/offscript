# Offscript

A laptop-first prototype for this moment: *"I know what I need to say, but when the conversation gets difficult, I lose my words."*

You write down your point as a short card and approve it, practise one short conversation with a fictional counterpart, and try a different reply at any point while your first attempt stays saved. You can ask for one quoted observation when you want it, and you leave with a cue card you approve.

It is not therapy and it doesn't diagnose. It makes no claims about ADHD or anxiety, and it doesn't score confidence, emotion, fluency or anything else.

> Status: overnight hackathon prototype. **Not validated** with users and **not deployed**. Live AI and voice have **not** been exercised from this repo (no credentials were provided). See [Limitations](#limitations).

## Run it

Requires Node ≥ 20.3.

```bash
npm install
npm run dev        # http://localhost:5173 (one process: API + Vite)
npm test           # state and server tests (vitest)
npm run typecheck
```

With no `.env`, the app runs in **Demo**. The banner says the replies are scripted fixtures, not AI.

To use live English text, put a Sarvam key in `.env` (see below) and set `CHAT_PROVIDER=sarvam`, then restart the server. If that variable is `sarvam` but the key is missing, the banner says **Live unavailable** and practice calls return an error. Scripted lines are not used as a stand-in.

### Live mode (Sarvam)

```bash
cp .env.example .env
# set CHAT_PROVIDER=sarvam and SARVAM_API_KEY=... (server-side only)
npm run dev
```

- The key is read only by the server. It is never sent to the browser, written to logs, or included in responses. `/api/status` reports only mode, provider and model IDs.
- Push-to-talk and spoken replies are offered **only** when `SARVAM_API_KEY` is set. Without it, the UI shows "Voice unavailable" and text practice works as normal.
- Model IDs were checked against docs.sarvam.ai on 2026-11-21 (see `EVIDENCE.md`). They can be overridden in `.env`.

Production-style run: `npm run build && npm start` (serves `dist/` with a strict CSP, binds to 127.0.0.1).

## How it works

```
src/core/        pure TypeScript, no React; this is what the tests cover
  types.ts       Session, Message, IntentionVersion, ApprovedCue, limits
  session.ts     reducer: the only way state changes
  tree.ts        path / children / branch restore / which card applies where
  requests.ts    builds exactly what the actor and coach are given
  coach.ts       verifies model findings against the real transcript
  cue.ts         flags promises the user never wrote; cue-card text
src/shared/      zod request/response schemas, fictional scenarios
server/          Express API, provider adapter (mock | sarvam), idempotency
src/client/      React UI
tests/           vitest
```

**The code owns state, not the model.** The transcript is a tree of messages with parent links, and the client keeps it in a reducer. Every message records the approved card version it was sent under. A card change approved mid-practice is stored as a new version and applies from that point on that attempt only. Earlier messages and other attempts keep their version, and comparisons show labels like "card v1" and "card v2".

- **Actor**: receives only the root-to-current path of the active attempt, plus the card that applies there (`buildActorRequest`). Siblings and later messages are never read.
- **Coach**: a separate, read-only call made on request. The model must return a message ID and a quote. `verifyCoachFinding` checks that the ID is a user message on the active path and that the quote really appears in it. If either check fails, nothing is shown. The possible-concession question is assembled by code from the verified quote and the card version that message was sent under, and it is phrased as a question.
- **Suggestions**: coach and cue suggestions only ever become a draft. Nothing is sent or approved until the user presses a button.
- **Requests**: each submit gets a unique request ID and is guarded three times: in the reducer, by an in-flight ref, and by a server-side idempotency cache. Responses carry the epoch and request ID. Anything late, cancelled, from another attempt, or from before a reset either lands under its original parent or is dropped. A failed or cancelled request commits nothing and the draft stays in the composer.
- **Limits**: 6 user replies per attempt and 3 attempts per checkpoint. History is never compressed or summarised.
- **Untrusted text**: scenario, card and transcript text are sent to the model wrapped in `<data>` tags marked as data, never as instructions. Requests and model output are validated with zod. Everything is rendered as plain React text (no `dangerouslySetInnerHTML`). Model output is never executed, and URLs in it are never followed.

### Privacy

- State is kept in this tab's `sessionStorage` so a reload doesn't lose a session. Closing the tab, or **Clear everything**, removes it. Requests in flight are not persisted.
- In demo mode nothing leaves the machine. In live mode, the text you send (and audio clips, only between Record and Stop) goes to Sarvam. We have not verified Sarvam's retention terms, so Clear everything cannot delete data held by the provider.
- The server logs method, path, status and duration only, never content. There are no analytics.
- The microphone opens only while recording and its tracks stop right afterwards. Clips are capped at 25 s, are not stored, and their transcript goes into the editable composer. Nothing is sent until you press Send.

## Hackathon fit (open questions)

- **Track**: the plausible fit is *Beyond English*, but **only if** Indian-language rehearsal genuinely works with live Sarvam models. That is untested. An English-only text demo in mock mode should **not** be presented as meeting that track.
- **Language and Sarvam access**: unconfirmed. Malayalam (`ml-IN`) is selectable. In mock mode the UI says replies are English-only fixtures.
- **Tool rules**: earlier event information mentioned a Devin requirement, and the track sheet doesn't settle what tools are allowed. This repo was built with an AI coding assistant in Cursor. **Check the rules with the organisers. Don't assume this satisfies them.**

## Tested so far

- `npm test`: 28 tests. Forks keep the original; actor context excludes siblings and later messages; switching attempts restores the right card version; the coach can't change approved state; card changes need approval; invented or mismatched quotes are rejected; late responses land in the right branch; duplicate submits aren't duplicated (client and server); missing credentials don't block text and speech returns a recoverable 503; API failure keeps the draft; reset clears state; added promises are flagged; logs contain no content.
- Browser run (headless Chrome with Playwright, at 1366×820 and 390×844), with screenshots in `screenshots/` (git-ignored): the full loop from setup to approved cue card, Ctrl/⌘+Enter keyboard send, visible focus rings, no horizontal overflow at either width, composer not clipped, reload keeps the session, Clear everything empties storage, a simulated network failure keeps the draft and Try again works, cancel keeps the draft with no late insert, and attempts are labelled card v1 and card v2 after a card change.

## Limitations

- **Live AI is untested.** Prompts for `sarvam-105b` / `sarvam-105b-conversations` are written but have never been run. Model quality, latency, JSON reliability and Malayalam output are unknown.
- **Voice is untested.** The recorder and the `saaras:v4` / `bulbul:v3` calls follow the docs but have not run against the real API, and mic behaviour was not checked in a real browser with a real device. Safari's MediaRecorder MIME types may need work.
- **Mock replies are keyword-matched scripts**, in English only. They show the state handling, not conversational quality.
- The commitment check is a small English regex list. It misses paraphrases and doesn't work for Indian languages.
- The coach is grounded in quotes, but its free-text note can still be unhelpful or wrong. Only the quote and the concession question are verified by code.
- The interface is English even when the practice language is not.
- No user testing. No claims about transfer, outcomes or comparative benefit. See `docs/COMPARISON.md`.
- Single-user, local-only, no accounts. Not built or reviewed for deployment.
