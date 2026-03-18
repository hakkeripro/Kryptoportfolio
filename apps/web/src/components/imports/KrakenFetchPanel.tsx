import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../ui';
import {
  loadKrakenIntegration,
  saveKrakenIntegration,
} from '../../integrations/kraken/krakenVault';
import { fetchKrakenNewest } from '../../integrations/kraken/krakenSync';
import {
  buildKrakenPreviewEvents,
  commitKrakenImport,
  computeKrakenDedupe,
} from '../../integrations/kraken/krakenImport';
import type { FetchPanelProps } from '../../integrations/importPlugin';
import type { LedgerEvent } from '@kp/core';

type Status = 'idle' | 'fetching' | 'preview' | 'committing' | 'done' | 'error';

export function KrakenFetchPanel({ ctx }: FetchPanelProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [newEvents, setNewEvents] = useState<LedgerEvent[]>([]);
  const [dupCount, setDupCount] = useState(0);
  const [totalEntries, setTotalEntries] = useState(0);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleFetchNewest() {
    if (!ctx.passphrase || !ctx.token) return;
    setStatus('fetching');
    setErr(null);
    try {
      const cfg = await loadKrakenIntegration(ctx.passphrase);
      if (!cfg.credentials) {
        setErr('Not connected');
        setStatus('error');
        return;
      }
      const { events: raw, totalEntries: total } = await fetchKrakenNewest(
        ctx.apiBase,
        ctx.token,
        cfg.credentials,
        cfg.settings.lastFetchedTs,
      );
      setTotalEntries(total);
      const ledgerEvents = buildKrakenPreviewEvents(raw);
      const { newEvents: ne, duplicateExternalRefs: dups } =
        await computeKrakenDedupe(ledgerEvents);
      setEvents(ledgerEvents);
      setNewEvents(ne);
      setDupCount(dups.length);
      setStatus('preview');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  async function handleCommit() {
    setStatus('committing');
    try {
      const res = await commitKrakenImport(events);
      if (ctx.passphrase) {
        const cfg = await loadKrakenIntegration(ctx.passphrase);
        await saveKrakenIntegration(ctx.passphrase, {
          ...cfg,
          settings: { ...cfg.settings, lastFetchedTs: Math.floor(Date.now() / 1000) },
        });
      }
      setResult({ created: res.createdLedgerEvents, skipped: res.skippedDuplicates });
      setStatus('done');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0A0A0A] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-body font-medium text-content-primary">Kraken</div>
          <div className="text-caption text-content-tertiary">Fetch full ledger history</div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleFetchNewest()}
          disabled={status === 'fetching' || status === 'committing'}
          data-testid="btn-kraken-fetch-newest"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          {status === 'fetching' ? 'Fetching…' : 'Fetch Newest'}
        </Button>
      </div>

      {err && (
        <div className="rounded-button border border-semantic-error/30 bg-semantic-error/5 p-3 text-caption text-semantic-error">
          {err}
        </div>
      )}

      {status === 'preview' && (
        <div className="space-y-3">
          <div className="text-caption text-content-secondary">
            Fetched <span className="text-content-primary font-medium">{totalEntries}</span> ledger
            entries → <span className="text-content-primary font-medium">{events.length}</span>{' '}
            transactions. <span className="text-semantic-success">{newEvents.length} new</span>
            {dupCount > 0 && <span className="text-content-tertiary">, {dupCount} duplicates</span>}
            .
          </div>
          {newEvents.length > 0 ? (
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => void handleCommit()}
                data-testid="btn-kraken-preview-commit"
              >
                Import {newEvents.length} transactions
              </Button>
              <Button variant="outline" size="sm" onClick={() => setStatus('idle')}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="text-caption text-content-tertiary">
              All transactions already imported.
            </div>
          )}
        </div>
      )}

      {status === 'done' && result && (
        <div
          className="rounded-button bg-semantic-success/10 px-3 py-2 text-caption text-semantic-success"
          data-testid="badge-kraken-import-done"
        >
          Imported {result.created} transactions.{' '}
          {result.skipped > 0 && `Skipped ${result.skipped} duplicates.`}
        </div>
      )}
    </div>
  );
}
