import { useEffect, useRef, useState } from 'react';
import { buildOpeningRequest } from '../core/requests';
import type { Action } from '../core/session';
import { latestIntention } from '../core/tree';
import { LIMITS, scenarioIsReady, type Scenario, type Session } from '../core/types';
import { LANGUAGES, speaksLanguage, type StatusResponse } from '../shared/api';
import { EXAMPLES, exampleScenario } from '../shared/scenarios';
import { api, isAbort, newId } from './api';
import { IntentionEditor } from './IntentionCard';

const EMPTY = { needToSay: '', preferNotToAgree: '', couldOffer: '' };

export function Setup({
  s,
  dispatch,
  status,
  unlockAudio,
  onRehearse,
}: {
  s: Session;
  dispatch: (a: Action) => void;
  status: StatusResponse | null;
  unlockAudio: () => void;
  onRehearse: (id: string, line: string, voice: string) => void;
}) {
  const [busy, setBusy] = useState<null | 'card' | 'opening'>(null);
  const [error, setError] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const sc = s.scenario;
  const ready = scenarioIsReady(sc);
  const approved = latestIntention(s);
  const name = sc.counterpartName.trim() || 'they';

  const cardRef = useRef<HTMLDivElement>(null);
  const showing = s.intentionDraft ? 'draft' : approved ? 'ready' : null;
  useEffect(() => {
    if (!showing) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    cardRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, [showing]);

  const set = (patch: Partial<Scenario>) => dispatch({ type: 'SET_SCENARIO', scenario: { ...sc, ...patch } });

  async function run<T>(kind: 'card' | 'opening', fn: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> {
    setBusy(kind);
    setError(null);
    ctrl.current = new AbortController();
    try {
      return await fn(ctrl.current.signal);
    } catch (e) {
      if (!isAbort(e)) setError((e as Error).message);
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  async function suggest() {
    if (!s.messyThoughts.trim() || busy) return;
    const res = await run('card', (signal) =>
      api.suggestIntention({ requestId: newId(), language: s.language, thoughts: s.messyThoughts }, signal),
    );
    if (res) dispatch({ type: 'SET_INTENTION_DRAFT', fields: res.fields });
  }

  async function rehearse() {
    if (busy) return;
    unlockAudio(); // inside the click, so the first spoken line is allowed to play
    let line = sc.openingLine.trim();
    if (!line) {
      const res = await run('opening', (signal) => api.opening(buildOpeningRequest(s, newId()), signal));
      if (!res) return;
      line = res.text;
    }
    const openingId = newId('m');
    dispatch({ type: 'START_PRACTICE', openingId, openingLine: line, now: Date.now() });
    onRehearse(openingId, line, sc.voice);
  }

  const L = LIMITS.scenario;

  return (
    <div className="sheet">
      <header className="opening">
        <h1>Say the thing you came to say.</h1>
        <p>Describe a conversation you're dreading, write your point, rehearse it, and leave with a line you approve.</p>
      </header>

      <div className="field lang">
        <label htmlFor="lang">Language</label>
        <select id="lang" value={s.language} onChange={(e) => dispatch({ type: 'SET_LANGUAGE', language: e.target.value })}>
          <optgroup label="Spoken replies">
            {LANGUAGES.filter((l) => l.voice).map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Text replies (you can still speak)">
            {LANGUAGES.filter((l) => !l.voice).map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </optgroup>
        </select>
        {!speaksLanguage(s.language) && (
          <p className="hint">Replies in this language appear as text. You can still talk; your speech is transcribed.</p>
        )}
      </div>

      <fieldset className="situation">
        <legend>The conversation</legend>
        <p className="row examples">
          <span className="hint">Fill in an example:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              className="quiet"
              onClick={() => {
                dispatch({ type: 'SET_SCENARIO', scenario: exampleScenario(ex, s.language) });
                dispatch({ type: 'SET_MESSY_THOUGHTS', text: ex.thoughts });
              }}
            >
              {ex.label}
            </button>
          ))}
        </p>
        <TextField id="sc-title" label="What is it about?" placeholder="Asking my landlord to fix the heater" max={L.title} value={sc.title} onChange={(v) => set({ title: v })} />
        <div className="pair">
          <TextField id="sc-name" label="Who are you talking to?" placeholder="Mr. Sharma" max={L.counterpartName} value={sc.counterpartName} onChange={(v) => set({ counterpartName: v })} />
          <TextField id="sc-role" label="Who are they to you?" placeholder="My landlord, who keeps postponing repairs" max={L.counterpartRole} value={sc.counterpartRole} onChange={(v) => set({ counterpartRole: v })} />
        </div>
        <TextField id="sc-situation" label="What's going on?" placeholder="The heater has been broken for three weeks and he keeps saying next week." max={L.situation} value={sc.situation} onChange={(v) => set({ situation: v })} rows={3} />
        <TextField
          id="sc-opening"
          label={`How does ${name} open? (optional)`}
          placeholder={`Leave blank and ${name} will open in ${LANGUAGES.find((l) => l.code === s.language)?.label.split(' (')[0] ?? 'your language'}.`}
          max={L.openingLine}
          value={sc.openingLine}
          onChange={(v) => set({ openingLine: v })}
          rows={2}
        />
        {status?.speech.available && speaksLanguage(s.language) && (
          <div className="field">
            <label htmlFor="sc-voice">{sc.counterpartName.trim() ? `${sc.counterpartName.trim()}'s voice` : 'Their voice'}</label>
            <select id="sc-voice" value={sc.voice} onChange={(e) => set({ voice: e.target.value === 'shubh' ? 'shubh' : 'priya' })}>
              <option value="priya">Female voice</option>
              <option value="shubh">Male voice</option>
            </select>
          </div>
        )}
        <p className="hint">Use real or made-up names. What you write is sent to Sarvam AI to play the other person.</p>
      </fieldset>

      {ready && (
        <>
          <div className="field">
            <label htmlFor="thoughts">What's on your mind?</label>
            <textarea
              id="thoughts"
              rows={5}
              maxLength={LIMITS.maxThoughtsChars}
              value={s.messyThoughts}
              placeholder="Messy is fine. What you need to say, what you'd rather not agree to, what you could offer."
              onChange={(e) => dispatch({ type: 'SET_MESSY_THOUGHTS', text: e.target.value })}
            />
          </div>
          <div className="row">
            <button className="primary" onClick={suggest} disabled={!!busy || !s.messyThoughts.trim()}>
              {busy === 'card' ? 'Reading…' : 'Make a card'}
            </button>
            <button
              className="quiet"
              onClick={() => dispatch({ type: 'SET_INTENTION_DRAFT', fields: approved ? { ...approved } : EMPTY })}
              disabled={!!busy}
            >
              Write it myself
            </button>
            {busy === 'card' && (
              <button className="quiet" onClick={() => ctrl.current?.abort()}>
                Cancel
              </button>
            )}
          </div>
        </>
      )}

      <div ref={cardRef} className="line-anchor" />
      {s.intentionDraft && (
        <IntentionEditor
          value={s.intentionDraft}
          onChange={(fields) => dispatch({ type: 'SET_INTENTION_DRAFT', fields })}
          onApprove={() => dispatch({ type: 'APPROVE_INTENTION', id: newId('v'), fields: s.intentionDraft!, now: Date.now() })}
          onCancel={() => dispatch({ type: 'SET_INTENTION_DRAFT', fields: null })}
          approveLabel="Approve"
          note="A draft from your words. Nothing is used until you approve it."
        />
      )}

      {approved && !s.intentionDraft && (
        <div className="ready">
          <p className="the-point">{approved.needToSay}</p>
          <div className="row">
            <button className="primary" onClick={rehearse} disabled={!ready || !!busy}>
              {busy === 'opening' ? `${name} is getting ready…` : `Rehearse with ${sc.counterpartName.trim() || 'them'}`}
            </button>
            <button className="quiet" onClick={() => dispatch({ type: 'SET_INTENTION_DRAFT', fields: { ...approved } })} disabled={!!busy}>
              Edit
            </button>
            {busy === 'opening' && (
              <button className="quiet" onClick={() => ctrl.current?.abort()}>
                Cancel
              </button>
            )}
          </div>
          {!ready && <p className="hint">Fill in the conversation above first.</p>}
        </div>
      )}

      {error && (
        <p className="fail" role="alert">
          {error} Everything you wrote is still here.
        </p>
      )}
    </div>
  );
}

function TextField(props: {
  id: string;
  label: string;
  placeholder: string;
  max: number;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label}</label>
      {props.rows ? (
        <textarea
          id={props.id}
          rows={props.rows}
          maxLength={props.max}
          placeholder={props.placeholder}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
        />
      ) : (
        <input
          id={props.id}
          type="text"
          maxLength={props.max}
          placeholder={props.placeholder}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
        />
      )}
    </div>
  );
}
