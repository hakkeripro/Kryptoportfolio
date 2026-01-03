import { useEffect, useMemo, useRef, useState } from 'react';
import { ensureWebDbOpen, getWebDb, liveQuery, type WebDb } from '@kp/platform-web';

type DbQueryState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
};

/**
 * Tiny Dexie query hook without extra deps.
 *
 * Re-runs on any IndexedDB change.
 */
export function useDbQuery<T>(
  query: (db: WebDb) => Promise<T>,
  deps: unknown[],
  initial: T
): DbQueryState<T> {
  const [state, setState] = useState<DbQueryState<T>>({ data: initial, loading: true, error: null });
  const reqId = useRef(0);

  const key = useMemo(() => JSON.stringify(deps), deps); // stable-ish

  useEffect(() => {
    let cancelled = false;
    const myReq = ++reqId.current;
    let sub: { unsubscribe: () => void } | null = null;

    // Dexie core does NOT emit db.on('changes') unless dexie-observable addon is installed.
    // liveQuery is part of Dexie core and will automatically re-run when relevant tables change.
    async function start() {
      try {
        setState((s) => ({ ...s, loading: true, error: null }));
        await ensureWebDbOpen();
        if (cancelled) return;

        const db = getWebDb();
        sub = liveQuery(() => query(db)).subscribe({
          next: (data) => {
            if (cancelled) return;
            if (myReq !== reqId.current) return;
            setState({ data, loading: false, error: null });
          },
          error: (e) => {
            if (cancelled) return;
            const msg = e instanceof Error ? e.message : String(e);
            setState((s) => ({ ...s, loading: false, error: msg }));
          }
        });
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setState((s) => ({ ...s, loading: false, error: msg }));
      }
    }

    void start();

    return () => {
      cancelled = true;
      sub?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
