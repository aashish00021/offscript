import type { IntentionVersion, Message, Session } from './types';

/** Root-to-node path. Siblings and descendants are never included. */
export function pathTo(s: Session, nodeId: string | null): Message[] {
  const out: Message[] = [];
  const seen = new Set<string>();
  let cur = nodeId ? s.messages[nodeId] : undefined;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.push(cur);
    cur = cur.parentId ? s.messages[cur.parentId] : undefined;
  }
  return out.reverse();
}

export function activePath(s: Session): Message[] {
  return pathTo(s, s.activeLeafId);
}

export function childrenOf(s: Session, nodeId: string): Message[] {
  return Object.values(s.messages)
    .filter((m) => m.parentId === nodeId)
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

export function attemptLabel(index: number): string {
  return `Attempt ${String.fromCharCode(65 + index)}`;
}

/** Follow most-recently-visited children down to a leaf. */
export function descendToLeaf(s: Session, nodeId: string): string {
  let cur = nodeId;
  const seen = new Set<string>();
  while (!seen.has(cur)) {
    seen.add(cur);
    const kids = childrenOf(s, cur);
    if (kids.length === 0) break;
    const remembered = s.lastChild[cur];
    cur = kids.some((k) => k.id === remembered) ? remembered : kids[kids.length - 1].id;
  }
  return cur;
}

export function getIntention(s: Session, id: string | undefined): IntentionVersion | undefined {
  return id ? s.intentions.find((v) => v.id === id) : undefined;
}

export function latestIntention(s: Session): IntentionVersion | undefined {
  return s.intentions[s.intentions.length - 1];
}

/** The approved card that applies when continuing from `nodeId`. */
export function intentionForNode(s: Session, nodeId: string | null): IntentionVersion | undefined {
  if (!nodeId) return latestIntention(s);
  const override = s.intentionAtNode[nodeId];
  if (override) return getIntention(s, override);
  return getIntention(s, s.messages[nodeId]?.intentionVersionId);
}

export function activeIntention(s: Session): IntentionVersion | undefined {
  return intentionForNode(s, s.activeLeafId);
}

export function userTurnCount(s: Session, nodeId: string | null): number {
  return pathTo(s, nodeId).filter((m) => m.speaker === 'user').length;
}

/** True when the active leaf is an actor turn that already has replies (fork mode). */
export function isComposingAlternative(s: Session): boolean {
  const leaf = s.activeLeafId ? s.messages[s.activeLeafId] : undefined;
  return !!leaf && leaf.speaker === 'actor' && childrenOf(s, leaf.id).length > 0;
}
