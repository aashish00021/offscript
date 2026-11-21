import type { CueFields, IntentionFields } from '../../src/core/types';
import type { CoachFindingRaw } from '../../src/shared/api';
import type { ChatProvider } from './types';

/**
 * Deterministic scripted fixtures. No model is involved: replies are chosen by
 * keyword rules so tests and demos are repeatable. This is NOT evidence that a
 * live model behaves this way.
 */

type Kind = 'offer' | 'firm' | 'vague' | 'concede';

const FIXTURES: Record<string, Record<Kind, string[]>> = {
  'late-night-call': {
    firm: [
      "So after ten I'm not allowed to call? The evening is the only time I finally sit down.",
      'Ten is early for me. And if something happens at night, then what?',
      "Alright. I don't like it, but I'm hearing you. Weeknights only?",
    ],
    offer: [
      "Seven? You're driving then. I don't want you on the phone while driving.",
      "On your way home… I could try that. But some days I'll want to talk later. Then what?",
      'Fine, we can try it for a week. If it is urgent, I will still call.',
    ],
    vague: [
      "So is that yes or no? I can't tell what you want me to do.",
      'Then I will just call like usual, and you tell me if you are busy.',
      "You keep saying 'maybe'. Just tell me straight.",
    ],
    concede: [
      'Good. Then I will call tonight, same time as always.',
      "See, it's not so difficult to talk to your mother.",
      'Okay. So nothing changes, then.',
    ],
  },
  'weekend-deadline': {
    firm: [
      "I hear you, but the client isn't flexible. Who do you suggest picks this up?",
      "Everyone is stretched. If you're out, I have to explain the gap on Monday.",
      "Okay. I'm not thrilled, but I know it's been a few weekends.",
    ],
    offer: [
      'Thursday and Friday late could work if your part is done by Friday night. Can you commit to that?',
      'Handover notes help. Will anyone be able to reach you if something breaks on Saturday?',
      "Fine. Get me the notes by six on Friday and I'll cover the rest.",
    ],
    vague: [
      'So is that a yes for Saturday? I need to tell the client today.',
      "'Maybe' doesn't help me plan. Can you do Saturday morning, just a few hours?",
      "I'll put you down for Saturday unless you tell me otherwise.",
    ],
    concede: [
      "Great, Saturday then. I'll send the details tonight.",
      "Thanks. Let's say Saturday ten to four.",
      'Good. And keep Sunday open just in case.',
    ],
  },
};

function classify(reply: string): Kind {
  const t = reply.toLowerCase();
  if (/\b(maybe|i guess|not sure|kind of|sort of|perhaps|i don[’']?t know|i mean|um)\b/.test(t)) return 'vague';
  if (/\b(instead|could|how about|what if|alternatively|i can offer|happy to)\b/.test(t)) return 'offer';
  if (/(can[’']?t|cannot|won[’']?t|not available|\bno\b|not able|please don[’']?t|\bstop\b|i need)/.test(t)) return 'firm';
  if (/\b(ok|okay|fine|sure|yes|alright|will do)\b/.test(t)) return 'concede';
  return 'vague';
}

const STOP = new Set(
  'that this with have from your what when they them then than there their about would could should just like want need really very into only also does dont doesnt cant wont prefer agree okay maybe keeping keep working doing being make more some time things thing'.split(
    ' ',
  ),
);

export function keywords(text: string): string[] {
  return [
    ...new Set(
      (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
        .filter((w) => w.length >= 4 && !STOP.has(w))
        .map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w)),
    ),
  ];
}

const sentences = (t: string) => t.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
const NEGATION = /(n[’']t\b|\bnot\b|\bno\b|\bnever\b)/i;

/** Sentences matching `pattern`, with only the field's own lead-in removed (e.g. "I need to say"). */
function pick(lines: string[], pattern: RegExp, leadIn?: RegExp): string {
  const text = lines.filter((s) => pattern.test(s)).join(' ').slice(0, 300);
  const stripped = leadIn ? text.replace(leadIn, '') : text;
  return stripped ? stripped[0].toUpperCase() + stripped.slice(1) : '';
}

const delay = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (ms <= 0) return resolve();
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new Error('aborted'));
    });
  });

export function createMockProvider(delayMs = 0): ChatProvider {
  return {
    name: 'mock',
    model: null,

    async actor(req, signal) {
      await delay(delayMs, signal);
      const fixtures = FIXTURES[req.scenarioId] ?? FIXTURES['weekend-deadline'];
      const turn = req.transcript.filter((m) => m.speaker === 'user').length;
      const lines = fixtures[classify(req.reply)];
      return lines[Math.min(turn, lines.length - 1)];
    },

    async coach(req, signal) {
      await delay(delayMs, signal);
      const userTurns = req.transcript.filter((m) => m.speaker === 'user').reverse();
      if (userTurns.length === 0) return null;
      const cardFor = (v: number) => req.cards.find((c) => c.version === v) ?? req.cards[req.cards.length - 1];

      for (const m of userTurns) {
        const avoid = keywords(cardFor(m.cardVersion).preferNotToAgree);
        if (avoid.length === 0) continue;
        for (const s of sentences(m.text)) {
          const words = keywords(s);
          if (!NEGATION.test(s) && words.some((w) => avoid.includes(w))) {
            return { kind: 'possible_change', messageId: m.id, quote: s, field: 'preferNotToAgree' };
          }
        }
      }

      const latest = userTurns[0];
      const card = cardFor(latest.cardVersion);
      const main = keywords(card.needToSay);
      const first = sentences(latest.text)[0] ?? latest.text;
      const finding: CoachFindingRaw = main.some((w) => keywords(latest.text).includes(w))
        ? { kind: 'observation', messageId: latest.id, quote: first, note: 'Here your main point is in your own words.' }
        : {
            kind: 'observation',
            messageId: latest.id,
            quote: first,
            note: "This reply answers them, but the main point on your card isn't in it yet.",
            suggestion: card.needToSay,
          };
      return finding;
    },

    async suggestIntention(req, signal): Promise<IntentionFields> {
      await delay(delayMs, signal);
      const lines = sentences(req.thoughts);
      return {
        needToSay: pick(
          lines,
          /\b(need to (say|tell)|i need|want to say|have to tell|i must)\b/i,
          /^i (need|want|have) to (say|tell( \w+)?)( that)?\s+/i,
        ),
        preferNotToAgree: pick(
          lines,
          /(don[’']t want|do not want|prefer not|won[’']t|not agree|refuse)/i,
          /^i(['’]d| would) prefer not to agree to\s+|^i (don[’']t|do not) want to agree to\s+/i,
        ),
        couldOffer: pick(lines, /\b(could|can offer|instead|happy to)\b/i),
      };
    },

    async suggestCue(req, signal): Promise<CueFields> {
      await delay(delayMs, signal);
      const main = req.card.needToSay.trim();
      const wanted = new Set(keywords(main));
      const same = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase() === main.toLowerCase();
      let opening = '';
      for (const reply of req.userReplies) {
        for (const sentence of reply.split(/(?<=[.!?])\s+/)) {
          const s = sentence.trim();
          if (s.length < 8 || s.length > 140 || same(s)) continue;
          if (keywords(s).some((w) => wanted.has(w))) opening = s;
        }
      }
      // Recovery and offers are not invented here. The offer stays on the intention card.
      return { mainPoint: main, opening, fallback: '' };
    },
  };
}
