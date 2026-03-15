import { useState } from 'react';
import { useSyncStore } from '../../store/useSyncStore';

interface Props {
  busy: boolean;
  setBusy: (v: boolean) => void;
}

export default function SyncCard({ busy, setBusy }: Props) {
  const syncNow = useSyncStore((s) => s.syncNow);
  const [syncMsg, setSyncMsg] = useState('');

  const doSync = async () => {
    setSyncMsg('');
    setBusy(true);
    try {
      const res = await syncNow();
      setSyncMsg(res ? `uploaded=${res.uploaded}, pulled=${res.pulled}` : 'missing token or vault');
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-xl border border-border bg-surface-raised p-4 space-y-3"
      data-testid="card-sync"
    >
      <div className="font-medium">Sync</div>
      <button
        data-testid="btn-sync-now"
        disabled={busy}
        onClick={() => void doSync()}
        className="rounded-lg bg-surface-raised hover:bg-surface-overlay disabled:opacity-60 px-3 py-2 text-sm"
      >
        Sync now
      </button>
      {syncMsg ? (
        <div data-testid="metric-sync-status" className="text-sm text-content-primary">
          {syncMsg}
        </div>
      ) : null}
    </div>
  );
}
