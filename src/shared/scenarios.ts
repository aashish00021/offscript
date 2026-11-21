import type { Scenario } from '../core/types.js';

/**
 * Example situations. They only prefill the setup form; the user can edit every
 * field, and every reply in practice is generated live from what is in the form.
 */
interface Example {
  label: string;
  scenario: Scenario;
  /** Sample "what's on your mind" notes for the card step. */
  thoughts: string;
  /** Opening line by language code. Other languages leave it blank so the model opens in that language. */
  openingLines: Partial<Record<string, string>>;
}

export const EXAMPLES: Example[] = [
  {
    label: 'Late-night calls from a parent',
    scenario: {
      title: 'Late-night calls from my mother',
      counterpartName: 'Amma',
      counterpartRole: 'my mother, who often calls after 11 pm to talk through her day',
      situation:
        'I want her to stop calling late on work nights, without ending our calls altogether. The late calls wreck my sleep before work.',
      openingLine: '',
      voice: 'priya',
    },
    thoughts:
      "I love talking to her but the 11:30 calls wreck my sleep before work. I need to say I can't take calls after 10 on weeknights. I don't want to agree to just keeping my phone on all night. I could call her on my way home instead, maybe at 7.",
    openingLines: {
      'en-IN': 'You sound tired. I only called to hear your voice. Is that a problem now?',
      'hi-IN': 'तुम्हारी आवाज़ में थकान है। मैंने तो बस तुम्हारी आवाज़ सुनने के लिए फ़ोन किया था। अब ये भी परेशानी है क्या?',
    },
  },
  {
    label: 'Weekend work before a deadline',
    scenario: {
      title: 'Saying no to weekend work',
      counterpartName: 'Ravi',
      counterpartRole: 'my team lead, under pressure from a client deadline',
      situation:
        'He has asked me to work this weekend for a client review on Monday. It would be my third weekend in a row and I want to keep this one free.',
      openingLine: '',
      voice: 'shubh',
    },
    thoughts:
      "Third weekend in a row. I need to say I'm not available this weekend. I'd prefer not to agree to working Saturday or Sunday. I could stay late Thursday and Friday, or hand over my part with notes by Friday evening.",
    openingLines: {
      'en-IN': 'The client moved the review to Monday. I need you on this over the weekend. Saturday at least — that works, right?',
      'hi-IN': 'क्लाइंट ने रिव्यू सोमवार को कर दिया है। इस वीकेंड मुझे तुम्हारी ज़रूरत है। कम से कम शनिवार — चलेगा ना?',
    },
  },
];

/** The example's scenario with an opening line in `language`, or blank so the model writes one in that language. */
export function exampleScenario(ex: Example, language: string): Scenario {
  return { ...ex.scenario, openingLine: ex.openingLines[language] ?? '' };
}
