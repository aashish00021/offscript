export type Speaker = 'user' | 'actor';

export interface IntentionFields {
  needToSay: string;
  preferNotToAgree: string;
  couldOffer: string;
}

export interface IntentionVersion extends IntentionFields {
  id: string;
  version: number;
  approvedAt: number;
}

export interface Message {
  id: string;
  parentId: string | null;
  speaker: Speaker;
  text: string;
  /** Approved intention version in effect when this message was created. */
  intentionVersionId: string;
  createdAt: number;
  origin: 'scenario' | 'typed' | 'speech' | 'model';
}

export interface Scenario {
  id: string;
  title: string;
  counterpartName: string;
  counterpartRole: string;
  situation: string;
  openingLine: string;
  exampleThoughts: string;
}

export interface CueFields {
  mainPoint: string;
  opening: string;
  fallback: string;
}

export interface ApprovedCue extends CueFields {
  id: string;
  version: number;
  approvedAt: number;
  intentionVersionId: string;
}

export interface PendingTurn {
  requestId: string;
  parentId: string;
  text: string;
  origin: 'typed' | 'speech';
}

export type Phase = 'setup' | 'practice' | 'finish';

export interface Session {
  /** Incremented on reset; responses from an older epoch are dropped. */
  epoch: number;
  phase: Phase;
  scenarioId: string | null;
  language: string;
  messyThoughts: string;
  /** Editable, NOT approved. Only APPROVE_INTENTION turns it into a version. */
  intentionDraft: IntentionFields | null;
  intentions: IntentionVersion[];
  /** Intention version approved while standing at a node; applies from that node onward. */
  intentionAtNode: Record<string, string>;
  messages: Record<string, Message>;
  rootId: string | null;
  activeLeafId: string | null;
  /** parent id -> most recently visited child, used to restore a full branch. */
  lastChild: Record<string, string>;
  pending: PendingTurn | null;
  drafts: Record<string, string>;
  completedRequestIds: string[];
  lastError: string | null;
  paused: boolean;
  cueDraft: CueFields | null;
  cues: ApprovedCue[];
}

export const LIMITS = {
  maxUserTurnsPerBranch: 6,
  maxAttemptsPerCheckpoint: 3,
  maxMessageChars: 600,
  maxThoughtsChars: 2000,
  maxFieldChars: 300,
} as const;
