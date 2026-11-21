import { useId, useState } from 'react';
import { FIELD_LABELS } from '../core/coach';
import type { IntentionFields, IntentionVersion } from '../core/types';

const HINTS: Record<keyof IntentionFields, string> = {
  needToSay: 'Required.',
  preferNotToAgree: 'Optional.',
  couldOffer: 'Optional.',
};

const FIELDS = Object.keys(FIELD_LABELS) as Array<keyof IntentionFields>;

export function IntentionEditor(props: {
  value: IntentionFields;
  onChange: (v: IntentionFields) => void;
  onApprove: () => void;
  onCancel?: () => void;
  approveLabel: string;
  note?: string;
}) {
  const id = useId();
  const ready = props.value.needToSay.trim().length > 0;
  return (
    <form
      className="editor"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) props.onApprove();
      }}
    >
      {props.note && <p className="quiet-note">{props.note}</p>}
      {FIELDS.map((f) => (
        <div className="field" key={f}>
          <label htmlFor={`${id}-${f}`}>{FIELD_LABELS[f]}</label>
          <textarea
            id={`${id}-${f}`}
            rows={2}
            maxLength={300}
            value={props.value[f]}
            aria-describedby={`${id}-${f}-hint`}
            onChange={(e) => props.onChange({ ...props.value, [f]: e.target.value })}
          />
          <span id={`${id}-${f}-hint`} className="hint">
            {HINTS[f]}
          </span>
        </div>
      ))}
      <div className="row">
        <button type="submit" className="primary" disabled={!ready}>
          {props.approveLabel}
        </button>
        {props.onCancel && (
          <button type="button" className="quiet" onClick={props.onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

/** One line of the approved intention. Boundaries and offers stay one tap away. */
export function CompactCard(props: {
  card: IntentionVersion;
  history: IntentionVersion[];
  draft: IntentionFields | null;
  onEdit: () => void;
  onDraftChange: (v: IntentionFields | null) => void;
  onApprove: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { card } = props;

  if (props.draft) {
    return (
      <section className="intention editing" aria-label="Edit your intention">
        <IntentionEditor
          value={props.draft}
          onChange={props.onDraftChange}
          onApprove={props.onApprove}
          onCancel={() => props.onDraftChange(null)}
          approveLabel="Approve this version"
          note="Approving saves a new version from here. Earlier replies keep the version they were sent under."
        />
      </section>
    );
  }

  return (
    <section className="intention" aria-label="Your intention">
      <p className="intention-line">
        <span>{card.needToSay}</span>
        <button className="quiet" onClick={props.onEdit} disabled={props.disabled}>
          Edit
        </button>
      </p>
      <button className="quiet tiny" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Hide the rest' : 'Boundaries and offers'}
        {props.history.length > 1 ? `, card v${card.version}` : ''}
      </button>
      {open && (
        <div className="intention-more">
          <p>{card.preferNotToAgree || 'Nothing you prefer not to agree to.'}</p>
          <p>{card.couldOffer || 'No offer yet.'}</p>
          {props.history.length > 1 && (
            <ol>
              {props.history.map((v) => (
                <li key={v.id}>
                  v{v.version}. {v.needToSay}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
