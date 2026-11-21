# Offscript

**Rehearse the conversation you're dreading, in your own words and your own language, before you have it.**

> *"I know what I need to say, but when the conversation gets difficult, I lose my words."*

Most of us know what we need to say: ask for the raise, tell family "not after 10 pm", say no to a third weekend of work. Then the other person pushes back, and we lose our words, soften the ask, or agree to the thing we had decided not to.

Offscript is a rehearsal room for that moment. You describe the real conversation, write down your one point, and practise it out loud with an AI that pushes back like the real person would, in English or 22 Indian languages. When you slip, you rewind to that exact moment and try again. You leave with a cue card in your own words.

It is a practice tool, not therapy. It doesn't diagnose, and it never scores your confidence, emotion or fluency.

---

## Contents

- [Why it's needed](#why-its-needed)
- [How a session works](#how-a-session-works)
- [What makes it different](#what-makes-it-different)
- [Who it's for](#who-its-for)
- [Research it builds on](#research-it-builds-on)
- [Languages and voice](#languages-and-voice)
- [Run it](#run-it)
- [Deploy](#deploy)
- [How it works](#how-it-works)
- [Roadmap](#roadmap)

---

## Why it's needed

- **The hard part is holding your point, not finding it.** Advice, scripts and articles prepare the words. They don't prepare you for *"You sound tired. Is that a problem now?"* from your mother at 11 pm, or *"Saturday at least, that works, right?"* from your manager.
- **Real rehearsal is hard to come by.** Friends are too kind, a coach or therapist is expensive and scheduled, and the real conversation happens once. You rarely get a second take.
- **Practice with feedback works.** In a randomized study of LLM-simulated practice for difficult conversations ([IMBUE, ACL 2024](#research-it-builds-on)), simulation alone improved self-efficacy and reduced negative emotion. Adding specific, just-in-time feedback improved skill mastery by a further 17%. Offscript is built on that loop: simulate, get feedback, try again.
- **Many of these conversations don't happen in English.** In India they happen in Hindi, Tamil, Bengali or a mix, and practice tools are mostly English-first.

## How a session works

1. **Describe the conversation.** What it's about, who you're talking to, who they are to you, and what's going on. Optionally, write how they open, or leave it blank and they open in character. Two examples can prefill the form.
   > *Ravi, my team lead, wants me to work a third weekend in a row.*
2. **Make your card.** Dump your messy thoughts; the AI drafts a three-part card from your own words: *what I need to say*, *what I'd prefer not to agree to*, *what I could offer*. You edit and approve it, and it stays on screen while you practise.
3. **Rehearse.** The other person speaks first. Reply in the chat, or open **voice mode**: an orb listens while you talk, sends when you pause, and moves with their voice as they answer aloud.
4. **Slip, and notice it.** Say *"I guess I could come in Saturday morning…"* and ask for an **observation**. The coach quotes your exact words and asks *"Is that an intentional change?"* It asks; it doesn't judge.
5. **Drill and rewind.** Turn that reply into a **drill**: three answers to the same line, one that keeps your point, one that gives in, one that's vague. Pick the one that holds, then **Try it from here** to replay that exact moment. Your first attempt is kept, so you can **compare** the two side by side.
6. **Leave with a cue card.** Your point, a way to start, and a line to come back to, suggested from your words and approved by you. Copy or download it.

Each attempt allows up to 6 replies, and you can make up to 3 attempts at any moment.

## What makes it different

| | General AI chatbots | Social-skills practice apps | Speech-coaching tools | **Offscript** |
|---|---|---|---|---|
| Practise *your* real conversation | If you prompt it well | Mostly built-in scenes | Mostly talks and presentations | **Yes, you write the situation and the person** |
| Your goal stays fixed and visible | Drifts as the chat grows | Lesson goals set by the app | — | **An approved card, versioned when you change it** |
| Rewind to one moment and compare attempts | No | Drills | No | **Yes, attempts side by side** |
| Feedback grounded in your exact words | Can misquote you | Coaching notes | Metrics and scores | **Quotes checked against the transcript by code** |
| Judging | Varies | Streaks, XP, levels | Scores (e.g. pace, filler words) | **None: it asks whether a change was intentional** |
| Indian languages, by voice | Varies | Often English-first | Mostly English | **23 languages; spoken replies in 11** |

Three things set it apart:

1. **Your conversation, not a script.** Offscript is for the one real conversation you're facing this week.
2. **Your goal stays yours.** The card is approved by you, and the app asks before assuming you changed your mind.
3. **Rewind, don't restart.** You practise the exact moment you slip until it holds.

## Who it's for

People facing a conversation they keep replaying in their head: setting a boundary at work, pushing back on family, money with a friend, a landlord who won't fix things, a negotiation. Especially people who know what they want but freeze or over-agree when the other person pushes.

## Research it builds on

We read these sources directly.

1. **Inna Lin, Ashish Sharma, Christopher Rytting, Adam Miner, Jina Suh, Tim Althoff.** *IMBUE: Improving Interpersonal Effectiveness through Simulation and Just-in-time Feedback with Human-Language Model Interaction.* Proceedings of the 62nd Annual Meeting of the Association for Computational Linguistics (ACL 2024, Volume 1: Long Papers), pp. 810–840. [aclanthology.org/2024.acl-long.47](https://aclanthology.org/2024.acl-long.47/) · DOI [10.18653/v1/2024.acl-long.47](https://doi.org/10.18653/v1/2024.acl-long.47)
   - **What it found:** in a randomized study (n = 86), LLM-simulated practice improved self-efficacy and reduced negative emotion. Adding just-in-time feedback improved skill mastery by 17%, and only skill mastery transferred to a new, harder situation.
   - **What we take from it:** simulated practice with specific feedback and the chance to revise is worth building. That is Offscript's core loop.
   - **What we don't claim:** IMBUE taught DEAR MAN (a DBT skill); Offscript does not. IMBUE did not study rewinding, comparing attempts, user-approved goal cards, voice or Indian languages, and its results don't transfer to this app automatically.

2. **Shizhen Zhang, Shengxin Li, Quan Li.** *Understood: Real-Time Communication Support for Adults with ADHD Using Mixed Reality.* arXiv:2507.18151, 2025 (the arXiv listing notes "Will Appear at UIST 2025"). [arxiv.org/abs/2507.18151](https://arxiv.org/abs/2507.18151)
   - **What it built:** a HoloLens 2 system that supports adults with ADHD *during* conversations with keyword summaries, short user-activated word suggestions, and a gentle off-topic reminder.
   - **What we take from it:** losing the thread mid-conversation is a real, studied problem, and support works best when it's light-touch and user-controlled. That's why the card is a one-line reminder and the coach speaks only when asked.
   - **What we don't claim:** Offscript is rehearsal *before* a conversation, not live support during one, and it makes no claims about ADHD or any other condition.

3. **Sarvam AI API documentation**, [docs.sarvam.ai](https://docs.sarvam.ai/). This is the source for the models, language lists and request shapes used here: chat `sarvam-105b` / `sarvam-105b-conversations`, speech-to-text `saaras:v4`, text-to-speech `bulbul:v3`.

Offscript has not yet been tested with users. [`docs/COMPARISON.md`](docs/COMPARISON.md) sets out how we would test it against a fair baseline: the same model in an ordinary chat with a strong prompt.

## Languages and voice

Offscript supports every language Sarvam's speech-to-text supports: **English and the 22 scheduled Indian languages**.

| | Languages | What works |
|---|---|---|
| **Spoken replies (11)** | English, Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia | Chat, voice mode, and the other person answers aloud in a female or male voice |
| **Text replies (12)** | Assamese, Urdu, Nepali, Konkani, Kashmiri, Sindhi, Sanskrit, Santali, Manipuri, Bodo, Maithili, Dogri | Chat, and you can speak your replies; theirs appear as text, because Sarvam's text-to-speech doesn't cover these yet |

Speech is streamed, so the other person starts talking about half a second after their reply is ready.

## Run it

Requires **Node ≥ 20.3** and a **Sarvam API key**. There is no offline or scripted mode: every reply comes from the model, based on the situation the user writes.

```bash
npm install
cp .env.example .env          # then set SARVAM_API_KEY=...
npm run dev                   # http://localhost:5173 (one process: API + Vite)
```

```bash
npm test                      # 46 tests (vitest); Sarvam is stubbed, so no key is needed
npm run typecheck
npm run build && npm start    # production: serves dist/ with a strict CSP on 0.0.0.0:$PORT
```

- The key is read only by the server. It is never sent to the browser, logged, or included in responses.
- Without a key the app still starts, but a banner says the AI is unavailable and every AI request returns a clear error. Nothing is faked.
- Voice is on whenever the key is set. Set `SPEECH_ENABLED=false` to turn it off. Model IDs can be overridden in `.env` (see `.env.example`).

## Deploy

**Vercel (how the live demo runs):** import the repo, set `SARVAM_API_KEY` in the project's environment variables, and deploy. `vercel.json` already configures the build (`npm run build` → `dist/`), serves the API from `api/index.ts` as one serverless function in Mumbai (`bom1`, next to Sarvam), and applies the same security headers as `npm start`.

**Any Node host** (Render, Railway, Fly.io, a VM): build with `npm install && npm run build`, start with `npm start` (listens on `0.0.0.0:$PORT`; `HOST` overrides it), and set `SARVAM_API_KEY`.

The microphone only works over `https://` (or `localhost`), which hosted platforms provide by default.

## How it works

```
src/core/        pure TypeScript, no React: the session model most tests cover
  types.ts       Scenario, Session, Message, IntentionVersion, ApprovedCue, limits
  session.ts     reducer: the only way state changes
  tree.ts        paths, children, branch restore, which card version applies where
  requests.ts    builds exactly what each model call is given
  coach.ts       verifies coach findings against the real transcript
  cue.ts         flags promises the user never wrote; cue-card text
src/shared/      zod request/response schemas, language list, example situations
src/client/      React UI: setup form, chat, voice mode, drills, compare, cue card
server/          Express API, Sarvam adapter (chat + speech), per-process idempotency cache
api/             Vercel entry point (the same Express app as a serverless function)
tests/           vitest
```

**The code owns the state, not the model.** The transcript is a tree of messages with parent links, kept in a reducer in the browser. Every message records the approved card version it was sent under. A card change approved mid-practice becomes a new version that applies from that point, on that attempt only, and comparisons are labelled "card v1" and "card v2".

- **The other person** (`/api/actor`) sees only the user-written situation, the card that applies at that point, and the root-to-current path of the active attempt. Sibling attempts and later messages are never sent. If the opening line is blank, `/api/opening` writes it in character without seeing the card, so the first line can't react to goals the user hasn't voiced yet.
- **The coach** (`/api/coach`) is a separate, read-only call made only on request. It must return a message ID and an exact quote. The server checks the quote and retries; `verifyCoachFinding` in the browser checks again that the ID is a user message on the active path and that the quote really appears in it, or nothing is shown. The "Is that an intentional change?" question is assembled by code from the verified quote and the card version, so the model never words it.
- **Drills** (`/api/drill`) turn one of the user's replies into exactly three answers: one that keeps the point (adding no new promises), one that concedes, one that's vague, each with a one-line reason. Anything that isn't one of each kind, or contains template placeholders, is rejected and retried. *Try it from here* starts a new attempt at that moment with the strong reply as an editable draft.
- **Suggestions are drafts.** Card, coach, drill and cue-card suggestions only fill editable drafts. Nothing is approved until the user presses a button.
- **Untrusted text stays data.** Everything the user writes is sent to the model inside `<data>` tags, with an instruction to treat it as data, never as instructions. Requests and model output are validated with zod, everything renders as plain React text, and model output is never executed.
- **Requests can't double-fire or land in the wrong place.** Each submit has a unique request ID, guarded in the browser by the reducer and an in-flight ref. On a single Node server (`npm start`) an in-memory idempotency cache also runs a repeated request ID only once; on Vercel each function instance has its own cache, so the browser guards are what count. Late, cancelled or stale responses land under their original parent or are dropped, and a failed request leaves the draft in the composer.
- **Model output is checked, not trusted.** The server retries empty cards, malformed JSON, placeholder text and garbled quotes. If a quote's ending is garbled, the longest matching run of its opening words (at least 4) is shown, so a quote is always real text from the message.
- **Voice mode** is a hands-free loop: listen → transcribe → reply → speak → listen. The microphone closes after about 1.2 s of silence, on a tap, or at 25 s, and a clip with less than 0.4 s of detected speech is never uploaded, so room noise can't become an invented reply.
- **Spoken replies** are streamed: the server proxies Sarvam's streaming text-to-speech (MP3) and the browser plays it through a MediaSource as bytes arrive. Browsers without MP3 MediaSource fall back to whole clips, with the first sentence played while the rest is synthesised. All audio runs through one Web Audio context that also drives the orb.

## Roadmap

- **Test with users** against a well-prompted chatbot, following [`docs/COMPARISON.md`](docs/COMPARISON.md).
- **Memory across sessions:** saved rehearsals, cue cards and progress.
- **Drills that learn your patterns,** built from the moments you slip most often.
- **Mobile:** an installable web app, then native apps.
- **Faster turn-taking** with Sarvam's real-time speech-to-text.
