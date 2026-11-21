import { useEffect, useRef, useState } from 'react';
import { submitBlocker } from '../core/session';
import { activeIntention, activePath } from '../core/tree';
import { speaksLanguage } from '../shared/api';
import type { Session } from '../core/types';
import { IconButton } from './icons';
import { useRecorder, type Speaker } from './speech';

type Phase = 'listening' | 'thinking' | 'speaking' | 'idle';

/**
 * Hands-free conversation: listen → send → the other person replies aloud → listen
 * again. The orb shows whose turn it is and moves with the live voice level. The
 * transcript behind it keeps every line, so nothing here bypasses the chat state.
 */
export function VoiceMode(props: {
  s: Session;
  speaker: Speaker;
  onSubmit: (text: string, origin: 'speech') => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const { s, speaker } = props;
  const name = s.scenario.counterpartName;
  const [handsFree, setHandsFree] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [heard, setHeard] = useState<string | null>(null);

  const rec = useRecorder(s.language, (t) => {
    const text = t.trim();
    if (!text) {
      setNote("Didn't catch that. Tap the orb and try again.");
      setHandsFree(false);
      return;
    }
    setHeard(text);
    props.onSubmit(text, 'speech');
  });

  const blocker = submitBlocker(s);
  const listening = rec.state.kind === 'recording' || rec.state.kind === 'requesting';
  const thinking = rec.state.kind === 'transcribing' || !!s.pending;
  const speaking = !!speaker.speakingId;
  const phase: Phase = listening ? 'listening' : thinking ? 'thinking' : speaking ? 'speaking' : 'idle';
  const recError = rec.state.kind === 'error' ? rec.state.message : null;
  // A failed reply or recording stops the loop until the user acts; a playback error doesn't.
  const blocking = s.lastError || recError;
  const failed = blocking || speaker.error;

  // The loop: whenever nobody is talking or thinking, start listening again.
  const { start, cancel } = rec;
  useEffect(() => {
    if (!handsFree || phase !== 'idle' || blocker || blocking) return;
    const t = window.setTimeout(() => {
      setNote(null);
      start();
    }, 350);
    return () => window.clearTimeout(t);
  }, [handsFree, phase, blocker, blocking, start]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props]);

  const lastLine = [...activePath(s)].reverse().find((m) => m.speaker === 'actor');
  const card = activeIntention(s);

  const tapOrb = () => {
    speaker.unlock();
    if (phase === 'listening') return rec.stop(); // done talking: send now
    if (phase === 'speaking') return speaker.stop(); // skip the rest of their line
    if (phase === 'idle') {
      setNote(null);
      setHandsFree(true);
      if (s.lastError || blocker) return; // a failed reply needs "Try again" first
      start(); // also clears a previous recording error
    }
  };

  const status =
    phase === 'listening'
      ? 'Listening… pause when you’re done'
      : phase === 'thinking'
        ? rec.state.kind === 'transcribing'
          ? 'Got it…'
          : `${name} is thinking…`
        : phase === 'speaking'
          ? `${name} is speaking`
          : blocker
            ? blocker
            : handsFree
              ? 'Your turn'
              : 'Paused. Tap the orb to talk.';

  return (
    <div className="voice" role="dialog" aria-modal="true" aria-label={`Voice conversation with ${name}`}>
      <header className="voice-top">
        <div>
          <p className="voice-name">{name}</p>
          <p className="hint">{s.scenario.title}</p>
        </div>
        {card && (
          <p className="voice-card">
            <span className="hint">Your point</span>
            {card.needToSay}
          </p>
        )}
      </header>

      <button
        type="button"
        className={`orb-button ${phase}`}
        onClick={tapOrb}
        aria-label={phase === 'listening' ? 'Done talking' : phase === 'speaking' ? 'Skip' : 'Talk'}
      >
        <Orb phase={phase} getLevel={phase === 'listening' ? rec.getLevel : speaker.getLevel} />
      </button>

      <div className="voice-caption" aria-live="polite">
        <p className="voice-status">{status}</p>
        {phase === 'thinking' && heard && <p className="voice-heard">“{heard}”</p>}
        {phase !== 'thinking' && lastLine && <p className="voice-line">{lastLine.text}</p>}
        {!speaksLanguage(s.language) && <p className="hint">{name}'s replies appear as text in this language.</p>}
        {note && <p className="hint">{note}</p>}
        {failed && (
          <p className="fail" role="alert">
            {failed}
            {s.lastError && (
              <button onClick={props.onRetry} type="button">
                Try again
              </button>
            )}
          </p>
        )}
      </div>

      <footer className="voice-controls">
        <IconButton
          icon={handsFree ? 'pause' : 'play'}
          label={handsFree ? 'Pause listening' : 'Resume listening'}
          className="big"
          onClick={() => {
            if (handsFree) {
              cancel();
              setHandsFree(false);
            } else {
              setNote(null);
              setHandsFree(true);
            }
          }}
        />
        <IconButton icon="close" label="End voice" className="big end" onClick={props.onClose} />
      </footer>
    </div>
  );
}

/** A soft sphere that swells with the live level. Animated with rAF, outside React renders. */
function Orb({ phase, getLevel }: { phase: Phase; getLevel: () => number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = 0;
    let smooth = 0;
    const tick = () => {
      const target = phase === 'listening' || phase === 'speaking' ? getLevel() : 0;
      smooth += (target - smooth) * 0.25;
      ref.current?.style.setProperty('--lvl', smooth.toFixed(3));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, getLevel]);
  return <span ref={ref} className="orb" aria-hidden />;
}
