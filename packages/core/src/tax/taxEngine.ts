import Decimal from 'decimal.js';
import type { LedgerEvent } from '../domain/ledger.js';
import { normalizeActiveLedger } from '../domain/ledger.js';
import type { Settings } from '../domain/settings.js';
import type { TaxYearReport, TaxIncomeRow, TaxHoldingRow, TaxYearTotals } from '../domain/tax.js';
import { replayLedgerToLotsAndDisposals } from '../portfolio/lotEngine.js';
import type { LotEngineOptions } from '../portfolio/lotEngine.js';
import { applyHmo } from './hmoCalculator.js';
import { detectSelfTransfers } from './transferDetection.js';

function d(s: string | undefined | null): Decimal {
  if (!s) return new Decimal(0);
  return new Decimal(s);
}

function toFixed(x: Decimal): string {
  const s = x.toFixed();
  return s === '-0' ? '0' : s;
}

function endOfTaxYearISO(year: number): string {
  // Inclusive end-of-year in UTC.
  return new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)).toISOString();
}

export type GenerateTaxReportOptions = {
  /** Override tax year lot method (defaults to settings + taxProfile). */
  lotMethodOverride?: Settings['lotMethodDefault'];
  /** Apply Finnish acquisition cost assumption (HMO) to disposals. Finland profile only. */
  hmoEnabled?: boolean;
  /**
   * Detect self-transfers between wallets and propagate cost basis.
   * When true (Finland profile only): runs detectSelfTransfers + walletLevelFifo in lot engine.
   * Unmatched outgoing transfers are added to report warnings.
   */
  enableTransferDetection?: boolean;
};

export function lotMethodForTax(
  settings: Settings,
  override?: Settings['lotMethodDefault'],
): Settings['lotMethodDefault'] {
  if (override) return override;
  if (settings.taxProfile === 'FINLAND') return 'FIFO';
  return settings.lotMethodDefault;
}

export function generateTaxYearReport(
  allEvents: LedgerEvent[],
  settings: Settings,
  year: number,
  opts: GenerateTaxReportOptions = {},
): TaxYearReport {
  const active = normalizeActiveLedger(allEvents);
  const lotMethodUsed = lotMethodForTax(settings, opts.lotMethodOverride);
  const taxSettings: Settings = { ...settings, lotMethodDefault: lotMethodUsed };

  const extraWarnings: string[] = [];

  // Transfer detection: Finland profile + enableTransferDetection=true
  let engineOptions: LotEngineOptions | undefined;
  if (opts.enableTransferDetection && settings.taxProfile === 'FINLAND') {
    const transferResult = detectSelfTransfers(active);
    engineOptions = {
      walletLevelFifo: true,
      selfTransferMatches: transferResult.matched,
    };
    for (const eventId of transferResult.unmatchedOut) {
      extraWarnings.push(`unmatched_transfer:${eventId}`);
    }
  }

  // 1) Realized disposals (SELL + SWAP disposal leg)
  const replay = replayLedgerToLotsAndDisposals(active, taxSettings, engineOptions);
  const disposals = replay.disposals.filter((dsp) => dsp.taxYear === year);

  // 2) Income rows (rewards/airdrops)
  const income: TaxIncomeRow[] = [];
  const warnings: string[] = [...replay.warnings, ...extraWarnings];
  for (const e of active) {
    const y = Number(e.timestampISO.slice(0, 4));
    if (y !== year) continue;
    if (e.type !== 'REWARD' && e.type !== 'STAKING_REWARD' && e.type !== 'AIRDROP') continue;

    const qty = d(e.amount).abs();
    let fmvTotal: Decimal | null = null;
    if (e.fmvTotalBase) fmvTotal = d(e.fmvTotalBase);
    else if (e.fmvPerUnitBase) fmvTotal = qty.mul(d(e.fmvPerUnitBase));

    let incomeBase = new Decimal(0);
    if (settings.rewardsCostBasisMode === 'FMV') {
      if (fmvTotal) incomeBase = fmvTotal;
      else warnings.push(`tax_income_missing_fmv:${e.id}`);
    }

    income.push({
      eventId: e.id,
      assetId: e.assetId,
      timestampISO: e.timestampISO,
      amount: toFixed(qty),
      incomeBase: toFixed(incomeBase),
      ...(fmvTotal ? { fmvTotalBase: toFixed(fmvTotal) } : {}),
      type: e.type,
    });
  }

  // 3) Year-end holdings
  const cutISO = endOfTaxYearISO(year);
  const activeToYearEnd = active.filter((e) => e.timestampISO <= cutISO);

  // EOY engine options: reuse walletLevelFifo with self-transfer matches filtered to EOY range
  let eoyEngineOptions: LotEngineOptions | undefined;
  if (engineOptions) {
    const eoyIds = new Set(activeToYearEnd.map((e) => e.id));
    eoyEngineOptions = {
      walletLevelFifo: engineOptions.walletLevelFifo,
      selfTransferMatches: (engineOptions.selfTransferMatches ?? []).filter(
        (m) => eoyIds.has(m.outEventId) && eoyIds.has(m.inEventId),
      ),
    };
  }

  const replayEOY = replayLedgerToLotsAndDisposals(activeToYearEnd, taxSettings, eoyEngineOptions);
  const yearEndHoldings: TaxHoldingRow[] = replayEOY.positions.map((p) => ({
    assetId: p.assetId,
    amount: p.amount,
    // Position.costBasisBase is optional (e.g. if valuation pipeline hasn't been run).
    // Tax holdings must be deterministic; default to 0 if missing.
    costBasisBase: p.costBasisBase ?? '0',
  }));

  // Totals
  const totals: TaxYearTotals = {
    proceedsBase: toFixed(disposals.reduce((acc, x) => acc.add(d(x.proceedsBase)), new Decimal(0))),
    costBasisBase: toFixed(
      disposals.reduce((acc, x) => acc.add(d(x.costBasisBase)), new Decimal(0)),
    ),
    feesBase: toFixed(disposals.reduce((acc, x) => acc.add(d(x.feeBase)), new Decimal(0))),
    realizedGainBase: toFixed(
      disposals.reduce((acc, x) => acc.add(d(x.realizedGainBase)), new Decimal(0)),
    ),
    incomeBase: toFixed(income.reduce((acc, x) => acc.add(d(x.incomeBase)), new Decimal(0))),
  };

  // HMO (hankintameno-olettama) — Finland only
  const hmoEnabled = !!(opts.hmoEnabled && settings.taxProfile === 'FINLAND');
  const hmoResult = hmoEnabled ? applyHmo(disposals, true) : undefined;

  return {
    year,
    baseCurrency: settings.baseCurrency,
    taxProfile: settings.taxProfile,
    lotMethodUsed,
    generatedAtISO: new Date().toISOString(),
    disposals,
    income,
    yearEndHoldings,
    totals,
    warnings,
    ...(hmoResult
      ? {
          hmoEnabled: true,
          hmoTotalSavingBase: hmoResult.totalSavingBase,
          hmoAdjustments: hmoResult.adjustments,
        }
      : {}),
  };
}
