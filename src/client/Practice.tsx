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
import { speaksLanguage, type StatusResponse } from '../shared/api';
import { CoachPanel } from './Coach';
import { DrillPanel } from './Drill';
import { CompactCard } from './IntentionCard';
import { Icon, IconButton } from './icons';
import type { Speaker } from './speech';
import { VoiceMode } from './VoiceMode';

interface Props {
  s: Session;
  dispatch: (a: Action) => void;
  status: StatusResponse | null;
  onSubmit: (text: string, origin: 'typed' | 'speech') => void;
  onCancel: () => void;
  onRetry: () => void;
  speaker: Speaker;
  speakReplies: boolean;
  setSpeakReplies: (v: boolean) => void;
}

/** The rehearsal as a chat: the active attempt top to bottom, a composer at the bottom, and a voice mode. */
export function Practice(p: Props) {
  const { s, dispatch } = p;
  const scenario = s.scenario;
  const path = activePath(s);
  const card = activeIntention(s)!;
  const forkMode = isComposingAlternative(s);
  const leaf = path[path.length - 1];
  const [compareAt, setCompareAt] = useState<string | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [drillId, setDrillId] = useState<string | null>(null);
  const drillFor = drillId ? s.messages[drillId] : undefined;
  const voiceAvailable = !!p.status?.speech.available;
  const spoken = voiceAvailable && speaksLanguage(s.language);

  const compareKids = compareAt ? childrenOf(s, compareAt) : [];
  const comparing = compareKids.length >= 2;

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    endRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' });
  }, [path.length, leaf?.id, s.pending?.requestId]);

  const openVoice = () => {
    p.speaker.unlock();
    p.setSpeakReplies(true);
    setVoiceOpen(true);
  };

  return (
    <div className="rehearsal chat">
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
          <strong>{scenario.counterpartName}</strong>
          <span className="hint"> · {scenario.title}</span>
        </p>
        <div className="tools">
          {spoken && (
            <IconButton
              icon={p.speakReplies ? 'speaker' : 'mute'}
              label={p.speakReplies ? 'Mute spoken replies' : 'Speak replies aloud'}
              aria-pressed={p.speakReplies}
              onClick={() => {
                if (p.speakReplies) p.speaker.stop();
                p.setSpeakReplies(!p.speakReplies);
              }}
            />
          )}
          <IconButton
            icon={s.paused ? 'play' : 'pause'}
            label={s.paused ? 'Resume' : 'Pause'}
            aria-pressed={s.paused}
            onClick={() => dispatch({ type: 'SET_PAUSED', paused: !s.paused })}
          />
          <button className="pill" onClick={() => dispatch({ type: 'GO_TO_PHASE', phase: 'finish' })}>
            <Icon name="flag" /> Cue card
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
          <ol className="thread" aria-label="Conversation">
            {path.map((m) => (
              <Bubble
                key={m.id}
                p={p}
                m={m}
                isLeaf={m.id === leaf.id}
                forkMode={forkMode}
                onCompare={() => setCompareAt(m.id)}
                onDrill={() => setDrillId(m.id)}
              />
            ))}
            {s.pending && s.pending.parentId === leaf.id && (
              <>
                <li className="bubble user pending">
                  <p>{s.pending.text}</p>
                </li>
                <li className="bubble actor typing" role="status" aria-label={`${scenario.counterpartName} is replying`}>
                  <span className="dots" aria-hidden>
                    <i>●</i>
                    <i>●</i>
                    <i>●</i>
                  </span>
                </li>
              </>
            )}
          </ol>
          {drillFor ? (
            <DrillPanel
              s={s}
              reply={drillFor}
              onClose={() => setDrillId(null)}
              onUse={(checkpointId, text) => {
                dispatch({ type: 'START_ALTERNATIVE', checkpointId, draft: text });
                setDrillId(null);
              }}
            />
          ) : (
            <CoachPanel s={s} dispatch={dispatch} onDrill={setDrillId} />
          )}
          <div ref={endRef} className="thread-end" />
          <Composer key={leaf.id} {...p} parentId={leaf.id} forkMode={forkMode} onVoice={openVoice} />
        </>
      )}

      {voiceOpen && (
        <VoiceMode
          s={s}
          speaker={p.speaker}
          onSubmit={(text) => p.onSubmit(text, 'speech')}
          onRetry={p.onRetry}
          onClose={() => setVoiceOpen(false)}
        />
      )}
    </div>
  );
}

