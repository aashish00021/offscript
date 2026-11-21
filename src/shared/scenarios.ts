import type { Scenario } from '../core/types';

/** Fictional practice situations. They are examples, not stories about the user. */
export const SCENARIOS: Scenario[] = [
  {
    id: 'late-night-call',
    title: 'Late-night calls from a parent (fictional)',
    counterpartName: 'Amma',
    counterpartRole: 'a parent who often calls after 11 pm to talk through the day',
    situation:
      'A fictional adult wants their parent to stop calling late on work nights, without ending the calls altogether.',
    openingLine: 'You sound tired. I only called to hear your voice. Is that a problem now?',
    exampleThoughts:
      "I love talking to her but the 11:30 calls wreck my sleep before work. I need to say I can't take calls after 10 on weeknights. I don't want to agree to just keeping my phone on all night. I could call her on my way home instead, maybe at 7.",
  },
  {
    id: 'weekend-deadline',
    title: 'Weekend work before a deadline (fictional)',
    counterpartName: 'Ravi',
    counterpartRole: 'a team lead under pressure from a client deadline',
    situation:
      'A fictional employee has been asked to work this weekend for a deadline and wants to keep their weekend free.',
    openingLine:
      "The client moved the review to Monday. I need you on this over the weekend. Saturday at least — that works, right?",
    exampleThoughts:
      "Third weekend in a row. I need to say I'm not available this weekend. I'd prefer not to agree to working Saturday or Sunday. I could stay late Thursday and Friday, or hand over my part with notes by Friday evening.",
  },
];

export function getScenario(id: string | null | undefined): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
