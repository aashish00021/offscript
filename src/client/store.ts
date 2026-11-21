import { useEffect, useReducer } from 'react';
import { initialSession, reducer } from '../core/session';
import type { Session } from '../core/types';

const KEY = 'offscript.session.v1';

/**
 * Session state lives in this tab's sessionStorage so a reload doesn't lose a
 * practice. It is removed when the tab closes or on "Clear everything".
 * In-flight requests are never persisted.
 */
function load(): Session {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return initialSession();
    const s = JSON.parse(raw) as Session;
    if (typeof s.epoch !== 'number' || typeof s.messages !== 'object') return initialSession();
    return { ...initialSession(s.epoch), ...s, pending: null, paused: false };
  } catch {
    return initialSession();
  }
}

export function useSession() {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      if (state.phase === 'setup' && state.intentions.length === 0 && !state.messyThoughts) sessionStorage.removeItem(KEY);
      else sessionStorage.setItem(KEY, JSON.stringify({ ...state, pending: null }));
    } catch {
      // Storage full or disabled: the session simply won't survive a reload.
    }
  }, [state]);
  return [state, dispatch] as const;
}

export function clearStoredSession() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
