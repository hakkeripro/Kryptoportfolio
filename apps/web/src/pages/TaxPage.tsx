import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Decimal from 'decimal.js';
import { FileText, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Asset, LedgerEvent, Settings, TaxYearReport } from '@kp/core';
import { generateTaxYearReport } from '@kp/core';
import { ensureWebDbOpen } from '@kp/platform-web';
import { useDbQuery } from '../hooks/useDbQuery';
import { useFeatureGate } from '../hooks/useFeatureGate';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';
import { Card, KpiCard, Button, TokenIcon, BlurOverlay } from '../components/ui';
import { UpgradeModal } from '../components/billing/UpgradeModal';
import { OmaVeroGuide } from '../components/tax/OmaVeroGuide';
import { pageTransition, fadeInUp, staggerContainer } from '../lib/animations';

function d(s: string | undefined | null): Decimal {
  if (!s) return new Decimal(0);
  try {
    return new Decimal(s);
  } catch {
    return new Decimal(0);
  }
}

function fmtMoney(s: string | undefined | null, cur: string): string {
  return `${d(s).toDecimalPlaces(2).toFixed()} ${cur}`;
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
  lines.push(
    [
      'date',
      'asset',
      'amount',
      `proceeds_${cur}`,
      `costBasis_${cur}`,
      `fees_${cur}`,
      `gain_${cur}`,
      'eventId',
    ].join(','),
  );
  for (const d0 of report.disposals) {
    const sym = assetsById.get(d0.assetId)?.symbol ?? d0.assetId;
    lines.push(
      [
        d0.disposedAtISO,
        sym,
        d0.amount,
        d0.proceedsBase,
        d0.costBasisBase,
        d0.feeBase,
        d0.realizedGainBase,
        d0.eventId,
      ].join(','),
    );
  }
  lines.push('');
  lines.push(`Totals,,,,,${report.totals.feesBase},${report.totals.realizedGainBase},`);
  lines.push(`Proceeds,${report.totals.proceedsBase}`);
  lines.push(`CostBasis,${report.totals.costBasisBase}`);
  if (report.hmoEnabled) {
    lines.push(`HMO total saving,${report.hmoTotalSavingBase ?? '0'}`);
  }
  lines.push('');
  lines.push('Income (rewards/airdrops)');
  lines.push(
    ['date', 'type', 'asset', 'amount', `income_${cur}`, `fmv_${cur}`, 'eventId'].join(','),
  );
  for (const r of report.income) {
    const sym = assetsById.get(r.assetId)?.symbol ?? r.assetId;
    lines.push(
      [r.timestampISO, r.type, sym, r.amount, r.incomeBase, r.fmvTotalBase ?? '', r.eventId].join(
        ',',
      ),
    );
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
      return `<tr><td>${d0.disposedAtISO}</td><td>${sym}</td><td style="text-align:right">${d0.amount}</td><td style="text-align:right">${d0.proceedsBase}</td><td style="text-align:right">${d0.costBasisBase}</td><td style="text-align:right">${d0.feeBase}</td><td style="text-align:right">${d0.realizedGainBase}</td></tr>`;
    })
    .join('');
  const incomeRows = report.income
    .map((r) => {
      const sym = assetsById.get(r.assetId)?.symbol ?? r.assetId;
      return `<tr><td>${r.timestampISO}</td><td>${r.type}</td><td>${sym}</td><td style="text-align:right">${r.amount}</td><td style="text-align:right">${r.incomeBase}</td></tr>`;
    })
    .join('');
  const holdingsRows = report.yearEndHoldings
    .map((h) => {
      const sym = assetsById.get(h.assetId)?.symbol ?? h.assetId;
      return `<tr><td>${sym}</td><td style="text-align:right">${h.amount}</td><td style="text-align:right">${h.costBasisBase}</td></tr>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Tax Summary ${report.year}</title><style>body{font-family:system-ui,-apple-system,sans-serif;padding:24px}h1,h2{margin:0 0 12px}table{width:100%;border-collapse:collapse;margin:12px 0 24px}th,td{border:1px solid #ddd;padding:8px;font-size:12px}th{background:#f6f6f6;text-align:left}.totals{display:flex;gap:16px;flex-wrap:wrap;margin:12px 0 24px}.card{border:1px solid #ddd;border-radius:12px;padding:12px 14px;min-width:200px}.k{font-size:12px;color:#666}.v{font-size:18px;font-weight:700}</style></head><body><h1>Tax summary ${report.year}</h1><div style="color:#555">Profile: ${report.taxProfile} • Lot method: ${report.lotMethodUsed} • Base: ${report.baseCurrency}</div><div style="color:#555">Generated: ${report.generatedAtISO}</div><div class="totals"><div class="card"><div class="k">Realized gain (${cur})</div><div class="v">${report.totals.realizedGainBase}</div></div><div class="card"><div class="k">Proceeds (${cur})</div><div class="v">${report.totals.proceedsBase}</div></div><div class="card"><div class="k">Cost basis (${cur})</div><div class="v">${report.totals.costBasisBase}</div></div><div class="card"><div class="k">Fees (${cur})</div><div class="v">${report.totals.feesBase}</div></div><div class="card"><div class="k">Income (${cur})</div><div class="v">${report.totals.incomeBase}</div></div></div><h2>Realized disposals</h2><table><thead><tr><th>Date</th><th>Asset</th><th style="text-align:right">Amount</th><th style="text-align:right">Proceeds (${cur})</th><th style="text-align:right">Cost basis (${cur})</th><th style="text-align:right">Fees (${cur})</th><th style="text-align:right">Gain (${cur})</th></tr></thead><tbody>${rows}</tbody></table><h2>Income</h2><table><thead><tr><th>Date</th><th>Type</th><th>Asset</th><th style="text-align:right">Amount</th><th style="text-align:right">Income (${cur})</th></tr></thead><tbody>${incomeRows}</tbody></table><h2>Year-end holdings</h2><table><thead><tr><th>Asset</th><th style="text-align:right">Amount</th><th style="text-align:right">Cost basis (${cur})</th></tr></thead><tbody>${holdingsRows}</tbody></table><div style="color:#555">Note: This report is a calculation tool. It is not tax advice.</div><script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script></body></html>`;
}

export default function TaxPage() {
  const { t } = useTranslation();
  const dbState = useDbQuery(
    async (db) => {
      await ensureWebDbOpen();
      const settings =
        ((await db.settings.get('settings_1')) as any) ?? (await ensureDefaultSettings());
      const assets = (await db.assets.toArray()) as any as Asset[];
      const events = (await db.ledgerEvents.toArray()) as any as LedgerEvent[];
      return { settings: settings as Settings, assets, events };
    },
    [],
    { settings: null as any, assets: [] as Asset[], events: [] as LedgerEvent[] },
  );

  const assetsById = useMemo(
    () => new Map(dbState.data.assets.map((a) => [a.id, a])),
    [dbState.data.assets],
  );
  const years = useMemo(() => {
    const ys = new Set<number>();
    for (const e of dbState.data.events) {
      const y = Number(String(e.timestampISO).slice(0, 4));
      if (y >= 2000 && y <= 2100) ys.add(y);
    }
    ys.add(new Date().getUTCFullYear());
    return [...ys].sort((a, b) => b - a);
  }, [dbState.data.events]);

  const [year, setYear] = useState<number>(new Date().getUTCFullYear());
  const [report, setReport] = useState<TaxYearReport | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [hmoEnabled, setHmoEnabled] = useState(false);

  const exportCsvGate = useFeatureGate('tax-export-csv');
  const exportPdfGate = useFeatureGate('tax-export-pdf');
  const hmoGate = useFeatureGate('hmo-calculator');
  const omaveroGate = useFeatureGate('omavero-guide');
  const taxViewGate = useFeatureGate('tax-report-view');

  const [taxProfileOverride, setTaxProfileOverride] = useState<'GENERIC' | 'FINLAND'>('GENERIC');
  const [lotMethodOverride, setLotMethodOverride] = useState<'FIFO' | 'LIFO' | 'HIFO' | 'AVG_COST'>(
    'FIFO',
  );

  useEffect(() => {
    if (!years.length) return;
    setYear((prev) => (years.includes(prev) ? prev : years[0]!));
  }, [years.join(',')]);

  useEffect(() => {
    const s = dbState.data.settings;
    if (!s) return;
    setTaxProfileOverride(s.taxProfile as any);
    setLotMethodOverride(s.lotMethodDefault as any);
  }, [dbState.data.settings?.updatedAtISO]);

  const baseCurrency = String(dbState.data.settings?.baseCurrency ?? 'EUR').toUpperCase();
  const isFinland = taxProfileOverride === 'FINLAND';

  async function generate() {
    setMsg(null);
    try {
      const settings = dbState.data.settings;
      if (!settings) throw new Error('settings_missing');
      const effProfile = taxProfileOverride ?? settings.taxProfile;
      const effLot = effProfile === 'FINLAND' ? 'FIFO' : lotMethodOverride;
      const r = generateTaxYearReport(
        dbState.data.events,
        { ...settings, taxProfile: effProfile } as any,
        year,
        { lotMethodOverride: effLot, hmoEnabled: isFinland && hmoGate.allowed && hmoEnabled },
      );
      setReport(r);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  function exportCsv() {
    if (!report) return;
    downloadTextFile(
      `tax_${report.year}_${report.taxProfile}.csv`,
      buildCsv(report, assetsById),
      'text/csv',
    );
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

  const realizedGain = report ? d(report.totals.realizedGainBase) : new Decimal(0);

  const kpiCards = report
    ? [
        {
          testId: 'kpi-total-gains',
          label: t('tax.kpi.realizedGain'),
          value: fmtMoney(report.totals.realizedGainBase, report.baseCurrency),
          delta: `${report.disposals.length} disposals`,
          deltaType: realizedGain.gte(0) ? ('positive' as const) : ('negative' as const),
        },
        {
          testId: 'kpi-total-income',
          label: t('tax.kpi.income'),
          value: fmtMoney(report.totals.incomeBase, report.baseCurrency),
          delta: `${report.income.length} events`,
          deltaType: 'neutral' as const,
        },
        {
          testId: 'kpi-cost-basis',
          label: t('tax.kpi.costBasis'),
          value: fmtMoney(report.totals.costBasisBase, report.baseCurrency),
          delta: `Tax profile: ${report.taxProfile}`,
          deltaType: 'neutral' as const,
        },
      ]
    : [];

  return (
    <motion.div className="space-y-section" {...pageTransition}>
      {/* Header */}
      <motion.div
        className="flex items-start justify-between flex-wrap gap-3"
        variants={fadeInUp}
        initial="hidden"
        animate="show"
      >
        <div>
          <h1 className="text-heading-1 font-heading text-content-primary">{t('tax.title')}</h1>
          <p className="text-caption text-content-tertiary mt-0.5">
            Disposals, gains & calculations for tax filing
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            data-testid="form-tax-year"
            className="rounded-input bg-surface-base border border-border px-3 py-2 text-body text-content-primary
              focus:outline-none focus:border-brand/40 transition-colors h-9"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            data-testid="form-tax-lot-method"
            className="rounded-input bg-surface-base border border-border px-3 py-2 text-body text-content-primary
              focus:outline-none focus:border-brand/40 transition-colors h-9"
            value={isFinland ? 'FIFO' : lotMethodOverride}
            disabled={isFinland}
            onChange={(e) => setLotMethodOverride(e.target.value as any)}
          >
            <option value="FIFO">FIFO</option>
            <option value="LIFO">LIFO</option>
            <option value="HIFO">HIFO</option>
            <option value="AVG_COST">AVG_COST</option>
          </select>

          <select
            data-testid="form-tax-profile"
            className="rounded-input bg-surface-base border border-border px-3 py-2 text-body text-content-primary
              focus:outline-none focus:border-brand/40 transition-colors h-9"
            value={taxProfileOverride}
            onChange={(e) => setTaxProfileOverride(e.target.value as any)}
          >
            <option value="GENERIC">{t('tax.profile.generic')}</option>
            <option value="FINLAND">{t('tax.profile.finland')}</option>
          </select>

          {/* HMO toggle — Finland profile only */}
          {isFinland && (
            <label
              data-testid="toggle-hmo"
              className="flex items-center gap-2 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={hmoEnabled}
                onChange={(e) => setHmoEnabled(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#FF8400]"
              />
              <span className="text-[12px] text-content-secondary">
                HMO
                {!hmoGate.allowed && <span className="ml-1 text-[#FF8400]">🔒</span>}
              </span>
            </label>
          )}

          <Button
            variant="default"
            size="sm"
            data-testid="btn-tax-generate"
            onClick={() => void generate()}
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" /> {t('tax.btn.generate')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            data-testid="btn-tax-export-csv"
            onClick={() => {
              if (!exportCsvGate.allowed) {
                exportCsvGate.openUpgrade();
              } else {
                exportCsv();
              }
            }}
            disabled={!report && exportCsvGate.allowed}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" /> {t('tax.btn.exportCsv')}
            {!exportCsvGate.allowed && <span className="ml-1 text-[#FF8400]">●</span>}
          </Button>
        </div>
      </motion.div>

      {/* Upgrade modals */}
      <UpgradeModal open={exportCsvGate.upgradeModalOpen} onClose={exportCsvGate.closeUpgrade} />
      <UpgradeModal open={exportPdfGate.upgradeModalOpen} onClose={exportPdfGate.closeUpgrade} />
      <UpgradeModal open={hmoGate.upgradeModalOpen} onClose={hmoGate.closeUpgrade} />
      <UpgradeModal open={omaveroGate.upgradeModalOpen} onClose={omaveroGate.closeUpgrade} />

      {msg && <div className="text-caption text-semantic-error">{msg}</div>}

      {/* KPI Cards — blurred for free users */}
      {report && (
        <motion.div variants={staggerContainer} initial="hidden" animate="show">
          {taxViewGate.allowed ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {kpiCards.map((kpi) => (
                <motion.div key={kpi.testId} data-testid={kpi.testId} variants={fadeInUp}>
                  <KpiCard {...kpi} />
                </motion.div>
              ))}
            </div>
          ) : (
            <BlurOverlay onUpgrade={taxViewGate.openUpgrade}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {kpiCards.map((kpi) => (
                  <div key={kpi.testId} data-testid={kpi.testId}>
                    <KpiCard {...kpi} />
                  </div>
                ))}
              </div>
            </BlurOverlay>
          )}
        </motion.div>
      )}

      {/* Disposals table — blurred for free users */}
      <motion.div variants={fadeInUp} initial="hidden" animate="show">
        {taxViewGate.allowed ? (
          <DisposalsTable
            report={report}
            assetsById={assetsById}
            t={t}
            baseCurrency={baseCurrency}
          />
        ) : (
          <BlurOverlay onUpgrade={taxViewGate.openUpgrade}>
            <DisposalsTable
              report={report}
              assetsById={assetsById}
              t={t}
              baseCurrency={baseCurrency}
            />
          </BlurOverlay>
        )}
      </motion.div>

      {/* Income + Holdings (side by side) */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <h2 className="text-body font-medium text-content-primary mb-3">
              {t('tax.income.title')}
            </h2>
            <div className="overflow-auto">
              <table className="min-w-full text-caption">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left py-2 pr-3 text-content-tertiary font-medium">
                      {t('tax.income.table.date')}
                    </th>
                    <th className="text-left py-2 pr-3 text-content-tertiary font-medium">
                      {t('tax.income.table.type')}
                    </th>
                    <th className="text-left py-2 pr-3 text-content-tertiary font-medium">
                      {t('tax.table.asset')}
                    </th>
                    <th className="text-right py-2 pl-3 text-content-tertiary font-medium">
                      {t('tax.table.amount')}
                    </th>
                    <th className="text-right py-2 pl-3 text-content-tertiary font-medium">
                      {t('tax.income.table.income')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.income.map((r) => {
                    const sym = assetsById.get(r.assetId)?.symbol ?? r.assetId;
                    return (
                      <tr
                        key={r.eventId}
                        className="border-b border-white/[0.04] hover:bg-[#FF8400]/[0.03]"
                      >
                        <td className="py-2 pr-3 text-content-secondary">
                          {new Date(r.timestampISO).toLocaleDateString()}
                        </td>
                        <td className="py-2 pr-3 text-content-primary">{r.type}</td>
                        <td className="py-2 pr-3 text-content-primary">{sym}</td>
                        <td className="py-2 pl-3 text-right font-mono text-content-secondary">
                          {r.amount}
                        </td>
                        <td className="py-2 pl-3 text-right font-mono text-content-primary">
                          {fmtMoney(r.incomeBase, report.baseCurrency)}
                        </td>
                      </tr>
                    );
                  })}
                  {report.income.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-content-tertiary text-center">
                        {t('tax.income.empty', { year: report.year })}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h2 className="text-body font-medium text-content-primary mb-3">
              {t('tax.holdings.title')}
            </h2>
            <div className="overflow-auto">
              <table className="min-w-full text-caption">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left py-2 pr-3 text-content-tertiary font-medium">
                      {t('tax.table.asset')}
                    </th>
                    <th className="text-right py-2 pl-3 text-content-tertiary font-medium">
                      {t('tax.table.amount')}
                    </th>
                    <th className="text-right py-2 pl-3 text-content-tertiary font-medium">
                      {t('tax.kpi.costBasis')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.yearEndHoldings.map((h) => {
                    const sym = assetsById.get(h.assetId)?.symbol ?? h.assetId;
                    return (
                      <tr
                        key={h.assetId}
                        className="border-b border-white/[0.04] hover:bg-[#FF8400]/[0.03]"
                      >
                        <td className="py-2 pr-3 text-content-primary">{sym}</td>
                        <td className="py-2 pl-3 text-right font-mono text-content-secondary">
                          {h.amount}
                        </td>
                        <td className="py-2 pl-3 text-right font-mono text-content-primary">
                          {fmtMoney(h.costBasisBase, report.baseCurrency)}
                        </td>
                      </tr>
                    );
                  })}
                  {report.yearEndHoldings.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-4 text-content-tertiary text-center">
                        {t('tax.holdings.empty', { year: report.year })}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* HMO saving banner */}
      {report?.hmoEnabled && report.hmoTotalSavingBase && d(report.hmoTotalSavingBase).gt(0) && (
        <div className="rounded-lg border border-[#FF8400]/20 bg-[#FF8400]/[0.04] px-4 py-3 text-[12px] text-white/70">
          HMO reduced taxable gain by{' '}
          <span className="text-[#FF8400] font-semibold">
            {fmtMoney(report.hmoTotalSavingBase, baseCurrency)}
          </span>{' '}
          — applied in {(report.hmoAdjustments ?? []).filter((a) => a.applied).length} disposals
        </div>
      )}

      {/* OmaVero Guide — Finland profile + report generated + Pro */}
      {report &&
        isFinland &&
        (omaveroGate.allowed ? (
          <OmaVeroGuide report={report} />
        ) : (
          <Card data-testid="panel-omavero-locked">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30">
                // OMAVERO GUIDE
              </span>
              <span className="text-[12px] text-white/40">
                🔒 Pro — step-by-step OmaVero filing guide
              </span>
              <button
                onClick={omaveroGate.openUpgrade}
                className="ml-auto text-[11px] text-[#FF8400] hover:underline"
              >
                Upgrade →
              </button>
            </div>
          </Card>
        ))}

      {report?.warnings?.length ? (
        <Card>
          <h2 className="text-body font-medium text-content-primary mb-2">
            {t('tax.warnings.title')}
          </h2>
          <ul className="list-disc pl-5 text-caption text-brand-light">
            {report.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Card>
      ) : null}
    </motion.div>
  );
}

// Sub-component to avoid duplication between gated/ungated renders
function DisposalsTable({
  report,
  assetsById,
  t,
  baseCurrency,
}: {
  report: TaxYearReport | null;
  assetsById: Map<string, Asset>;
  t: (key: string, opts?: any) => string;
  baseCurrency: string;
}) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30">
          // {t('tax.disposals.title')}
        </span>
        {report && (
          <div className="text-caption text-content-tertiary">
            {report.disposals.length} {t('tax.disposals.title').toLowerCase()}
          </div>
        )}
      </div>

      <div data-testid="list-tax-disposals" className="overflow-auto">
        <div className="grid grid-cols-[1.2fr_1fr_0.8fr_1fr_1fr_0.8fr_1fr] gap-2 px-5 py-2.5 border-b border-white/[0.04]">
          {[
            t('tax.table.date'),
            t('tax.table.asset'),
            t('tax.table.amount'),
            t('tax.table.proceeds'),
            t('tax.table.costBasis'),
            t('tax.table.fees'),
            t('tax.table.gainLoss'),
          ].map((h) => (
            <span
              key={h}
              className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/20"
            >
              {h}
            </span>
          ))}
        </div>

        {(report?.disposals ?? []).map((r) => {
          const sym = assetsById.get(r.assetId)?.symbol ?? r.assetId;
          const gain = new Decimal(r.realizedGainBase);
          const cur = report?.baseCurrency ?? baseCurrency;
          return (
            <div
              key={r.eventId}
              data-testid={`row-tax-disposal-${r.eventId}`}
              className="grid grid-cols-[1.2fr_1fr_0.8fr_1fr_1fr_0.8fr_1fr] gap-2 items-center py-3 px-5
              border-b border-white/[0.04] hover:bg-[#FF8400]/[0.04] transition-colors"
            >
              <div className="text-[13px] text-content-secondary font-mono">
                {new Date(r.disposedAtISO).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-2">
                <TokenIcon symbol={sym} size="sm" />
                <span className="text-[13px] text-content-primary font-medium">{sym}</span>
              </div>
              <div className="text-[13px] font-mono text-content-secondary text-right">
                {r.amount}
              </div>
              <div className="text-[13px] font-mono text-content-primary text-right">
                {`${new Decimal(r.proceedsBase).toDecimalPlaces(2).toFixed()} ${cur}`}
              </div>
              <div className="text-[13px] font-mono text-content-secondary text-right">
                {`${new Decimal(r.costBasisBase).toDecimalPlaces(2).toFixed()} ${cur}`}
              </div>
              <div className="text-[13px] font-mono text-content-tertiary text-right">
                {`${new Decimal(r.feeBase).toDecimalPlaces(2).toFixed()} ${cur}`}
              </div>
              <div
                className={`text-[13px] font-mono text-right font-semibold ${gain.gte(0) ? 'text-semantic-success' : 'text-semantic-error'}`}
              >
                {`${gain.toDecimalPlaces(2).toFixed()} ${cur}`}
              </div>
            </div>
          );
        })}

        {!report && (
          <div className="py-12 text-center text-caption text-content-tertiary">
            {t('tax.disposals.generatePrompt')}
          </div>
        )}
        {report && report.disposals.length === 0 && (
          <div className="py-12 text-center text-caption text-content-tertiary">
            {t('tax.disposals.empty', { year: report.year })}
          </div>
        )}
      </div>
    </Card>
  );
}
