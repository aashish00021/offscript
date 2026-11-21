import { useCallback, useEffect, useRef, useState } from 'react';
import { api, isAbort } from './api';

export type RecorderState =
  | { kind: 'idle' }
  | { kind: 'requesting' }
  | { kind: 'recording'; seconds: number; level: number }
  | { kind: 'transcribing' }
  | { kind: 'error'; message: string };

const MAX_SECONDS = 25; // Sarvam REST speech-to-text accepts clips up to 30 s.
const SILENCE_MS = 2000;
const SPEECH_RMS = 0.02;

/**
 * Tap to talk: the microphone opens on Talk and closes after a ~2 s pause (or
 * Stop, or 25 s). Tracks are stopped immediately afterwards. Audio is never
 * stored; the clip is sent once for transcription and then dropped.
 */
export function useRecorder(language: string, onTranscript: (text: string) => void) {
  const [state, setState] = useState<RecorderState>({ kind: 'idle' });
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);
  const upload = useRef<AbortController | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const onText = useRef(onTranscript);
  onText.current = onTranscript;

  const releaseMic = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
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
        onText.current(transcript);
        setState({ kind: 'idle' });
      } catch (e) {
        if (isAbort(e)) return;
        setState({ kind: 'error', message: `${(e as Error).message} You can try again or type instead.` });
      }
    };
    r.start();
    const began = Date.now();
    const ctx = new AudioContext();
    ctx.resume().catch(() => {});
    audioCtx.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    ctx.createMediaStreamSource(stream.current).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    let heardSpeech = false;
    let silentSince: number | null = null;
    setState({ kind: 'recording', seconds: 0, level: 0 });
    timer.current = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - began) / 1000);
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const n of samples) {
        const x = (n - 128) / 128;
        sum += x * x;
      }
      const rms = Math.sqrt(sum / samples.length);
      if (rms > SPEECH_RMS) {
        heardSpeech = true;
        silentSince = null;
      } else if (heardSpeech) {
        silentSince ??= Date.now();
      }
      const paused = silentSince !== null && Date.now() - silentSince >= SILENCE_MS;
      if (seconds >= MAX_SECONDS || paused) stop();
      // level: 0..1 for the on-screen meter; quiet speech sits around 0.05–0.1 RMS.
      else setState({ kind: 'recording', seconds, level: Math.min(1, rms * 8) });
    }, 100);
  }, [language, releaseMic, stop]);

  return { state, start, stop, cancel, maxSeconds: MAX_SECONDS };
}

const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';

/** Spoken counterpart replies. Text is always shown as well. One audio element is reused so a click can unlock later playback. */
export function useSpeaker(language: string) {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    ctrl.current?.abort();
    audio.current?.pause();
    setSpeakingId(null);
  }, []);

  const unlocked = useRef(false);
  const unlock = useCallback(() => {
    if (unlocked.current) return; // once is enough; replaying would blip the previous reply
    const el = audio.current ?? new Audio();
    audio.current = el;
    if (!el.src) el.src = SILENT;
    el.play()
      ?.then(() => {
        el.pause();
        unlocked.current = true;
      })
      .catch(() => {});
  }, []);

  useEffect(() => stop, [stop]);

  const speak = useCallback(
    async (id: string, text: string, voice?: string) => {
      stop();
      setError(null);
      setSpeakingId(id);
      ctrl.current = new AbortController();
      try {
        const { audioBase64, mime } = await api.speak(text, language, ctrl.current.signal, voice);
        const el = audio.current ?? new Audio();
        audio.current = el;
        el.src = `data:${mime};base64,${audioBase64}`;
        el.onended = () => setSpeakingId((current) => (current === id ? null : current));
        await el.play();
      } catch (e) {
        if (!isAbort(e)) setError(`Couldn't play the reply aloud: ${(e as Error).message}`);
        setSpeakingId((current) => (current === id ? null : current));
      }
    },
    [language, stop],
  );

  return { speakingId, speak, stop, unlock, error };
}
