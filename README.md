# Offscript

**Rehearse the conversation you're dreading, in your own words and your own language, before you have it.**

> *"I know what I need to say, but when the conversation gets difficult, I lose my words."*

Offscript is a laptop-first practice space for that moment. You describe a real conversation you're putting off — asking a landlord for a repair, saying no to weekend work, asking a friend to pay back money. You write down the one point you need to land and approve it as a short card. Then you rehearse it out loud against an AI playing the other person, who pushes back the way people actually do. When you slip — agree to the thing you didn't want, or drift off your point — you can rewind to that moment and try a different reply, while your first attempt stays saved. You leave with a cue card in your own words.

It is a practice tool, not therapy. It doesn't diagnose, and it doesn't score your confidence, emotion or fluency.

---

## The idea

Most advice for hard conversations is about *what* to say. The failure people describe is different: they know what to say, but under pressure — a parent's guilt, a manager's urgency, a friend's awkward laugh — they lose the thread, soften the ask, or agree to something they had decided not to agree to.

Offscript is built around five ideas:

1. **Your point, written by you, approved by you.** Before you practise, your messy thoughts become a three-part card: *what I need to say*, *what I'd prefer not to agree to*, *what I could offer*. The AI can draft it, but nothing counts until you approve it. The card stays on screen while you practise.
2. **Realistic pushback, not a pushover.** The other person is played by a model that stays in character, reacts to what you actually said (even if it was messy), partly agrees, asks questions or holds its ground, and softens only if you stay clear.
3. **Rewind instead of restart.** Any reply can be retried from the same moment. Attempts are kept side by side, so you can compare "what I said" against "what I wish I'd said" and see how the other person responded to each.
4. **Feedback that quotes you, and asks rather than judges.** On request, a separate coach gives one observation. It must quote your exact words, and the app checks that quote against the transcript before showing it. If you seem to have conceded something on your card, the app asks *"Is that an intentional change?"* instead of marking it as a mistake. Your goals are yours to change.
5. **Drills on the moments you slipped.** Any of your replies can become a quick drill: three possible answers to the same line — one that keeps your point, one that gives in, one that's vague. Pick one, see why each works or doesn't, then rewind and try the strong one in the real conversation.

**Voice and Indian languages.** Practise as a chat by typing, or open **voice mode** and talk face to face: an orb listens while you speak, sends when you pause, and moves with the other person's voice as they answer. Every line also appears in the chat. This uses [Sarvam AI](https://docs.sarvam.ai/) models for chat, speech-to-text and text-to-speech, in all 23 languages Sarvam's speech-to-text supports: English and the 22 scheduled Indian languages. In the 11 that Sarvam can also speak (English, Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia) the other person answers out loud; in the other 12 (Assamese, Urdu, Nepali, Konkani, Kashmiri, Sindhi, Sanskrit, Santali, Manipuri, Bodo, Maithili, Dogri) you can still speak, and their replies appear as text.

### What a session looks like

1. **Describe the conversation.** What it's about, who you're talking to, who they are to you, and what's going on. Optionally, write how they open, or leave it blank and the AI opens in character. Two examples can prefill the form.
2. **Make your card.** Dump your thoughts; the AI drafts the card from your own words; you edit and approve it.
3. **Rehearse.** The other person speaks first. Reply in the chat, or switch to voice mode and just talk. You get up to 6 replies per attempt and up to 3 attempts at any point.
4. **Ask for one observation** whenever you want it, **drill** any of your replies, and **try another reply** from any earlier point. **Compare** attempts side by side.
5. **Leave with a cue card.** The main point, a way to start, and a line to come back to, suggested from your words and approved by you. You can copy or download it.

---

## Research this builds on

We read these sources directly. The full notes, including what each source does **not** support, are in [`EVIDENCE.md`](EVIDENCE.md).

