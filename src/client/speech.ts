import { useCallback, useEffect, useRef, useState } from 'react';
import { api, isAbort } from './api';

export type RecorderState =
  | { kind: 'idle' }
  | { kind: 'requesting' }
  | { kind: 'recording'; seconds: number; level: number }
  | { kind: 'transcribing' }
  | { kind: 'error'; message: string };

const MAX_SECONDS = 25; // Sarvam REST speech-to-text accepts clips up to 30 s.
const SILENCE_MS = 1200;
const SPEECH_RMS = 0.02;
/** Below this much above-threshold audio, the clip is treated as silence and never uploaded. */
const MIN_SPEECH_MS = 400;

/**
 * Tap to talk: the microphone opens on Talk and closes after a ~1.2 s pause (or
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
  /** Latest input level, 0..1, for meters that animate outside React renders. */
  const level = useRef(0);
  const getLevel = useCallback(() => level.current, []);

  const releaseMic = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    level.current = 0;
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
    let spokeMs = 0;
    const r = new MediaRecorder(stream.current);
    rec.current = r;
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = async () => {
      releaseMic();
      const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
      chunks.length = 0;
      // Room noise alone can transcribe into invented words; don't send a clip with no real speech.
      if (spokeMs < MIN_SPEECH_MS) {
        setState({ kind: 'idle' });
        onText.current('');
        return;
      }
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
        spokeMs += 100;
        silentSince = null;
      } else if (heardSpeech) {
        silentSince ??= Date.now();
      }
      const paused = silentSince !== null && Date.now() - silentSince >= SILENCE_MS;
      if (seconds >= MAX_SECONDS || paused) stop();
      // level: 0..1 for the on-screen meter; quiet speech sits around 0.05–0.1 RMS.
      else {
        level.current = Math.min(1, rms * 8);
        setState({ kind: 'recording', seconds, level: level.current });
      }
    }, 100);
  }, [language, releaseMic, stop]);

  return { state, start, stop, cancel, getLevel, maxSeconds: MAX_SECONDS };
}

/**
 * Splits a reply so the first sentence can be spoken while the rest is still being
 * synthesised: [first sentence, everything else]. A very short first sentence
 * ("Okay.") is merged with the next one.
 */
export function splitForSpeech(text: string, language = 'en'): string[] {
  const t = text.trim();
  if (!t) return [];
  const sentences =
    typeof Intl !== 'undefined' && 'Segmenter' in Intl
      ? [...new Intl.Segmenter(language, { granularity: 'sentence' }).segment(t)].map((x) => x.segment.trim()).filter(Boolean)
      : t.split(/(?<=[.!?।])\s+/);
  let first = sentences.shift() ?? '';
  while (first.length < 20 && sentences.length) first += ' ' + sentences.shift();
  const rest = sentences.join(' ').trim();
  return rest ? [first, rest] : [first];
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Spoken counterpart replies, played through one Web Audio context. Each reply is
 * split (see splitForSpeech); the parts are synthesised in parallel and scheduled
 * back to back, so the first sentence starts early and nothing is cut by swapping
 * an <audio> element's source. Text is always shown as well.
 */
export function useSpeaker(language: string) {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const samples = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const sources = useRef<AudioBufferSourceNode[]>([]);
  const ctrl = useRef<AbortController | null>(null);
  /** Bumped on every speak/stop; work from an older run is discarded. */
  const run = useRef(0);

  const context = useCallback(() => {
    if (!ctxRef.current) {
      const ctx = new AudioContext();
      const a = ctx.createAnalyser();
      a.fftSize = 1024;
      a.connect(ctx.destination);
      ctxRef.current = ctx;
      analyser.current = a;
      samples.current = new Uint8Array(new ArrayBuffer(a.fftSize));
    }
    return ctxRef.current;
  }, []);

  /** Call inside a click/tap so the browser allows sound afterwards. */
  const unlock = useCallback(() => {
    const ctx = context();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  }, [context]);

  const stop = useCallback(() => {
    run.current++;
    ctrl.current?.abort();
    for (const src of sources.current) {
      src.onended = null;
      try {
        src.stop();
      } catch {
        // already stopped
      }
    }
    sources.current = [];
    setSpeakingId(null);
  }, []);

  useEffect(() => stop, [stop]);

  /** Current output level, 0..1, for the voice orb. */
  const getLevel = useCallback(() => {
    const a = analyser.current;
    const buf = samples.current;
    if (!a || !buf || !sources.current.length) return 0;
    a.getByteTimeDomainData(buf);
    let sum = 0;
    for (const n of buf) {
      const x = (n - 128) / 128;
      sum += x * x;
    }
    return Math.min(1, Math.sqrt(sum / buf.length) * 5);
  }, []);

  const speak = useCallback(
    async (id: string, text: string, voice?: string) => {
      stop();
      const mine = run.current;
      setError(null);
      setSpeakingId(id);
      const ctx = context();
      if (ctx.state !== 'running') await ctx.resume().catch(() => {});
      if (ctx.state !== 'running') {
        setError('Sound is blocked by the browser. Click anywhere on the page, then press “Hear this”.');
        setSpeakingId(null);
        return;
      }
      const c = new AbortController();
      ctrl.current = c;
      const parts = splitForSpeech(text, language);
      // Synthesise every part at once; play them strictly in order.
      const buffers = parts.map((part) =>
        api.speak(part, language, c.signal, voice).then(({ audioBase64 }) => ctx.decodeAudioData(base64ToBuffer(audioBase64))),
      );
      buffers.forEach((b) => b.catch(() => {}));
      try {
        let at = 0;
        let last: AudioBufferSourceNode | null = null;
        for (const pending of buffers) {
          const buffer = await pending;
          if (run.current !== mine) return;
          const src = ctx.createBufferSource();
          src.buffer = buffer;
          src.connect(analyser.current!);
          at = Math.max(at, ctx.currentTime + 0.03);
          src.start(at);
          at += buffer.duration;
          sources.current.push(src);
          last = src;
        }
        // Resolves when the last part ends, or when stop() aborts this run.
        if (last) {
          const end = last;
          await new Promise<void>((done) => {
            end.onended = () => done();
            c.signal.addEventListener('abort', () => done(), { once: true });
          });
        }
        if (run.current !== mine) return;
        sources.current = [];
        setSpeakingId((current) => (current === id ? null : current));
      } catch (e) {
        if (run.current !== mine) return;
        if (!isAbort(e)) setError(`Couldn't play the reply aloud: ${(e as Error).message}`);
        sources.current = [];
        setSpeakingId((current) => (current === id ? null : current));
      }
    },
    [context, language, stop],
  );

  return { speakingId, speak, stop, unlock, getLevel, error };
}

export type Speaker = ReturnType<typeof useSpeaker>;
