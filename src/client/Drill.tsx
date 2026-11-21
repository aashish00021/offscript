import { useEffect, useRef, useState } from 'react';
import { buildDrillRequest } from '../core/requests';
import { childrenOf } from '../core/tree';
import { LIMITS, type Message, type Session } from '../core/types';
import type { DrillOption } from '../shared/api';
import { api, isAbort, newId } from './api';
import { Icon, IconButton } from './icons';

type View = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; options: DrillOption[]; picked: number | null };

const shuffle = <T,>(xs: T[]) => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);

/**
 * One moment, three replies: one keeps your point, one gives in, one is vague. Pick the
 * one that holds, see why each works or doesn't, then try it for real from that moment.
 */
export function DrillPanel(props: {
  s: Session;
  reply: Message;
  onClose: () => void;
  onUse: (checkpointId: string, text: string) => void;
}) {
  const { s, reply } = props;
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const their = reply.parentId ? s.messages[reply.parentId] : undefined;
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    ref.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  }, [reply.id, view.kind]);

  useEffect(() => {
    const ctrl = new AbortController();
    setView({ kind: 'loading' });
    try {
      api.drill(buildDrillRequest(s, reply, newId()), ctrl.signal).then(
        ({ options }) => setView({ kind: 'ready', options: shuffle(options), picked: null }),
        (e) => !isAbort(e) && setView({ kind: 'error', message: (e as Error).message }),
      );
    } catch (e) {
      setView({ kind: 'error', message: (e as Error).message });
    }
    return () => ctrl.abort();
    // A drill is built once per reply (or per retry); later chat changes don't rebuild it.
  }, [reply.id, attempt]);

  const canUse = !!their && !s.pending && childrenOf(s, their.id).length < LIMITS.maxAttemptsPerCheckpoint;

  return (
    <aside ref={ref} className="drill" aria-label="Drill">
      <header className="drill-head">
        <span className="drill-title">
          <Icon name="target" /> Drill this moment
        </span>
        <IconButton icon="close" label="Close drill" className="small" onClick={props.onClose} />
      </header>
      {their && (
        <p className="drill-their">
          <span className="who">{s.scenario.counterpartName}</span>
          {their.text}
        </p>
      )}

      {view.kind === 'loading' && <p className="hint">Building three replies…</p>}
      {view.kind === 'error' && (
        <p className="fail" role="alert">
          {view.message}
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </p>
      )}
      {view.kind === 'ready' && (
        <>
          <p className="drill-ask">Which reply keeps your point?</p>
          <ol className="drill-options">
            {view.options.map((o, i) => {
              const picked = view.picked === i;
              const done = view.picked !== null;
              return (
                <li key={i}>
                  <button
                    type="button"
                    className={`drill-option${done ? ` shown ${o.kind}` : ''}${picked ? ' picked' : ''}`}
                    aria-pressed={picked}
                    disabled={done}
                    onClick={() => setView({ ...view, picked: i })}
                  >
                    <span className="drill-text">{o.text}</span>
                    {done && (
                      <span className="drill-why">
                        {o.kind === 'holds' && <Icon name="check" />} {o.why}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
          {view.picked !== null && (
            <div className="drill-result" role="status">
              <p>
                {view.options[view.picked].kind === 'holds'
                  ? 'Yes. That one keeps your point.'
                  : 'Not quite. The one with the tick keeps your point.'}
              </p>
              <div className="row">
                <button
                  type="button"
                  className="primary"
                  disabled={!canUse}
                  onClick={() => their && props.onUse(their.id, view.options.find((o) => o.kind === 'holds')!.text)}
                >
                  <Icon name="rewind" /> Try it from here
                </button>
                <IconButton icon="plus" label="Another drill for this moment" onClick={() => setAttempt((n) => n + 1)} />
              </div>
              <p className="hint">You said: “{reply.text}”</p>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
