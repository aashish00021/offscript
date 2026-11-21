import { useCallback, useEffect, useRef, useState } from 'react';
import { buildActorRequest } from '../core/requests';
import { submitBlocker } from '../core/session';
import type { StatusResponse } from '../shared/api';
import { api, isAbort, newId } from './api';
import { Finish } from './Finish';
import { Practice } from './Practice';
import { Setup } from './Setup';
import { useSpeaker } from './speech';
import { clearStoredSession, useSession } from './store';

export function App() {
  const [s, dispatch] = useSession();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
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
        if (speakReplies && status?.speech.available) speaker.speak(actorMessageId, res.text);
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

      {s.phase === 'setup' && <Setup s={s} dispatch={dispatch} status={status} />}
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

      <footer className="privacy">
        <details>
          <summary>Where your words go</summary>
          <ul>
            <li>
              Your card, attempts and cue cards are kept in this browser tab (sessionStorage) so a reload doesn't lose them.
              Closing the tab, or “Clear everything”, removes them.
            </li>
            <li>
              {status?.mode === 'live'
                ? `Live mode: the text you send for replies, observations and suggestions goes to ${status.chat.provider === 'sarvam' ? 'Sarvam AI' : status.chat.provider} to generate a response.`
                : 'Demo mode: requests go only to the local server on this computer, which uses scripted fixtures.'}{' '}
              {status?.speech.available
                ? 'Voice clips go to Sarvam AI only while the recording indicator is on and you press Stop; they are not saved by this app.'
                : 'Voice is off.'}
            </li>
            <li>
              We haven't verified how long a provider keeps data, so “Clear everything” clears this app's data but cannot
              delete anything held by a provider. There are no analytics; the local server logs request timings only, not
              content.
            </li>
          </ul>
        </details>
        <button className="quiet tiny" onClick={reset}>
          Clear everything
        </button>
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
  if (!status) return <div className="banner">Checking mode…</div>;
  if (status.mode === 'unavailable')
    return (
      <div className="mode live" role="alert">
        <strong>Live unavailable</strong>
        <details>
          <summary>No server key. Demo lines are not substituted.</summary>
          <p>{status.chat.reason} Text practice is waiting on a key in the server environment. Nothing is sent.</p>
        </details>
      </div>
    );
  if (status.mode === 'mock')
    return (
      <div className="mode demo" role="note">
        <strong>Demo</strong>
        <details>
          <summary>Scripted replies, not live AI or voice</summary>
          <p>Fixed test lines from this computer. This does not show that a model or a microphone works. Voice is off.</p>
        </details>
      </div>
    );
  return (
    <div className="mode live" role="note">
      <strong>Live</strong>
      <details>
        <summary>
          {status.chat.provider}
          {status.speech.available ? '' : ', voice off'}
        </summary>
        <p>
          Replies come from {status.chat.model}.{' '}
          {status.speech.available
            ? `Voice uses ${status.speech.sttModel} and ${status.speech.ttsModel}, and only while you are recording or playing.`
            : 'Voice is off.'}{' '}
          Text you send leaves this computer.
        </p>
      </details>
    </div>
  );
}
