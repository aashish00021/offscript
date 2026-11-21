import { useEffect, useRef, useState } from 'react';
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
  speaker: {
    speakingId: string | null;
    stop: () => void;
    unlock: () => void;
    error: string | null;
    speak: (id: string, t: string, voice?: string) => void;
  };
  speakReplies: boolean;
  setSpeakReplies: (v: boolean) => void;
}

export function Practice(p: Props) {
  const { s, dispatch } = p;
  const scenario = s.scenario;
  const path = activePath(s);
  const card = activeIntention(s)!;
  const forkMode = isComposingAlternative(s);
  const [compareAt, setCompareAt] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const focus = [...path].reverse().find((m) => m.speaker === 'actor')!;
  const before = path[path.indexOf(focus) - 1];
  const lastYou = before?.speaker === 'user' ? before : undefined;
  const earlier = path.slice(0, path.indexOf(focus) - (lastYou ? 1 : 0));
  const lineRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Keep the new line and the composer in view after each reply.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    lineRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, [focus.id]);
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
          With {scenario.counterpartName}
          <span className="hint">, {scenario.title}</span>
        </p>
        <div className="row">
          {p.status?.speech.available && (
            <label className="toggle">
              <input
                type="checkbox"
                checked={p.speakReplies}
                onChange={(e) => {
                  if (!e.target.checked) p.speaker.stop();
                  p.setSpeakReplies(e.target.checked);
                }}
              />
              Speak replies
            </label>
          )}
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
                      {m.speaker === 'actor' && m.id !== branchPoint?.id && childrenOf(s, m.id).length > 1 && (
                        <Rewind s={s} checkpoint={m} dispatch={dispatch} onCompare={() => setCompareAt(m.id)} />
                      )}
                      {m.speaker === 'actor' &&
                        m.id !== branchPoint?.id &&
                        childrenOf(s, m.id).length === 1 &&
                        !s.pending && (
                          <button
                            className="quiet tiny"
                            onClick={() => dispatch({ type: 'START_ALTERNATIVE', checkpointId: m.id })}
                          >
                            Reply differently here
                          </button>
                        )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <div ref={lineRef} className="line-anchor" />
          {lastYou && !forkMode && (
            <p className="you-last">
              <span className="who">You</span>
              {lastYou.text}
            </p>
          )}
          <blockquote className={`the-line${focus.text.length > 140 ? ' long' : ''}`}>
            <p>{focus.text}</p>
            <footer>{scenario.counterpartName}</footer>
          </blockquote>

          {p.status?.speech.available && p.speaker.speakingId === focus.id && (
            <p className="recording" role="status">
              <span className="dot" aria-hidden /> {scenario.counterpartName} is speaking
              <button className="quiet" onClick={p.speaker.stop}>
                Stop
              </button>
            </p>
          )}
          {p.status?.speech.available && p.speaker.speakingId !== focus.id && (
            <button className="quiet tiny" onClick={() => p.speaker.speak(focus.id, focus.text, scenario.voice)}>
              Hear this
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

          {pendingHere && (
            <div className="waiting" role="status">
              <p className="you-last">
                <span className="who">You</span>
                {s.pending!.text}
              </p>
              <p className="thinking">
                {scenario.counterpartName} is replying<span className="dots" aria-hidden><i>.</i><i>.</i><i>.</i></span>
              </p>
            </div>
          )}

          <Composer key={focus.id} {...p} parentId={focus.id} forkMode={forkMode} savedCount={kids.length} />
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
  const [heardNothing, setHeardNothing] = useState(false);
  const blocker = submitBlocker(s);
  const voiceOn = !!p.status?.speech.available;
  const rec = useRecorder(s.language, (t) => {
    const heard = t.trim();
    if (!heard) return setHeardNothing(true);
    // Anything typed is kept and sent first, then what was heard. A draft left over from an
    // earlier (failed or cancelled) spoken send is replaced, so it isn't sent twice.
    const text = draft.trim() && !fromSpeech ? `${draft.trim()} ${heard}` : heard;
    dispatch({ type: 'SET_DRAFT', nodeId: p.parentId, text });
    setFromSpeech(true);
    p.onSubmit(text, 'speech');
  });
  const recording = rec.state.kind === 'recording' || rec.state.kind === 'requesting';
  const waitingHere = !!s.pending && s.pending.parentId === p.parentId;
  const { cancel: cancelRec } = rec;
  useEffect(() => {
    if (s.paused) cancelRec();
  }, [s.paused, cancelRec]);

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
    p.speaker.unlock();
    p.speaker.stop();
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
        rows={voiceOn ? 2 : 4}
        maxLength={LIMITS.maxMessageChars}
        value={waitingHere ? '' : draft}
        placeholder={waitingHere ? '' : voiceOn ? 'Say it the way you would.' : 'What would you say?'}
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
      {fromSpeech && !waitingHere && <p className="quiet-note">That is what was heard.</p>}
      {rec.state.kind === 'recording' && (
        <p className="recording" role="status">
          <span className="dot" aria-hidden /> Listening. A pause sends it.
          <span className="meter" aria-hidden>
            <span style={{ transform: `scaleX(${rec.state.level})` }} />
          </span>
        </p>
      )}
      {rec.state.kind === 'transcribing' && <p role="status">Transcribing…</p>}
      {heardNothing && rec.state.kind === 'idle' && <p className="quiet-note">Didn't catch that. Tap Talk and try again, or type.</p>}
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
          {waitingHere
            ? 'Waiting for a reply'
            : blocker && !s.pending
              ? blocker
              : voiceOn
                ? 'Talk about it. A short pause hands it over.'
                : `${draft.length} / ${LIMITS.maxMessageChars}`}
        </span>
        <span className="row">
          {voiceOn && rec.state.kind !== 'recording' && rec.state.kind !== 'transcribing' && (
            <button
              className="primary"
              onClick={() => {
                p.speaker.unlock();
                p.speaker.stop();
                setHeardNothing(false);
                rec.start();
              }}
              disabled={waitingHere || !!blocker || rec.state.kind === 'requesting'}
            >
              {rec.state.kind === 'requesting' ? 'Microphone…' : 'Talk'}
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
          <button className={voiceOn ? 'quiet' : 'primary'} onClick={send} disabled={!!blocker || !draft.trim() || recording}>
            {waitingHere ? 'Sending' : 'Say this'}
          </button>
        </span>
      </div>
    </div>
  );
}