function Bubble(props: {
  p: Props;
  m: Message;
  isLeaf: boolean;
  forkMode: boolean;
  onCompare: () => void;
  onDrill: () => void;
}) {
  const { p, m } = props;
  const { s, dispatch } = p;
  if (m.speaker === 'user') {
    const v = getIntention(s, m.intentionVersionId)?.version;
    return (
      <li className="bubble user">
        <p>{m.text}</p>
        <div className="bubble-tools">
          {s.intentions.length > 1 && <span className="hint">card v{v}</span>}
          <IconButton className="small" icon="target" label="Drill this moment" onClick={props.onDrill} />
        </div>
      </li>
    );
  }
  const kids = childrenOf(s, m.id);
  const composingHere = props.forkMode && props.isLeaf;
  const speaking = p.speaker.speakingId === m.id;
  return (
    <li className="bubble actor">
      <span className="who">{s.scenario.counterpartName}</span>
      <p>{m.text}</p>
      <div className="bubble-tools">
        {p.status?.speech.available && speaksLanguage(s.language) && (
          <IconButton
            className="small"
            icon={speaking ? 'stop' : 'speaker'}
            label={speaking ? 'Stop' : 'Play aloud'}
            onClick={() => {
              p.speaker.unlock();
              if (speaking) p.speaker.stop();
              else p.speaker.speak(m.id, m.text, s.scenario.voice);
            }}
          />
        )}
        {(kids.length > 1 || composingHere) && (
          <Rewind s={s} checkpoint={m} dispatch={dispatch} onCompare={props.onCompare} composing={composingHere} />
        )}
        {kids.length === 1 && !s.pending && !composingHere && (
          <IconButton
            className="small"
            icon="rewind"
            label="Reply differently from here"
            onClick={() => dispatch({ type: 'START_ALTERNATIVE', checkpointId: m.id })}
          />
        )}
      </div>
    </li>
  );
}

function Rewind(props: {
  s: Session;
  checkpoint: Message;
  dispatch: (a: Action) => void;
  onCompare: () => void;
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
        <IconButton
          className="small"
          icon="plus"
          label="Try another reply here"
          onClick={() => props.dispatch({ type: 'START_ALTERNATIVE', checkpointId: props.checkpoint.id })}
        />
      )}
      {kids.length >= 2 && <IconButton className="small" icon="compare" label="Compare attempts" onClick={props.onCompare} />}
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
        <IconButton icon="close" label="Close comparison" onClick={props.onClose} />
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

function Composer(p: Props & { parentId: string; forkMode: boolean; onVoice: () => void }) {
  const { s, dispatch } = p;
  const draft = s.drafts[p.parentId] ?? '';
  const blocker = submitBlocker(s);
  const voiceOn = !!p.status?.speech.available;
  const waitingHere = !!s.pending && s.pending.parentId === p.parentId;

  if (s.paused) {
    return (
      <div className="composer paused" role="status">
        <p>Paused. Your draft is kept.</p>
        <IconButton icon="play" label="Resume" className="solid" onClick={() => dispatch({ type: 'SET_PAUSED', paused: false })} />
      </div>
    );
  }

  const send = () => {
    if (blocker || !draft.trim()) return;
    p.speaker.unlock();
    p.speaker.stop();
    p.onSubmit(draft, 'typed');
  };

  const parentKids = childrenOf(s, p.parentId);

  return (
    <div className="composer">
      {p.forkMode && parentKids.length > 0 && (
        <p className="quiet-note fork-note">
          <IconButton
            className="small"
            icon="back"
            label={`Back to ${attemptLabel(parentKids.length - 1)}`}
            onClick={() => dispatch({ type: 'SWITCH_TO', nodeId: parentKids.at(-1)!.id })}
          />
          {attemptLabel(parentKids.length)} starts here. {attemptLabel(parentKids.length - 1)} is kept.
        </p>
      )}
      {s.lastError && (
        <p className="fail" role="alert">
          {s.lastError}
          <button onClick={p.onRetry} disabled={!draft.trim()}>
            Try again
          </button>
          <IconButton icon="close" label="Dismiss" className="small" onClick={() => dispatch({ type: 'CLEAR_ERROR' })} />
        </p>
      )}
      {p.speaker.error && (
        <p className="fail" role="alert">
          {p.speaker.error}
        </p>
      )}
      {blocker && !s.pending && !s.lastError && <p className="hint">{blocker}</p>}

      <div className="composer-box">
        <label htmlFor="reply" className="sr">
          Your reply
        </label>
        <textarea
          id="reply"
          rows={1}
          maxLength={LIMITS.maxMessageChars}
          value={waitingHere ? '' : draft}
          placeholder={waitingHere ? `Waiting for ${s.scenario.counterpartName}…` : 'Type what you would say'}
          readOnly={waitingHere}
          aria-invalid={!!s.lastError}
          onChange={(e) => dispatch({ type: 'SET_DRAFT', nodeId: p.parentId, text: e.target.value })}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter is a new line. Never send mid-composition (Hindi and other IMEs).
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="composer-actions">
          {voiceOn && (
            <IconButton
              icon="wave"
              className="voice-open"
              label="Talk face to face (voice mode)"
              onClick={p.onVoice}
              disabled={!!blocker && !s.pending}
            />
          )}
          {waitingHere ? (
            <IconButton icon="stop" label="Cancel" className="solid" onClick={p.onCancel} />
          ) : (
            <IconButton icon="send" label="Send" className="solid" onClick={send} disabled={!!blocker || !draft.trim()} />
          )}
        </div>
      </div>
    </div>
  );
}
