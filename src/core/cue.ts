import type { CueFields } from './types.js';

const COMMITMENT_PATTERNS: Array<[string, RegExp]> = [
  ['promise', /\bpromis(e|es|ed|ing)\b/i],
  ['I will', /\bi will\b/i],
  ["I'll", /\bi[’']ll\b/i],
  ['always', /\balways\b/i],
  ['never', /\bnever\b/i],
  ['every …', /\bevery (day|night|week|weekend|time|saturday|sunday)\b/i],
  ['guarantee', /\bguarantee/i],
  ['definitely', /\bdefinitely\b/i],
  ['for sure', /\bfor sure\b/i],
  ['anytime', /\bany ?time\b/i],
];

/** Commitment-like phrases (English) present in a cue but absent from everything the user wrote. */
export function findInsertedCommitments(cue: CueFields, userSources: string[]): string[] {
  const text = [cue.mainPoint, cue.opening, cue.fallback].join('\n');
  const source = userSources.join('\n');
  return COMMITMENT_PATTERNS.filter(([, re]) => re.test(text) && !re.test(source)).map(([label]) => label);
}

/**
 * Words in a cue that appear nowhere in what the user wrote, in any language and script.
 * The English list above names promises precisely; this catches the same thing elsewhere
 * (a new "वादा", a new deadline), because an added commitment needs words the user never used.
 */
export function findNewWords(cue: CueFields, userSources: string[], language: string, max = 6): string[] {
  const segmenter = new Intl.Segmenter(language, { granularity: 'word' });
  const words = (text: string) =>
    [...segmenter.segment(text.toLocaleLowerCase(language))].filter((s) => s.isWordLike).map((s) => s.segment);
  const known = new Set(userSources.flatMap(words));
  const fresh: string[] = [];
  for (const w of words([cue.mainPoint, cue.opening, cue.fallback].join('\n'))) {
    if (!known.has(w) && !fresh.includes(w)) fresh.push(w);
    if (fresh.length >= max) break;
  }
  return fresh;
}

export function cueCardText(cue: CueFields & { version?: number }, scenarioTitle: string): string {
  const lines = [
    `My cue card${cue.version ? ` (v${cue.version})` : ''}: ${scenarioTitle}`,
    '',
    `Main point: ${cue.mainPoint}`,
  ];
  if (cue.opening) lines.push(`How I might start: ${cue.opening}`);
  if (cue.fallback) lines.push(`If I lose the thread: ${cue.fallback}`);
  return lines.join('\n') + '\n';
}
