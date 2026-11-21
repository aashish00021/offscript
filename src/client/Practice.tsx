import { useState } from 'react';
import { submitBlocker, type Action } from '../core/session';
import {
  activeIntention,
  activePath,
  attemptLabel,
  childrenOf,
  getIntention,
  isComposingAlternative,
} from '../core/tree';
import { LIMITS, type Message, type Session } from '../core/types';
import type { StatusResponse } from '../shared/api';
import { getScenario } from '../shared/scenarios';
import { CoachPanel } from './Coach';
import { CompactCard } from './IntentionCard';
import { useRecorder } from './speech';

interface Props {
  s: Session;
  dispatch: (a: Action) => void;
  status: StatusResponse | null;
  onSubmit: (text: string, origin: 'typed' | 'speech') => void;
  onCancel: () => void;
  onRetry: () => void;
  speaker: { speakingId: string | null; stop: () => void; error: string | null; speak: (id: string, t: string) => void };
  speakReplies: boolean;
  setSpeakReplies: (v: boolean) => void;
}

export function Practice(p: Props) {
  const { s, dispatch } = p;
  const scenario = getScenario(s.scenarioId)!;
  const path = activePath(s);
  const card = activeIntention(s)!;
  const forkMode = isComposingAlternative(s);
  const [compareAt, setCompareAt] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const focus = [...path].reverse().find((m) => m.speaker === 'actor')!;
  const earlier = path.slice(0, path.indexOf(focus));
  const kids = childrenOf(s, focus.id);
  const branchPoint =
    [...path].reverse().find((m) => m.speaker === 'actor' && childrenOf(s, m.id).length > 1) ??
    (forkMode || kids.length > 0 ? focus : undefined);
  const compareKids = compareAt ? childrenOf(s, compareAt) : [];
  const comparing = compareKids.length >= 2;
  const pendingHere = s.pending?.parentId === focus.id;

  return (
    <div className="rehearsal">
      <CompactCard
        card={card}
        history={s.intentions}
        draft={s.intentionDraft}
        onEdit={() => dispatch({ type: 'SET_INTENTION_DRAFT', fields: { ...card } })}
        onDraftChange={(fields) => dispatch({ type: 'SET_INTENTION_DRAFT', fields })}
        onApprove={() =>
          s.intentionDraft &&
          dispatch({ type: 'APPROVE_INTENTION', id: crypto.randomUUID(), fields: s.intentionDraft, now: Date.now() })
        }
        disabled={!!s.pending}
      />

      <header className="scene">
        <p>
          With {scenario.counterpartName}, fictional.
        </p>
        <div className="row">
          <button className="quiet" onClick={() => dispatch({ type: 'SET_PAUSED', paused: !s.paused })} aria-pressed={s.paused}>
            {s.paused ? 'Resume' : 'Pause'}
          </button>
          <button className="quiet" onClick={() => dispatch({ type: 'GO_TO_PHASE', phase: 'finish' })}>
            Keep a cue card
          </button>
        </div>
      </header>

      {comparing ? (
        <Compare
          s={s}
          kids={compareKids}
          name={scenario.counterpartName}
          onClose={() => setCompareAt(null)}
          onOpen={(id) => {
            dispatch({ type: 'SWITCH_TO', nodeId: id });
            setCompareAt(null);
          }}
        />
      ) : (
        <>
          {earlier.length > 0 && (
            <div className="earlier">
              <button className="quiet" aria-expanded={historyOpen} onClick={() => setHistoryOpen(!historyOpen)}>
                {historyOpen ? 'Hide' : 'Earlier'} ({earlier.length})
              </button>
              {historyOpen && (
                <ol>
                  {earlier.map((m) => (
                    <li key={m.id} className={m.speaker}>
                      <span className="who">{m.speaker === 'user' ? 'You' : scenario.counterpartName}</span>
                      <p>{m.text}</p>
                      {m.speaker === 'actor' && m.id !== branchPoint?.id && (
                        <Rewind s={s} checkpoint={m} dispatch={dispatch} onCompare={() => setCompareAt(m.id)} />
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <blockquote className="the-line">
            <p>{focus.text}</p>
            <footer>{scenario.counterpartName}</footer>
          </blockquote>

          {p.status?.speech.available && (
            <button className="quiet tiny" onClick={() => (p.speaker.speakingId === focus.id ? p.speaker.stop() : p.speaker.speak(focus.id, focus.text))}>
              {p.speaker.speakingId === focus.id ? 'Stop' : 'Hear this'}
            </button>
          )}

          {branchPoint && (
            <Rewind
              s={s}
              checkpoint={branchPoint}
              dispatch={dispatch}
              prominent
              onCompare={() => setCompareAt(branchPoint.id)}
              composing={forkMode && branchPoint.id === focus.id}
            />
          )}

          {pendingHere && <p className="waiting">You: {s.pending!.text}</p>}

          <Composer {...p} parentId={focus.id} forkMode={forkMode} savedCount={kids.length} />
          <CoachPanel s={s} dispatch={dispatch} />
        </>
      )}
    </div>
  );
}

function Rewind(props: {
  s: Session;
  checkpoint: Message;
  dispatch: (a: Action) => void;
  onCompare: () => void;
  prominent?: boolean;
  composing?: boolean;
}) {
  const kids = childrenOf(props.s, props.checkpoint.id);
  if (kids.length === 0 && !props.composing) return null;
  const path = activePath(props.s);
  const activeChild = path.find((m) => m.parentId === props.checkpoint.id);
  const canAdd = kids.length < LIMITS.maxAttemptsPerCheckpoint && !props.s.pending && !props.composing;
  return (
    <div className="switcher" role="group" aria-label="Your replies here">
      {kids.map((k, i) => (
        <button
          key={k.id}
          className={k.id === activeChild?.id && !props.composing ? 'on' : ''}
          aria-pressed={k.id === activeChild?.id && !props.composing}
          onClick={() => props.dispatch({ type: 'SWITCH_TO', nodeId: k.id })}
        >
          {attemptLabel(i)}
          <span className="hint"> v{getIntention(props.s, k.intentionVersionId)?.version}</span>
        </button>
      ))}
      {props.composing && <span className="on draft">{attemptLabel(kids.length)}, unsent</span>}
      {canAdd && kids.length > 0 && (
        <button className="quiet" onClick={() => props.dispatch({ type: 'START_ALTERNATIVE', checkpointId: props.checkpoint.id })}>
          Try another reply
        </button>
      )}
      {kids.length >= 2 && (
        <button className="quiet" onClick={props.onCompare}>
          Compare
        </button>
      )}
    </div>
  );
}

function Compare(props: {
  s: Session;
  kids: Message[];
  name: string;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <section className="compare" aria-label="Two replies from the same moment">
      <div className="row">
        <p className="hint">Same moment. A different reply here is not proof of what would happen.</p>
        <button className="quiet" onClick={props.onClose}>
          Close
        </button>
      </div>
      <div className="compare-grid">
        {props.kids.map((k, i) => {
          const reaction = childrenOf(props.s, k.id)[0];
          const kept = Object.values(props.s.messages).filter((m) => m.parentId === reaction?.id).length;
          return (
            <article key={k.id}>
              <h2>
                {attemptLabel(i)}
                <span className="hint"> card v{getIntention(props.s, k.intentionVersionId)?.version}</span>
              </h2>
              <p className="you-said">{k.text}</p>
              {reaction && (
                <p className="they-said">
                  <span className="who">{props.name}</span>
                  {reaction.text}
                </p>
              )}
              {kept > 0 && <p className="hint">This attempt continues.</p>}
              <button onClick={() => props.onOpen(k.id)}>Open {attemptLabel(i)}</button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Composer(p: Props & { parentId: string; forkMode: boolean; savedCount: number }) {
  const { s, dispatch } = p;
  const draft = s.drafts[p.parentId] ?? '';
  const [fromSpeech, setFromSpeech] = useState(false);
  const blocker = submitBlocker(s);
  const rec = useRecorder(s.language, (t) => {
    dispatch({ type: 'SET_DRAFT', nodeId: p.parentId, text: draft ? `${draft} ${t}` : t });
    setFromSpeech(true);
  });
  const recording = rec.state.kind === 'recording' || rec.state.kind === 'requesting';
  const waitingHere = !!s.pending && s.pending.parentId === p.parentId;

  if (s.paused) {
    return (
      <div className="composer" role="status">
        <p>Paused. Your draft is kept.</p>
        <button className="primary" onClick={() => dispatch({ type: 'SET_PAUSED', paused: false })}>
          Resume
        </button>
      </div>
    );
  }

  const send = () => {
    if (blocker || !draft.trim() || recording) return;
    p.onSubmit(draft, fromSpeech ? 'speech' : 'typed');
    setFromSpeech(false);
  };

  return (
    <div className="composer">
      {p.forkMode && (
        <p className="quiet-note">
          {attemptLabel(p.savedCount)} starts here. {attemptLabel(p.savedCount - 1)} is kept.{' '}
          <button className="quiet" onClick={() => dispatch({ type: 'SWITCH_TO', nodeId: childrenOf(s, p.parentId).at(-1)!.id })}>
            Back
          </button>
        </p>
      )}
      {s.lastError && (
        <p className="fail" role="alert">
          {s.lastError} Your reply is still here.
          <button onClick={p.onRetry} disabled={!draft.trim()}>
            Try again
          </button>
          <button className="quiet" onClick={() => dispatch({ type: 'CLEAR_ERROR' })}>
            Dismiss
          </button>
        </p>
      )}
      <label htmlFor="reply" className="sr">
        Your reply
      </label>
      <textarea
        id="reply"
        rows={4}
        maxLength={LIMITS.maxMessageChars}
        value={draft}
        placeholder="What would you say?"
        readOnly={waitingHere}
        aria-invalid={!!s.lastError}
        onChange={(e) => {
          setFromSpeech(false);
          dispatch({ type: 'SET_DRAFT', nodeId: p.parentId, text: e.target.value });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
          }
        }}
      />
      {fromSpeech && <p className="quiet-note">Check the transcript. Nothing is sent until you say it.</p>}
      {rec.state.kind === 'recording' && (
        <p className="recording" role="status">
          <span className="dot" aria-hidden /> Recording {rec.state.seconds}s of {rec.maxSeconds}
        </p>
      )}
      {rec.state.kind === 'transcribing' && <p role="status">Transcribing…</p>}
      {rec.state.kind === 'error' && (
        <p className="fail" role="alert">
          {rec.state.message}
        </p>
      )}
      {p.speaker.error && (
        <p className="fail" role="alert">
          {p.speaker.error}
        </p>
      )}
      <div className="composer-bar">
        <span className="hint" aria-live="polite">
          {waitingHere ? 'Waiting for a reply' : blocker && !s.pending ? blocker : `${draft.length} / ${LIMITS.maxMessageChars}`}
        </span>
        <span className="row">
          {p.status?.speech.available && rec.state.kind !== 'recording' && rec.state.kind !== 'transcribing' && (
            <button className="quiet" onClick={rec.start} disabled={waitingHere || rec.state.kind === 'requesting'}>
              {rec.state.kind === 'requesting' ? 'Microphone…' : 'Record'}
            </button>
          )}
          {rec.state.kind === 'recording' && (
            <button className="quiet" onClick={rec.stop}>
              Stop
            </button>
          )}
          {rec.state.kind === 'transcribing' && (
            <button className="quiet" onClick={rec.cancel}>
              Cancel
            </button>
          )}
          {waitingHere && (
            <button className="quiet" onClick={p.onCancel}>
              Cancel
            </button>
          )}
          <button className="primary" onClick={send} disabled={!!blocker || !draft.trim() || recording}>
            {waitingHere ? 'Sending' : 'Say this'}
          </button>
        </span>
      </div>
    </div>
  );
}
