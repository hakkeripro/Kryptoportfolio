import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '../ui';
import { parseBinanceStatementCsv, mapBinanceStatementToEvents } from '@kp/core';
import {
  buildBinancePreviewEvents,
  commitBinanceImport,
  computeBinanceDedupe,
} from '../../integrations/binance/binanceImport';
import type { CsvUploadFormProps } from '../../integrations/importPlugin';
import type { LedgerEvent } from '@kp/core';

type Status = 'idle' | 'parsed' | 'preview' | 'committing' | 'done' | 'error';

export function BinanceCsvUploadForm({ ctx }: CsvUploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [fileName, setFileName] = useState('');
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [newEvents, setNewEvents] = useState<LedgerEvent[]>([]);
  const [dupCount, setDupCount] = useState(0);
  const [issueCount, setIssueCount] = useState(0);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(file: File) {
    setErr(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const rows = parseBinanceStatementCsv(text);
      const { events: raw, issues } = mapBinanceStatementToEvents(rows);
      const ledgerEvents = buildBinancePreviewEvents(raw);
      const { newEvents: ne, duplicateExternalRefs: dups } =
        await computeBinanceDedupe(ledgerEvents);
      setEvents(ledgerEvents);
      setNewEvents(ne);
      setDupCount(dups.length);
      setIssueCount(issues.length);
      setStatus('preview');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  async function handleCommit() {
    setStatus('committing');
    try {
      const res = await commitBinanceImport(events);
      setResult({ created: res.createdLedgerEvents, skipped: res.skippedDuplicates });
      setStatus('done');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Drop zone */}
      {status === 'idle' && (
        <div
          className="border-2 border-dashed border-white/[0.12] rounded-xl p-8 text-center cursor-pointer hover:border-[#FF8400]/40 hover:bg-[#FF8400]/[0.02] transition-all"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          data-testid="input-binance-csv-upload"
        >
          <Upload className="h-8 w-8 text-content-tertiary mx-auto mb-2" />
          <div className="text-body text-content-secondary">Drop Binance Statement CSV here</div>
          <div className="text-caption text-content-tertiary mt-1">
            Export from Binance → Orders → Trade History → Export
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </div>
      )}

      {err && (
        <div className="rounded-button border border-semantic-error/30 bg-semantic-error/5 p-3 text-caption text-semantic-error">
          {err}
        </div>
      )}

      {status === 'preview' && (
        <div className="space-y-3">
          <div className="text-caption text-content-secondary">
            <span className="text-content-primary font-medium">{fileName}</span> — parsed{' '}
            <span className="text-content-primary font-medium">{events.length}</span> transactions.{' '}
            <span className="text-semantic-success">{newEvents.length} new</span>
            {dupCount > 0 && <span className="text-content-tertiary">, {dupCount} duplicates</span>}
            {issueCount > 0 && (
              <span className="text-semantic-warning ml-1">
                · {issueCount} unknown operations (skipped)
              </span>
            )}
          </div>
          {newEvents.length > 0 ? (
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => void handleCommit()}
                data-testid="btn-binance-preview-commit"
              >
                Import {newEvents.length} transactions
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatus('idle');
                  setFileName('');
                }}
              >
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
          data-testid="badge-binance-csv-done"
        >
          Imported {result.created} transactions.{' '}
          {result.skipped > 0 && `Skipped ${result.skipped} duplicates.`}
        </div>
      )}
    </div>
  );
}
