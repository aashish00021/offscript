import { useRef, useState } from 'react';
import { cueCardText, findInsertedCommitments } from '../core/cue';
import { buildCueRequest } from '../core/requests';
import type { Action } from '../core/session';
import { activeIntention, activePath } from '../core/tree';
import type { CueFields, Session } from '../core/types';
import { api, isAbort, newId } from './api';

export function Finish({ s, dispatch }: { s: Session; dispatch: (a: Action) => void }) {
  const scenario = s.scenario;
  const card = activeIntention(s)!;
  const approved = s.cues[s.cues.length - 1];
  const draft = s.cueDraft;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  const userSources = [
    s.messyThoughts,
    ...s.intentions.flatMap((v) => [v.needToSay, v.preferNotToAgree, v.couldOffer]),
    ...activePath(s).filter((m) => m.speaker === 'user').map((m) => m.text),
  ];
  const warnings = draft ? findInsertedCommitments(draft, userSources) : [];

  async function suggest() {
    setBusy(true);
    setError(null);
    ctrl.current = new AbortController();
    try {
      const { fields } = await api.suggestCue(buildCueRequest(s, newId()), ctrl.current.signal);
      dispatch({ type: 'SET_CUE_DRAFT', fields });
    } catch (e) {
      if (!isAbort(e)) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const offerLine = card.couldOffer ? `\nI could offer: ${card.couldOffer}\n` : '';
  const text = approved ? cueCardText(approved, scenario.title) + offerLine : '';

  return (
    <div className="sheet">
      <header className="scene">
        <h1>Take this with you.</h1>
        <button className="quiet" onClick={() => dispatch({ type: 'GO_TO_PHASE', phase: 'practice' })}>
          Back
        </button>
      </header>

      {draft ? (
        <form
          className="editor"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.mainPoint.trim()) dispatch({ type: 'APPROVE_CUE', id: newId('c'), fields: draft, now: Date.now() });
          }}
        >
          <Field k="mainPoint" label="The point" hint="The one line you want to keep." draft={draft} dispatch={dispatch} />
          <Field k="opening" label="How you might start" hint="Optional. Leave blank if it would only repeat the point." draft={draft} dispatch={dispatch} />
          <Field k="fallback" label="If you lose the thread" hint="Optional. One short line back to the point." draft={draft} dispatch={dispatch} />
          {card.couldOffer && (
            <p className="offer">
              <span className="hint">Still yours to offer, from your card. Not part of the cue unless you write it in.</span>
              {card.couldOffer}
            </p>
          )}
          {warnings.length > 0 && (
            <p className="quiet-note" role="status">
              {warnings.map((w) => `“${w}”`).join(', ')} isn't in anything you wrote. Keep it only if you mean it.
            </p>
          )}
          <div className="row">
            <button type="submit" className="primary" disabled={!draft.mainPoint.trim()}>
              Approve
            </button>
            <button type="button" className="quiet" onClick={suggest} disabled={busy}>
              {busy ? 'Reading…' : 'Suggest from my words'}
            </button>
            <button type="button" className="quiet" onClick={() => dispatch({ type: 'SET_CUE_DRAFT', fields: null })}>
              Cancel
            </button>
          </div>
          {error && (
            <p className="fail" role="alert">
              {error} Your edits are kept.
            </p>
          )}
        </form>
      ) : approved ? (
        <article className="cue">
          <p className="cue-point">{approved.mainPoint}</p>
          {approved.opening && <p className="cue-line">{approved.opening}</p>}
          {approved.fallback && (
            <p className="cue-line">
              <span className="hint">If you lose the thread. </span>
              {approved.fallback}
            </p>
          )}
          {card.couldOffer && (
            <p className="offer">
              <span className="hint">You could offer, if you want to. </span>
              {card.couldOffer}
            </p>
          )}
          <div className="row">
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  setError('Copy was blocked. Download the file instead.');
                }
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <a className="quiet" download="my-cue-card.txt" href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}>
              Download
            </a>
            <button className="quiet" onClick={() => dispatch({ type: 'SET_CUE_DRAFT', fields: { ...approved } })}>
              Edit
            </button>
          </div>
          <p className="hint">Kept in this tab. Nothing is shared.</p>
          {error && <p className="fail">{error}</p>}
        </article>
      ) : (
        <div className="row">
          <button className="primary" onClick={suggest} disabled={busy}>
            {busy ? 'Reading…' : 'Suggest from my words'}
          </button>
          <button className="quiet" onClick={() => dispatch({ type: 'SET_CUE_DRAFT', fields: { mainPoint: card.needToSay, opening: '', fallback: '' } })}>
            Write it
          </button>
          {error && (
            <p className="fail" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Field(props: {
  k: keyof CueFields;
  label: string;
  hint: string;
  draft: CueFields;
  dispatch: (a: Action) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={`cue-${props.k}`}>{props.label}</label>
      <textarea
        id={`cue-${props.k}`}
        rows={2}
        maxLength={300}
        value={props.draft[props.k]}
        aria-describedby={`cue-${props.k}-hint`}
        onChange={(e) => props.dispatch({ type: 'SET_CUE_DRAFT', fields: { ...props.draft, [props.k]: e.target.value } })}
      />
      <span className="hint" id={`cue-${props.k}-hint`}>
        {props.hint}
      </span>
    </div>
  );
}
