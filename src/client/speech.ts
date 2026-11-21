import { useCallback, useEffect, useRef, useState } from 'react';
import { api, isAbort } from './api';

export type RecorderState =
  | { kind: 'idle' }
  | { kind: 'requesting' }
  | { kind: 'recording'; seconds: number }
  | { kind: 'transcribing' }
  | { kind: 'error'; message: string };

const MAX_SECONDS = 25; // Sarvam REST speech-to-text accepts clips up to 30 s.

/**
 * Push-to-talk: the microphone is opened only between Start and Stop, and the
 * tracks are stopped immediately afterwards. Audio is never stored; the clip
 * is sent once for transcription and then dropped.
 */
export function useRecorder(language: string, onTranscript: (text: string) => void) {
  const [state, setState] = useState<RecorderState>({ kind: 'idle' });
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);
  const upload = useRef<AbortController | null>(null);

  const releaseMic = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  const stop = useCallback(() => {
    if (rec.current?.state === 'recording') rec.current.stop();
    releaseMic();
  }, [releaseMic]);

  const cancel = useCallback(() => {
    if (rec.current) rec.current.onstop = null;
    stop();
    upload.current?.abort();
    setState({ kind: 'idle' });
  }, [stop]);

  useEffect(() => cancel, [cancel]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setState({ kind: 'error', message: 'This browser cannot record audio here. You can keep typing.' });
      return;
    }
    setState({ kind: 'requesting' });
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState({ kind: 'error', message: 'Microphone access was not allowed. You can keep typing.' });
      return;
    }
    const chunks: Blob[] = [];
    const r = new MediaRecorder(stream.current);
    rec.current = r;
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = async () => {
      releaseMic();
      const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
      chunks.length = 0;
      setState({ kind: 'transcribing' });
      upload.current = new AbortController();
      try {
        const { transcript } = await api.transcribe(blob, language, upload.current.signal);
        onTranscript(transcript);
        setState({ kind: 'idle' });
      } catch (e) {
        if (isAbort(e)) return;
        setState({ kind: 'error', message: `${(e as Error).message} You can try again or type instead.` });
      }
    };
    r.start();
    const began = Date.now();
    setState({ kind: 'recording', seconds: 0 });
    timer.current = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - began) / 1000);
      if (seconds >= MAX_SECONDS) stop();
      else setState({ kind: 'recording', seconds });
    }, 250);
  }, [language, onTranscript, releaseMic, stop]);

  return { state, start, stop, cancel, maxSeconds: MAX_SECONDS };
}

/** Optional spoken counterpart replies. Text is always shown as well. */
export function useSpeaker(language: string) {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    ctrl.current?.abort();
    audio.current?.pause();
    audio.current = null;
    setSpeakingId(null);
  }, []);

  useEffect(() => stop, [stop]);

  const speak = useCallback(
    async (id: string, text: string) => {
      stop();
      setError(null);
      setSpeakingId(id);
      ctrl.current = new AbortController();
      try {
        const { audioBase64, mime } = await api.speak(text, language, ctrl.current.signal);
        const el = new Audio(`data:${mime};base64,${audioBase64}`);
        audio.current = el;
        el.onended = () => setSpeakingId(null);
        await el.play();
      } catch (e) {
        if (!isAbort(e)) setError(`Couldn't play the reply aloud: ${(e as Error).message}`);
        setSpeakingId(null);
      }
    },
    [language, stop],
  );

  return { speakingId, speak, stop, error };
}
