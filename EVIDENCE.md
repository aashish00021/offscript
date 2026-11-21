# Evidence log

This file keeps three things apart: what published sources report, what was observed in other products, and what we only hypothesise. Last updated 2026-11-22.

## 1. Findings from sources (what the source says, read directly)

### IMBUE (Lin et al., ACL 2024)

Source: https://aclanthology.org/2024.acl-long.47/ (abstract) and https://aclanthology.org/2024.acl-long.47.pdf (full text, read for this log).

- Randomized trial, 86 participants recruited from mTurk (n = 34) and Prolific (n = 52). Each person brought two of their own difficult situations and was randomly assigned to *simulation only* or *simulation + just-in-time feedback*.
- The simulation was a GPT-4 role-play partner prompted to be "difficult to convince". Feedback was a skill suggestion, a rating, and improvement suggestions, and the participant could revise their reply.
- Framework: DEAR MAN, from Dialectical Behavior Therapy. **This app is not DBT and does not teach DEAR MAN.**
- Reported results: simulation alone improved self-reported self-efficacy and reduced negative emotion. Adding feedback improved skill mastery by 17% and made larger self-efficacy and emotion gains. Only skill mastery transferred to a new, harder situation.
- Caveats stated by the authors or visible in the method:
  - Skill mastery was scored by the authors' own model (§4), not by blinded human raters at test time.
  - Self-efficacy and emotion were single self-report items, and the authors note self-report bias.
  - There was one session of about an hour. Dose and long-term effects were not studied.
  - "We do not assist participants in setting goals." Participants were chosen because they could already state their goals clearly.
  - Specific mental-health conditions and cultural variation in communication were not addressed.
  - The tool "is not meant to replace practice with an expert".
- What this supports for us: it is reasonable to *investigate* simulated practice with specific feedback and revision.
- What it does not support: that our app works, real-world transfer, branching or attempt comparison (not studied), goal-setting support (out of scope there), or any ADHD or anxiety outcome.

### Understood (UIST 2025)

Sources: the ACM DL page https://dl.acm.org/doi/10.1145/3746059.3747602 returned **HTTP 403 (bot check)** and could not be read directly. Details below come from the arXiv HTML version, https://arxiv.org/html/2507.18151, which may differ from the published version. A search-engine excerpt of the ACM page matched the arXiv wording for the sections we compared.

- A HoloLens 2 mixed-reality system for adults with ADHD. It shows keyword summaries of both speakers, short next-word suggestions (under about 6 words) that the user activates, and a soft off-topic reminder (a trigger that gradually turns red).
- Formative work: interviews with 4 clinicians and 12 adults with ADHD, then a 13-person design workshop.
- Evaluation (arXiv version): within-subjects, **10 participants** recruited from a university community, two counterbalanced open-ended conversations of about 7 minutes each (with and without the system), in their native language.
- Reported: no significant difference in the *number* of pauses or off-topic events, but shorter *average pause duration* (4.22 s vs 6.17 s, p = 0.002) and shorter off-topic duration (p = 0.014). The authors also note problems from LLM hallucinations.
- What this supports for us: a design lead. External cues the user turns on, and user control over when help appears, are worth exploring. We use only the *idea* of user-activated cues; we copy none of its features or interface.
- What it does not support: anything about rehearsal, branching, or this app. It is a small lab study of in-the-moment support, not of practising beforehand. We make no ADHD claims.

### Sarvam AI docs (for the speech and Indian-language path)

Source: https://docs.sarvam.ai/ and its `.md` API pages, read on 2026-11-21.

- Chat: `POST https://api.sarvam.ai/v1/chat/completions`, models `sarvam-105b` (reasoning on by default; `reasoning_effort` can be lowered) and `sarvam-105b-conversations` (reasoning off). Auth header `api-subscription-key`. `response_format` supports `json_object`. `sarvam-m` is deprecated.
- Speech-to-text: `POST /speech-to-text` (multipart), model `saaras:v4` (default), REST clips **up to 30 s**. 22 Indian languages plus English, including `ml-IN` (Malayalam). WebM is accepted.
- Text-to-speech: `POST /text-to-speech`, models `bulbul:v3` (default, speaker `shubh`) and `bulbul:v4-flash`. 11 languages including `ml-IN`, up to 2,500 characters, base64 WAV response.
- Streaming STT and TTS exist (WebSocket and HTTP stream). **We do not use them, and we do not claim streaming or barge-in.**
- Not verified: data retention or deletion terms for API inputs. The app says so rather than promising anything.

## 2. Observed product behaviour (tests the project owner ran, not re-run for this build)

These are short text-only sessions. They describe single interactions and are not verdicts on quality or effectiveness.

- **cosskill.com, "overbearing parent" persona**: plausible resistance, quote-based feedback, rewind, and awareness of revisions. A later actor response failed.
- **nervu.vercel.app**: goal setup, preparation, four exchanges, live coaching, quote-based recap, takeaway and restart all worked. The first load stalled and needed a reload, and one prediction about behaviour was overconfident.
- **Yoodli**: needed a microphone, so not tested. **Davo**: coaching was behind an upgrade, so not tested. Neither is a personally verified benchmark.
- Voice was not tested in any product.

We copied no branding, text, assets or interface from these products.

## 3. Our hypotheses (unvalidated)

- H1: Having your *own approved* intention cue in view, plus keeping your alternative attempts side by side, makes it easier to recover your point than managing a well-prompted general chatbot. **Not tested.** See `docs/COMPARISON.md` for how to test it.
- H2: Asking whether an apparent concession is *intentional*, instead of flagging it as a failure, keeps the user in charge of their goals. Not tested.
- H3: Indian-language rehearsal by voice is usable for this moment. **Not tested with users.** On 2026-11-22 the pipeline was exercised live: chat replies came back in the right script in all 23 languages, and speech-to-text → text-to-speech round trips succeeded in all 11 spoken languages. That shows the pipeline works, not that it helps anyone.

No user results exist. Nothing here is a clinical claim.
