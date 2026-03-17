import { useState } from 'react';
import { ensureWebDbOpen, getWebDb } from '@kp/platform-web';

export default function DangerZoneCard() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exportMsg, setExportMsg] = useState('');

  const handleExport = async () => {
    setExportMsg('');
    try {
      await ensureWebDbOpen();
      const db = getWebDb();
      const events = await db.ledgerEvents.toArray();
      const json = JSON.stringify(events, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vaultfolio-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg(`Exported ${events.length} events`);
    } catch (e) {
      setExportMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDeleteAccount = () => {
    setShowDeleteConfirm(false);
    // Placeholder: actual deletion requires server-side endpoint (tracked in ISSUE_LOG)
    alert('To delete your account, please contact support.');
  };

  return (
    <div
      className="rounded-xl border border-white/[0.08] bg-[#0F0F0F] p-4 space-y-4"
      data-testid="card-danger-zone"
    >
      {/* Export data */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-body font-medium text-content-primary">Export data</div>
          <div className="text-caption text-content-secondary">
            Download all your transactions as JSON
          </div>
        </div>
        <button
          data-testid="btn-export-data"
          onClick={() => void handleExport()}
          className="rounded-button border border-white/[0.08] px-3 py-2 text-caption text-content-secondary hover:text-content-primary hover:border-white/20 transition-colors"
        >
          Export JSON
        </button>
      </div>
      {exportMsg ? (
        <div className="text-caption text-content-secondary">{exportMsg}</div>
      ) : null}

      {/* Delete account */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
        <div>
          <div className="text-body font-medium text-semantic-error">Delete account</div>
          <div className="text-caption text-content-secondary">
            Permanently remove your account and all synced data
          </div>
        </div>
        {!showDeleteConfirm ? (
          <button
            data-testid="btn-delete-account"
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-button border border-semantic-error/30 px-3 py-2 text-caption text-semantic-error hover:border-semantic-error/60 transition-colors"
          >
            Delete
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-button border border-white/[0.08] px-3 py-2 text-caption text-content-secondary"
            >
              Cancel
            </button>
            <button
              data-testid="btn-delete-account-confirm"
              onClick={handleDeleteAccount}
              className="rounded-button bg-semantic-error/10 border border-semantic-error/40 px-3 py-2 text-caption text-semantic-error"
            >
              Confirm delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
