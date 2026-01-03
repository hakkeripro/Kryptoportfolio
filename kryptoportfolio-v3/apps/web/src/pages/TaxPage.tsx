import { useEffect, useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import type { Asset, LedgerEvent, Settings, TaxYearReport } from '@kp/core';
import { generateTaxYearReport } from '@kp/core';
import { ensureWebDbOpen } from '@kp/platform-web';
import { useDbQuery } from '../hooks/useDbQuery';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';

function d(s: string | undefined | null): Decimal {
  if (!s) return new Decimal(0);
  try {
    return new Decimal(s);
  } catch {
    return new Decimal(0);
  }
}

function fmtMoney(s: string | undefined | null, cur: string): string {
  return `${d(s).toFixed()} ${cur}`;
}

function downloadTextFile(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildCsv(report: TaxYearReport, assetsById: Map<string, Asset>): string {
  const cur = report.baseCurrency;
  const lines: string[] = [];
  lines.push(`Tax Report,${report.year},Profile,${report.taxProfile},Lot,${report.lotMethodUsed}`);
  lines.push(`Generated At,${report.generatedAtISO}`);
  lines.push('');

  lines.push('Realized disposals');
  lines.push(['date', 'asset', 'amount', `proceeds_${cur}`, `costBasis_${cur}`, `fees_${cur}`, `gain_${cur}`, 'eventId'].join(','));
  for (const d0 of report.disposals) {
    const sym = assetsById.get(d0.assetId)?.symbol ?? d0.assetId;
    lines.push([
      d0.disposedAtISO,
      sym,
      d0.amount,
      d0.proceedsBase,
      d0.costBasisBase,
      d0.feeBase,
      d0.realizedGainBase,
      d0.eventId
    ].join(','));
  }
  lines.push('');
  lines.push(`Totals,,,,,${report.totals.feesBase},${report.totals.realizedGainBase},`);
  lines.push(`Proceeds,${report.totals.proceedsBase}`);
  lines.push(`CostBasis,${report.totals.costBasisBase}`);
  lines.push('');

  lines.push('Income (rewards/airdrops)');
  lines.push(['date', 'type', 'asset', 'amount', `income_${cur}`, `fmv_${cur}`, 'eventId'].join(','));
  for (const r of report.income) {
    const sym = assetsById.get(r.assetId)?.symbol ?? r.assetId;
    lines.push([
      r.timestampISO,
      r.type,
      sym,
      r.amount,
      r.incomeBase,
      r.fmvTotalBase ?? '',
      r.eventId
    ].join(','));
  }
  lines.push('');
  lines.push(`IncomeTotal,${report.totals.incomeBase}`);
  lines.push('');

  lines.push('Year-end holdings');
  lines.push(['asset', 'amount', `costBasis_${cur}`].join(','));
  for (const h of report.yearEndHoldings) {
    const sym = assetsById.get(h.assetId)?.symbol ?? h.assetId;
    lines.push([sym, h.amount, h.costBasisBase].join(','));
  }

  if (report.warnings.length) {
    lines.push('');
    lines.push('Warnings');
    for (const w of report.warnings) lines.push(w);
  }

  return lines.join('\n');
}

function buildSummaryHtml(report: TaxYearReport, assetsById: Map<string, Asset>): string {
  const cur = report.baseCurrency;
  const rows = report.disposals
    .map((d0) => {
      const sym = assetsById.get(d0.assetId)?.symbol ?? d0.assetId;
      return `
        <tr>
          <td>${d0.disposedAtISO}</td>
          <td>${sym}</td>
          <td style="text-align:right">${d0.amount}</td>
          <td style="text-align:right">${d0.proceedsBase}</td>
          <td style="text-align:right">${d0.costBasisBase}</td>
          <td style="text-align:right">${d0.feeBase}</td>
          <td style="text-align:right">${d0.realizedGainBase}</td>
        </tr>`;
    })
    .join('');

  const incomeRows = report.income
    .map((r) => {
      const sym = assetsById.get(r.assetId)?.symbol ?? r.assetId;
      return `
        <tr>
          <td>${r.timestampISO}</td>
          <td>${r.type}</td>
          <td>${sym}</td>
          <td style="text-align:right">${r.amount}</td>
          <td style="text-align:right">${r.incomeBase}</td>
        </tr>`;
    })
    .join('');

  const holdingsRows = report.yearEndHoldings
    .map((h) => {
      const sym = assetsById.get(h.assetId)?.symbol ?? h.assetId;
      return `
        <tr>
          <td>${sym}</td>
          <td style="text-align:right">${h.amount}</td>
          <td style="text-align:right">${h.costBasisBase}</td>
        </tr>`;
    })
    .join('');

  return `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>Tax Summary ${report.year}</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; }
      h1, h2 { margin: 0 0 12px 0; }
      .muted { color: #555; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0 24px 0; }
      th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
      th { background: #f6f6f6; text-align: left; }
      .totals { display: flex; gap: 16px; flex-wrap: wrap; margin: 12px 0 24px 0; }
      .card { border: 1px solid #ddd; border-radius: 12px; padding: 12px 14px; min-width: 200px; }
      .k { font-size: 12px; color: #666; }
      .v { font-size: 18px; font-weight: 700; }
    </style>
  </head>
  <body>
    <h1>Tax summary ${report.year}</h1>
    <div class="muted">Profile: ${report.taxProfile} • Lot method: ${report.lotMethodUsed} • Base: ${report.baseCurrency}</div>
    <div class="muted">Generated: ${report.generatedAtISO}</div>
    <div class="totals">
      <div class="card"><div class="k">Realized gain (${cur})</div><div class="v">${report.totals.realizedGainBase}</div></div>
      <div class="card"><div class="k">Proceeds (${cur})</div><div class="v">${report.totals.proceedsBase}</div></div>
      <div class="card"><div class="k">Cost basis (${cur})</div><div class="v">${report.totals.costBasisBase}</div></div>
      <div class="card"><div class="k">Fees (${cur})</div><div class="v">${report.totals.feesBase}</div></div>
      <div class="card"><div class="k">Income (${cur})</div><div class="v">${report.totals.incomeBase}</div></div>
    </div>

    <h2>Realized disposals</h2>
    <table>
      <thead>
        <tr>
          <th>Date (UTC)</th><th>Asset</th><th style="text-align:right">Amount</th>
          <th style="text-align:right">Proceeds (${cur})</th><th style="text-align:right">Cost basis (${cur})</th>
          <th style="text-align:right">Fees (${cur})</th><th style="text-align:right">Gain (${cur})</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <h2>Income (rewards/airdrops)</h2>
    <table>
      <thead><tr><th>Date (UTC)</th><th>Type</th><th>Asset</th><th style="text-align:right">Amount</th><th style="text-align:right">Income (${cur})</th></tr></thead>
      <tbody>${incomeRows}</tbody>
    </table>

    <h2>Year-end holdings</h2>
    <table>
      <thead><tr><th>Asset</th><th style="text-align:right">Amount</th><th style="text-align:right">Cost basis (${cur})</th></tr></thead>
      <tbody>${holdingsRows}</tbody>
    </table>

    <div class="muted">Note: This report is a calculation tool. It is not tax advice.</div>
    <script>window.onload = () => { setTimeout(() => window.print(), 300); };</script>
  </body>
  </html>`;
}

export default function TaxPage() {
  const dbState = useDbQuery(
    async (db) => {
      await ensureWebDbOpen();
      const settings = ((await db.settings.get('settings_1')) as any) ?? (await ensureDefaultSettings());
      const assets = (await db.assets.toArray()) as any as Asset[];
      const events = (await db.ledgerEvents.toArray()) as any as LedgerEvent[];
      return { settings: settings as Settings, assets, events };
    },
    [],
    { settings: null as any, assets: [] as Asset[], events: [] as LedgerEvent[] }
  );

  const assetsById = useMemo(() => new Map(dbState.data.assets.map((a) => [a.id, a])), [dbState.data.assets]);
  const years = useMemo(() => {
    const ys = new Set<number>();
    for (const e of dbState.data.events) {
      const y = Number(String(e.timestampISO).slice(0, 4));
      if (y >= 2000 && y <= 2100) ys.add(y);
    }
    // Always include current year
    ys.add(new Date().getUTCFullYear());
    return [...ys].sort((a, b) => b - a);
  }, [dbState.data.events]);

  const [year, setYear] = useState<number>(new Date().getUTCFullYear());
  const [report, setReport] = useState<TaxYearReport | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [taxProfileOverride, setTaxProfileOverride] = useState<'GENERIC' | 'FINLAND'>('GENERIC');
  const [lotMethodOverride, setLotMethodOverride] = useState<'FIFO' | 'LIFO' | 'HIFO' | 'AVG_COST'>('FIFO');

  useEffect(() => {
    if (!years.length) return;
    // Default to latest year that exists in the ledger.
    setYear((prev) => (years.includes(prev) ? prev : years[0]!));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [years.join(',')]);

  useEffect(() => {
    const s = dbState.data.settings;
    if (!s) return;
    setTaxProfileOverride(s.taxProfile as any);
    setLotMethodOverride(s.lotMethodDefault as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbState.data.settings?.updatedAtISO]);

  const baseCurrency = String(dbState.data.settings?.baseCurrency ?? 'EUR').toUpperCase();

  async function generate() {
    setMsg(null);
    try {
      const settings = dbState.data.settings;
      if (!settings) throw new Error('settings_missing');
      const effProfile = taxProfileOverride ?? settings.taxProfile;
      const effLot = effProfile === 'FINLAND' ? 'FIFO' : lotMethodOverride;
      const r = generateTaxYearReport(dbState.data.events, { ...settings, taxProfile: effProfile } as any, year, {
        lotMethodOverride: effLot
      });
      setReport(r);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  function exportCsv() {
    if (!report) return;
    const csv = buildCsv(report, assetsById);
    downloadTextFile(`tax_${report.year}_${report.taxProfile}.csv`, csv, 'text/csv');
  }

  function exportPdf() {
    if (!report) return;
    const html = buildSummaryHtml(report, assetsById);
    const w = window.open('', '_blank');
    if (!w) {
      setMsg('popup_blocked');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Tax</h1>
        <div className="text-xs text-slate-300">Not tax advice. Calculation tool only.</div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <label className="text-sm">
            <div className="text-xs text-slate-300 mb-1">Tax year</div>
            <select
              data-testid="form-tax-year"
              className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <div className="text-xs text-slate-300 mb-1">Tax profile</div>
            <select
              data-testid="form-tax-profile"
              className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
              value={taxProfileOverride}
              onChange={(e) => setTaxProfileOverride(e.target.value as any)}
            >
              <option value="GENERIC">GENERIC</option>
              <option value="FINLAND">FINLAND (FIFO)</option>
            </select>
          </label>

          <label className="text-sm">
            <div className="text-xs text-slate-300 mb-1">Lot method</div>
            <select
              data-testid="form-tax-lot-method"
              className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
              value={taxProfileOverride === 'FINLAND' ? 'FIFO' : lotMethodOverride}
              disabled={taxProfileOverride === 'FINLAND'}
              onChange={(e) => setLotMethodOverride(e.target.value as any)}
            >
              <option value="FIFO">FIFO</option>
              <option value="LIFO">LIFO</option>
              <option value="HIFO">HIFO</option>
              <option value="AVG_COST">AVG_COST</option>
            </select>
          </label>

          <button
            data-testid="btn-tax-generate"
            onClick={() => void generate()}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-sm font-medium"
          >
            Generate
          </button>

          <button
            data-testid="btn-tax-export-csv"
            onClick={exportCsv}
            disabled={!report}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 px-3 py-2 text-sm"
          >
            Export CSV
          </button>

          <button
            data-testid="btn-tax-export-pdf"
            onClick={exportPdf}
            disabled={!report}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 px-3 py-2 text-sm"
          >
            Export PDF
          </button>

          <div className="ml-auto text-xs text-slate-300">
            Base currency: <span className="font-semibold">{baseCurrency}</span>
          </div>
        </div>

        {msg ? <div className="mt-3 text-sm text-rose-300">{msg}</div> : null}
      </div>

      {report ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="text-xs text-slate-300">Realized gain</div>
            <div className="text-lg font-semibold">{fmtMoney(report.totals.realizedGainBase, report.baseCurrency)}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="text-xs text-slate-300">Proceeds</div>
            <div className="text-lg font-semibold">{fmtMoney(report.totals.proceedsBase, report.baseCurrency)}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="text-xs text-slate-300">Cost basis</div>
            <div className="text-lg font-semibold">{fmtMoney(report.totals.costBasisBase, report.baseCurrency)}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="text-xs text-slate-300">Fees</div>
            <div className="text-lg font-semibold">{fmtMoney(report.totals.feesBase, report.baseCurrency)}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="text-xs text-slate-300">Income</div>
            <div className="text-lg font-semibold">{fmtMoney(report.totals.incomeBase, report.baseCurrency)}</div>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Realized disposals</h2>
          {report ? (
            <div className="text-xs text-slate-300">
              Profile: <span className="font-semibold">{report.taxProfile}</span> • Lot: <span className="font-semibold">{report.lotMethodUsed}</span>
            </div>
          ) : null}
        </div>

        <div data-testid="list-tax-disposals" className="mt-3 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="text-slate-300">
              <tr className="border-b border-slate-800">
                <th className="text-left py-2 pr-3">Date (UTC)</th>
                <th className="text-left py-2 pr-3">Asset</th>
                <th className="text-right py-2 pl-3">Amount</th>
                <th className="text-right py-2 pl-3">Proceeds</th>
                <th className="text-right py-2 pl-3">Cost basis</th>
                <th className="text-right py-2 pl-3">Fees</th>
                <th className="text-right py-2 pl-3">Gain/Loss</th>
              </tr>
            </thead>
            <tbody>
              {(report?.disposals ?? []).map((r) => {
                const sym = assetsById.get(r.assetId)?.symbol ?? r.assetId;
                const gain = d(r.realizedGainBase);
                return (
                  <tr
                    key={r.eventId}
                    data-testid={`row-tax-disposal-${r.eventId}`}
                    className="border-b border-slate-900 hover:bg-slate-950/40"
                  >
                    <td className="py-2 pr-3 whitespace-nowrap">{r.disposedAtISO}</td>
                    <td className="py-2 pr-3">{sym}</td>
                    <td className="py-2 pl-3 text-right">{r.amount}</td>
                    <td className="py-2 pl-3 text-right">{fmtMoney(r.proceedsBase, report?.baseCurrency ?? 'EUR')}</td>
                    <td className="py-2 pl-3 text-right">{fmtMoney(r.costBasisBase, report?.baseCurrency ?? 'EUR')}</td>
                    <td className="py-2 pl-3 text-right">{fmtMoney(r.feeBase, report?.baseCurrency ?? 'EUR')}</td>
                    <td className={`py-2 pl-3 text-right ${gain.gte(0) ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {fmtMoney(r.realizedGainBase, report?.baseCurrency ?? 'EUR')}
                    </td>
                  </tr>
                );
              })}
              {!report ? (
                <tr>
                  <td colSpan={7} className="py-3 text-slate-300">
                    Generate a report to see disposals for the selected year.
                  </td>
                </tr>
              ) : null}
              {report && report.disposals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-3 text-slate-300">
                    No taxable disposals found for {report.year}.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {report ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-lg font-semibold">Income (rewards/airdrops)</h2>
            <div className="mt-3 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-slate-300">
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-2 pr-3">Date</th>
                    <th className="text-left py-2 pr-3">Type</th>
                    <th className="text-left py-2 pr-3">Asset</th>
                    <th className="text-right py-2 pl-3">Amount</th>
                    <th className="text-right py-2 pl-3">Income</th>
                  </tr>
                </thead>
                <tbody>
                  {report.income.map((r) => {
                    const sym = assetsById.get(r.assetId)?.symbol ?? r.assetId;
                    return (
                      <tr key={r.eventId} className="border-b border-slate-900 hover:bg-slate-950/40">
                        <td className="py-2 pr-3 whitespace-nowrap">{r.timestampISO}</td>
                        <td className="py-2 pr-3">{r.type}</td>
                        <td className="py-2 pr-3">{sym}</td>
                        <td className="py-2 pl-3 text-right">{r.amount}</td>
                        <td className="py-2 pl-3 text-right">{fmtMoney(r.incomeBase, report.baseCurrency)}</td>
                      </tr>
                    );
                  })}
                  {report.income.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 text-slate-300">
                        No reward/airdrop income events in {report.year}.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-lg font-semibold">Year-end holdings</h2>
            <div className="mt-3 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-slate-300">
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-2 pr-3">Asset</th>
                    <th className="text-right py-2 pl-3">Amount</th>
                    <th className="text-right py-2 pl-3">Cost basis</th>
                  </tr>
                </thead>
                <tbody>
                  {report.yearEndHoldings.map((h) => {
                    const sym = assetsById.get(h.assetId)?.symbol ?? h.assetId;
                    return (
                      <tr key={h.assetId} className="border-b border-slate-900 hover:bg-slate-950/40">
                        <td className="py-2 pr-3">{sym}</td>
                        <td className="py-2 pl-3 text-right">{h.amount}</td>
                        <td className="py-2 pl-3 text-right">{fmtMoney(h.costBasisBase, report.baseCurrency)}</td>
                      </tr>
                    );
                  })}
                  {report.yearEndHoldings.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-3 text-slate-300">
                        No holdings at the end of {report.year}.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {report?.warnings?.length ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-lg font-semibold">Warnings</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-amber-200">
            {report.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
