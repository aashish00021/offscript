# Manual comparison protocol

Goal: check whether keeping your own approved card in view, with alternative attempts side by side, makes it easier to recover your point than a well-prompted general chatbot, against a fair baseline. The baseline is the **same model** in an ordinary chat with a strong prompt, not a straw man. This is a small, informal usability comparison, not a study of effectiveness or clinical outcomes.

## Conditions

- **A. This app**, using the same model the baseline uses.
- **B. Ordinary chat** with the same model (for example the Sarvam playground or a plain chat client), opened with the prompt below.


### Baseline prompt (paste as the first message in B)

> You'll help me practise a difficult conversation. First, ask me what I need to say, what I'd prefer not to agree to, and what I could offer, and write those back as a short "card" for me to approve or edit. Then role-play [counterpart] in this situation: [situation]. Stay in character with realistic resistance and nuance; don't agree to everything and don't escalate forever. Reply in 1–3 sentences.
> Keep track of my approved card throughout. When I type "COACH", step out of character and give at most one observation about my own words, quoting me exactly, and one optional suggestion. If I seem to concede something on my card, ask whether it's intentional instead of judging it.
> When I type "RETRY n", let me answer your message number n again, and keep my earlier attempt so I can compare both.
> When I type "DONE", draft a cue card with my main point, one opening line and an optional fallback, using my words and adding no promises, for me to approve.
> No scores, no diagnosis, no comments on my confidence or emotions.

## Procedure (per participant)

1. Use the two example situations (late-night calls, weekend work). Counterbalance: half do A then B, half B then A, and swap which scenario goes with which condition.
2. Each condition takes about 10 minutes and has a fixed script of tasks:
   - Set up and approve a card.
   - Exchange at least 3 replies.
   - Once, deliberately give a vague or conceding reply. Then try a different reply at that point.
   - Ask for one observation.
   - Go back to the first attempt, then return to the second.
   - Finish with a cue card you approve.
3. The facilitator times each task and notes errors, such as the model mixing up attempts, losing the card, misquoting the user, or adding commitments the user never wrote.

## Measures

Only things that can be observed, plus brief self-report on ease of use:

- **Recovering the point**: after the hard reply, how many seconds until the participant can say their main point aloud, and does it match their approved card?
- **Revisiting attempts**: success (yes/no) and time to show the facilitator attempt 1 and attempt 2 from the same point, with nothing from one mixed into the other.
- **Approved cues**: did they leave with a cue card they explicitly approved? Did it contain anything they didn't write or mean (count these)?
- **Grounding errors**: count misquotes, invented claims about what they said, and lost or overwritten card content.
- **Ease**: one 1–7 rating per task ("How easy was it to…") and one open question about what got in the way.

## Reporting rules

- Report raw counts and times for every participant, including failures, and say how many people took part.
- Describe differences without declaring a winner. With a handful of participants, any difference is anecdotal.
- No claims about real conversations, transfer, confidence, anxiety, ADHD or treatment.
- Note the model ID, date, language and any outages for each session. Model behaviour changes over time.
- Don't record audio or collect personal stories. Participants use the example situations only.
