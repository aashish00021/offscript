import { useRef, useState } from 'react';
import type { Action } from '../core/session';
import { latestIntention } from '../core/tree';
import type { Session } from '../core/types';
import { LANGUAGES, type StatusResponse } from '../shared/api';
import { SCENARIOS, getScenario } from '../shared/scenarios';
import { api, isAbort, newId } from './api';
import { IntentionEditor } from './IntentionCard';

const EMPTY = { needToSay: '', preferNotToAgree: '', couldOffer: '' };

export function Setup({ s, dispatch, status }: { s: Session; dispatch: (a: Action) => void; status: StatusResponse | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const scenario = getScenario(s.scenarioId);
  const approved = latestIntention(s);

  async function suggest() {
    if (!s.scenarioId || !s.messyThoughts.trim() || busy) return;
    setBusy(true);
    setError(null);
    ctrl.current = new AbortController();
    try {
      const { fields } = await api.suggestIntention(
        { requestId: newId(), scenarioId: s.scenarioId, language: s.language, thoughts: s.messyThoughts },
        ctrl.current.signal,
      );
      dispatch({ type: 'SET_INTENTION_DRAFT', fields });
    } catch (e) {
      if (!isAbort(e)) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet">
      <header className="opening">
        <h1>Say the thing you came to say.</h1>
        <p>Write your point, rehearse it once, and leave with a line you approve.</p>
      </header>

      <fieldset className="choices">
        <legend>A fictional situation</legend>
        {SCENARIOS.map((sc) => (
          <label key={sc.id} className={s.scenarioId === sc.id ? 'picked' : ''}>
            <input
              type="radio"
              name="scenario"
              checked={s.scenarioId === sc.id}
              onChange={() => dispatch({ type: 'CHOOSE_SCENARIO', scenarioId: sc.id })}
            />
            <span>
              <strong>{sc.title.replace(' (fictional)', '')}</strong>
              <span className="hint">{sc.situation}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="field lang">
        <label htmlFor="lang">Language</label>
        <select id="lang" value={s.language} onChange={(e) => dispatch({ type: 'SET_LANGUAGE', language: e.target.value })}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        {s.language !== 'en-IN' && status?.mode === 'mock' && <p className="quiet-note">Demo replies stay in English.</p>}
      </div>

      {scenario && (
        <>
          <div className="field">
            <label htmlFor="thoughts">What's on your mind?</label>
            <textarea
              id="thoughts"
              rows={5}
              maxLength={2000}
              value={s.messyThoughts}
              onChange={(e) => dispatch({ type: 'SET_MESSY_THOUGHTS', text: e.target.value })}
            />
          </div>
          <div className="row">
            <button className="primary" onClick={suggest} disabled={busy || !s.messyThoughts.trim()}>
              {busy ? 'Reading…' : 'Make a card'}
            </button>
            <button className="quiet" onClick={() => dispatch({ type: 'SET_INTENTION_DRAFT', fields: approved ? { ...approved } : EMPTY })} disabled={busy}>
              Write it myself
            </button>
            <button className="quiet" onClick={() => dispatch({ type: 'SET_MESSY_THOUGHTS', text: scenario.exampleThoughts })}>
              Use the example
            </button>
            {busy && (
              <button className="quiet" onClick={() => ctrl.current?.abort()}>
                Cancel
              </button>
            )}
          </div>
          {error && (
            <p className="fail" role="alert">
              {error} Your notes are still here.
            </p>
          )}
        </>
      )}

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

      {approved && !s.intentionDraft && scenario && (
        <div className="ready">
          <p className="the-point">{approved.needToSay}</p>
          <div className="row">
            <button
              className="primary"
              onClick={() => dispatch({ type: 'START_PRACTICE', openingId: newId('m'), openingLine: scenario.openingLine, now: Date.now() })}
            >
              Rehearse with {scenario.counterpartName}
            </button>
            <button className="quiet" onClick={() => dispatch({ type: 'SET_INTENTION_DRAFT', fields: { ...approved } })}>
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
