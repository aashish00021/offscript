import { useEffect, useRef, useState } from 'react';
import { verifyCoachFinding, type VerifiedFinding } from '../core/coach';
import { buildCoachRequest } from '../core/requests';
import type { Action } from '../core/session';
import { activeIntention, activePath, childrenOf } from '../core/tree';
import { LIMITS, type Session } from '../core/types';
import { api, isAbort, newId } from './api';

type View =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'none'; reason: string }
  | { kind: 'error'; message: string }
  | { kind: 'found'; f: VerifiedFinding };

/** One observation, only after it's asked for. It cannot change an approved card. */
export function CoachPanel({ s, dispatch }: { s: Session; dispatch: (a: Action) => void }) {
  const [view, setView] = useState<View>({ kind: 'idle' });
  const ctrl = useRef<AbortController | null>(null);
  const sRef = useRef(s);
  sRef.current = s;
  const hasUserTurn = activePath(s).some((m) => m.speaker === 'user');

  useEffect(() => {
    ctrl.current?.abort();
    setView({ kind: 'idle' });
  }, [s.activeLeafId, s.epoch]);

  async function ask() {
    ctrl.current?.abort();
    const leafAtAsk = s.activeLeafId;
    ctrl.current = new AbortController();
    setView({ kind: 'loading' });
    try {
      const { finding } = await api.coach(buildCoachRequest(s, newId()), ctrl.current.signal);
      const now = sRef.current;
      if (now.activeLeafId !== leafAtAsk) return;
      const verified = verifyCoachFinding(now, finding);
      setView(
        verified
          ? { kind: 'found', f: verified }
          : {
              kind: 'none',
              reason: finding ? "That note didn't match your words, so it isn't shown." : 'Nothing to add.',
            },
      );
    } catch (e) {
      if (!isAbort(e)) setView({ kind: 'error', message: (e as Error).message });
    }
  }

  const canFork = (f: VerifiedFinding) =>
    !s.pending && childrenOf(s, f.message.parentId!).length < LIMITS.maxAttemptsPerCheckpoint;

  if (view.kind === 'idle') {
    return (
      <p className="coach-ask">
        <button className="quiet" onClick={ask} disabled={!hasUserTurn || !!s.pending}>
          {hasUserTurn ? 'One observation' : 'Reply once, then you can ask'}
        </button>
      </p>
    );
  }

  return (
    <aside className="observation" aria-live="polite">
      {view.kind === 'loading' && (
        <p>
          Reading what you said…{' '}
          <button
            className="quiet"
            onClick={() => {
              ctrl.current?.abort();
              setView({ kind: 'idle' });
            }}
          >
            Cancel
          </button>
        </p>
      )}
      {view.kind === 'none' && (
        <p>
          {view.reason}{' '}
          <button className="quiet" onClick={() => setView({ kind: 'idle' })}>
            Dismiss
          </button>
        </p>
      )}
      {view.kind === 'error' && (
        <p className="fail" role="alert">
          {view.message}{' '}
          <button className="quiet" onClick={() => setView({ kind: 'idle' })}>
            Dismiss
          </button>
        </p>
      )}
      {view.kind === 'found' && (
        <>
          <blockquote>“{view.f.quote}”</blockquote>
          {view.f.question && <p>{view.f.question}</p>}
          {view.f.note && <p>{view.f.note}</p>}
          {view.f.newerCardVersion && (
            <p className="hint">Compared with card v{view.f.cardVersion}. You have since approved v{view.f.newerCardVersion}.</p>
          )}
          {view.f.suggestion && <p className="hint">You could say: {view.f.suggestion}</p>}
          <div className="row">
            {view.f.kind === 'possible_change' && (
              <button
                onClick={() => {
                  const card = activeIntention(s);
                  if (card) dispatch({ type: 'SET_INTENTION_DRAFT', fields: { ...card } });
                  setView({ kind: 'idle' });
                }}
              >
                I meant to change it
              </button>
            )}
            <button
              disabled={!canFork(view.f) || !view.f.message.parentId}
              onClick={() => {
                const checkpointId = view.f.message.parentId;
                if (!checkpointId) return;
                dispatch({ type: 'START_ALTERNATIVE', checkpointId, draft: view.f.suggestion ?? undefined });
                setView({ kind: 'idle' });
              }}
            >
              Try another reply
            </button>
            <button className="quiet" onClick={() => setView({ kind: 'idle' })}>
              Dismiss
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