1. **Inna Lin, Ashish Sharma, Christopher Rytting, Adam Miner, Jina Suh, Tim Althoff.** *IMBUE: Improving Interpersonal Effectiveness through Simulation and Just-in-time Feedback with Human-Language Model Interaction.* Proceedings of the 62nd Annual Meeting of the Association for Computational Linguistics (ACL 2024, Volume 1: Long Papers), pp. 810–840. [aclanthology.org/2024.acl-long.47](https://aclanthology.org/2024.acl-long.47/) · DOI [10.18653/v1/2024.acl-long.47](https://doi.org/10.18653/v1/2024.acl-long.47)
   - A randomized study (n = 86) of LLM-simulated practice for interpersonal conversations, with and without just-in-time feedback. Simulation alone improved self-efficacy and reduced negative emotion. Adding feedback improved skill mastery by 17%, and only skill mastery transferred to a new, harder situation.
   - **What we take from it:** simulated practice with specific, in-the-moment feedback and the chance to revise is worth building and testing. That is the core loop here: simulate, observe, try again.
   - **What we don't claim:** IMBUE taught DEAR MAN (a DBT skill); Offscript does not. IMBUE did not study rewinding, comparing attempts, user-approved goal cards, voice, or Indian languages, and none of its results transfer to this app automatically.

2. **Shizhen Zhang, Shengxin Li, Quan Li.** *Understood: Real-Time Communication Support for Adults with ADHD Using Mixed Reality.* arXiv:2507.18151, 2025 (the arXiv listing notes "Will Appear at UIST 2025"). [arxiv.org/abs/2507.18151](https://arxiv.org/abs/2507.18151)
   - A HoloLens 2 system that supports adults with ADHD *during* conversations with keyword summaries, short user-activated word suggestions, and a gentle off-topic reminder. It was informed by clinicians and adults with ADHD.
   - **What we take from it:** losing the thread mid-conversation is a real, studied problem, and support works best when it's light-touch and user-controlled. That is why the card is a one-line reminder, and the coach speaks only when asked.
   - **What we don't claim:** Offscript is rehearsal *before* a conversation, not live support during one. It makes no claims about ADHD or any other condition.

3. **Sarvam AI API documentation**, [docs.sarvam.ai](https://docs.sarvam.ai/), read 2026-11-21. This is the source for the model IDs and request shapes used here: chat `sarvam-105b` / `sarvam-105b-conversations`, speech-to-text `saaras:v4`, text-to-speech `bulbul:v3`.

How we would test whether the design helps, against a fair baseline (the same model in an ordinary chat with a strong prompt): [`docs/COMPARISON.md`](docs/COMPARISON.md).

---

## Run it

Requires **Node ≥ 20.3** and a **Sarvam API key**. There is no offline or scripted mode: every reply comes from the model, based on the situation the user writes.

```bash
npm install
cp .env.example .env          # then set SARVAM_API_KEY=...
npm run dev                   # http://localhost:5173 (one process: API + Vite)
```

```bash
npm test                      # 34 unit and server tests (vitest); Sarvam is stubbed, no key needed
npm run typecheck
npm run build && npm start    # production-style: serves dist/ with a strict CSP, binds to 127.0.0.1
```

- The key is read only by the server. It is never sent to the browser, logged, or included in responses. `/api/status` reports only the mode and model IDs.
- Without a key the app still starts, but a red banner says the AI is unavailable, and every AI request returns a clear error. Nothing is faked.
- Voice (Talk and spoken replies) is on whenever the key is set. Set `SPEECH_ENABLED=false` to turn it off. Model IDs can be overridden in `.env` (see `.env.example`).

---

## How it works

```
src/core/        pure TypeScript, no React — what most tests cover
  types.ts       Scenario, Session, Message, IntentionVersion, ApprovedCue, limits
  session.ts     reducer: the only way state changes
  tree.ts        paths, children, branch restore, which card version applies where
  requests.ts    builds exactly what each model call is given
  coach.ts       verifies coach findings against the real transcript
  cue.ts         flags promises the user never wrote; cue-card text
src/shared/      zod request/response schemas, language list, example situations
src/client/      React UI (setup form, chat, voice mode with orb, drills, compare, cue card)
server/          Express API, Sarvam adapter (chat + speech), request idempotency
tests/           vitest
```

**The code owns the state, not the model.** The transcript is a tree of messages with parent links, kept in a reducer in the browser. Every message records the approved card version it was sent under. A card change approved mid-practice becomes a new version that applies from that point, on that attempt only. Earlier messages and other attempts keep theirs, and comparisons are labelled "card v1" and "card v2".

- **The other person** (`/api/actor`) is given only the user-written situation, the card that applies at that point, and the root-to-current path of the active attempt. Sibling attempts and later messages are never sent. If the user left the opening line blank, `/api/opening` writes it in character, without seeing the card, so the first line can't react to goals the user hasn't voiced yet.
- **The coach** (`/api/coach`) is a separate, read-only call made only on request. It must return a message ID and an exact quote. The server re-checks the quote and retries once if needed. `verifyCoachFinding` in the browser checks again that the ID is a user message on the active path and that the quote really appears in it; if not, nothing is shown. The "Is that an intentional change?" question is assembled by code from the verified quote and the card version that message was sent under. The model can't word it.
- **Drills** (`/api/drill`) take one of the user's replies and the line it answered, and return exactly three replies: one that keeps the point (and adds no new promises), one that concedes, one that's vague, each with a one-line reason. The server rejects anything that isn't one of each kind, or that contains template placeholders, and retries. "Try it from here" starts a new attempt at that moment with the strong reply as an editable draft.
- **Suggestions are drafts.** Card, coach and cue-card suggestions only fill an editable draft. Nothing is approved until the user presses a button.
- **Untrusted text stays data.** Everything the user writes (the situation, the card, the replies) is sent to the model inside `<data>` tags, with an instruction to treat it as data, never as instructions. Requests and model output are validated with zod. Everything renders as plain React text (no `dangerouslySetInnerHTML`). Model output is never executed, and URLs in it are never followed.
- **Requests can't double-fire or land in the wrong place.** Each submit has a unique request ID, guarded in the reducer, by an in-flight ref, and by a server-side idempotency cache. Responses that arrive late, after a cancel, on another attempt or after a reset either land under their original parent or are dropped. A failed request commits nothing, and the draft stays in the composer.
- **Model output is checked, not trusted.** The server retries when a model returns an empty card, malformed JSON or a garbled quote. If a quote's ending is garbled, the longest matching run of its opening words (at least 4) is used, so the shown quote is always real text from the message.
- **Voice mode.** A hands-free loop: listen → transcribe → reply → speak → listen. The microphone closes after about 1.2 s of silence, on a tap, or at 25 s. A clip with less than 0.4 s of detected speech is never uploaded, so room noise can't turn into an invented reply.
- **Spoken replies.** Each reply is split so its first sentence is synthesised and played while the rest is still being generated. The parts play back to back through one Web Audio context, which also drives the orb's level. Replies use the female or male voice picked for the situation and can be muted from the chat header.
