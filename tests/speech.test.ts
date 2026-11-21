import { describe, expect, it } from 'vitest';
import { splitForSpeech } from '../src/client/speech';

describe('splitForSpeech', () => {
  it('speaks the first sentence on its own so audio can start early', () => {
    expect(splitForSpeech('I hear you, but the deadline is locked. Can you do Saturday? Even a few hours.')).toEqual([
      'I hear you, but the deadline is locked.',
      'Can you do Saturday? Even a few hours.',
    ]);
  });

  it('merges a very short first sentence and handles the Hindi danda', () => {
    expect(splitForSpeech('Okay. But the client moved the review to Monday.')).toEqual([
      'Okay. But the client moved the review to Monday.',
    ]);
    expect(splitForSpeech('मैं समझता हूँ, पर डेडलाइन तय है। क्या तुम शनिवार आ सकते हो?', 'hi-IN')).toEqual([
      'मैं समझता हूँ, पर डेडलाइन तय है।',
      'क्या तुम शनिवार आ सकते हो?',
    ]);
  });

  it('returns nothing for empty text', () => {
    expect(splitForSpeech('   ')).toEqual([]);
  });
});
