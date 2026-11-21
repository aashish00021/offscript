import { useCallback, useEffect, useRef, useState } from 'react';
import { buildActorRequest } from '../core/requests';
import { submitBlocker } from '../core/session';
import type { StatusResponse } from '../shared/api';
import { api, isAbort, newId } from './api';
import { Finish } from './Finish';
import { IconButton } from './icons';
import { Practice } from './Practice';
import { Setup } from './Setup';
import { useSpeaker } from './speech';
import { clearStoredSession, useSession } from './store';

export function App() {
  const [s, dispatch] = useSession();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(true);
  const inflight = useRef<{ requestId: string; ctrl: AbortController } | null>(null);
  const speaker = useSpeaker(s.language);

  useEffect(() => {
    api.status().then(setStatus, () => setStatusError(true));
  }, []);

  const submit = useCallback(
    async (text: string, origin: 'typed' | 'speech') => {
      if (inflight.current || submitBlocker(s) || !text.trim()) return;
      const requestId = newId();
      const parentId = s.activeLeafId!;
      const epoch = s.epoch;
      const body = buildActorRequest(s, requestId, parentId, text.trim());
      const ctrl = new AbortController();
      inflight.current = { requestId, ctrl };
      dispatch({ type: 'SUBMIT_REPLY', requestId, text, origin });
      try {
        const res = await api.actor(body, ctrl.signal);
        const actorMessageId = newId('m');
        dispatch({
          type: 'ACTOR_RESPONSE',
          requestId,
          epoch,
          userMessageId: newId('m'),
          actorMessageId,
          text: res.text,
          now: Date.now(),
        });
        if (speakReplies && status?.speech.available) {
          speaker.speak(actorMessageId, res.text, s.scenario.voice);
        }
      } catch (e) {
        if (!isAbort(e)) dispatch({ type: 'ACTOR_FAILED', requestId, epoch, error: (e as Error).message });
      } finally {
        if (inflight.current?.requestId === requestId) inflight.current = null;
      }
    },
    [s, dispatch, speakReplies, status, speaker],
  );

  const cancel = useCallback(() => {
    inflight.current?.ctrl.abort();
    inflight.current = null;
    dispatch({ type: 'CANCEL_PENDING' });
  }, [dispatch]);

  const reset = () => {
    if (!window.confirm('Clear everything in this tab: your card, all attempts and cue cards? This cannot be undone.')) return;
    inflight.current?.ctrl.abort();
    inflight.current = null;
    speaker.stop();
    clearStoredSession();
    dispatch({ type: 'RESET' });
  };

  const steps = [
    ['setup', 'Your card'],
    ['practice', 'Practise'],
    ['finish', 'Cue card'],
  ] as const;

  return (
    <div className="app">
      <ModeBanner status={status} failed={statusError} />
      <header className="top">
        <span className="brand">Offscript</span>
        <ol className="steps" aria-label="Progress">
          {steps.map(([phase, label]) => (
            <li key={phase} aria-current={s.phase === phase ? 'step' : undefined} className={s.phase === phase ? 'on' : ''}>
              {label}
            </li>
          ))}
        </ol>
      </header>

      {s.phase === 'setup' && (
        <Setup
          s={s}
          dispatch={dispatch}
          status={status}
          unlockAudio={speaker.unlock}
          onRehearse={(id, line, voice) => {
            if (status?.speech.available && speakReplies) speaker.speak(id, line, voice);
          }}
        />
      )}
      {s.phase === 'practice' && (
        <Practice
          s={s}
          dispatch={dispatch}
          status={status}
          onSubmit={submit}
          onCancel={cancel}
          onRetry={() => {
            dispatch({ type: 'CLEAR_ERROR' });
            submit(s.drafts[s.activeLeafId!] ?? '', 'typed');
          }}
          speaker={speaker}
          speakReplies={speakReplies}
          setSpeakReplies={setSpeakReplies}
        />
      )}
      {s.phase === 'finish' && <Finish s={s} dispatch={dispatch} />}

      <footer className="app-foot">
        <IconButton icon="trash" label="Clear everything" className="small" onClick={reset} />
      </footer>
    </div>
  );
}

function ModeBanner({ status, failed }: { status: StatusResponse | null; failed: boolean }) {
  if (failed)
    return (
      <div className="banner error" role="alert">
        Can't reach the local server. Is <code>npm run dev</code> running?
      </div>
    );
  if (!status) return null;
  if (status.mode === 'unavailable')
    return (
      <div className="banner error" role="alert">
        AI unavailable: {status.chat.reason} Add it to <code>.env</code> and restart the server.
      </div>
    );
  return null; // live and ready: nothing to show
}
