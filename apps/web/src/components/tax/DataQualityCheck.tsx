import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Database, ArrowRight } from 'lucide-react';
import type { Asset, LedgerEvent } from '@kp/core';
import { Card } from '../ui/Card';

interface DataQualityCheckProps {
  events: LedgerEvent[];
  assets: Asset[];
}

const INCOME_TYPES = new Set(['REWARD', 'STAKING_REWARD', 'AIRDROP']);

function countMissingFmv(events: LedgerEvent[]): number {
  return events.filter(
    (e) => INCOME_TYPES.has(e.type) && !(e as any).fmvTotalBase && !(e as any).fmvPerUnitBase,
  ).length;
}

function countUnmatchedTransfers(events: LedgerEvent[]): number {
  return events.filter((e) => e.type === 'TRANSFER' && Number((e as any).amount ?? 0) < 0).length;
}

function countUnmappedAssets(assets: Asset[]): number {
  return assets.filter((a) => !(a as any).coingeckoId).length;
}

interface QualityRow {
  label: string;
  count: number;
  filterParam?: string;
  zeroLabel?: string;
}

function Row({ label, count, filterParam, zeroLabel }: QualityRow) {
  const isOk = count === 0;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
      <div className="flex items-center gap-2.5">
        {isOk ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/70 flex-shrink-0" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 text-[#FF8400]/80 flex-shrink-0" />
        )}
        <span className={`text-[13px] ${isOk ? 'text-white/40' : 'text-white/70'}`}>{label}</span>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={`font-mono text-[13px] tabular-nums ${
            isOk ? 'text-white/20' : 'text-[#FF8400] font-semibold'
          }`}
        >
          {isOk ? (zeroLabel ?? '0') : count}
        </span>
        {!isOk && filterParam && (
          <Link
            to={`/transactions?filter=${filterParam}`}
            className="flex items-center gap-1 text-[11px] text-[#FF8400]/70 hover:text-[#FF8400]
              transition-colors font-mono"
          >
            Review <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * Data quality check panel for TaxPage.
 * Shows transaction count + issues that may affect tax accuracy.
 * Visible before generating the report to guide the user.
 */
export function DataQualityCheck({ events, assets }: DataQualityCheckProps) {
  const stats = useMemo(() => {
    const total = events.length;
    const missingFmv = countMissingFmv(events);
    const unmatchedTransfers = countUnmatchedTransfers(events);
    const unmappedAssets = countUnmappedAssets(assets);
    const issues = missingFmv + unmatchedTransfers + unmappedAssets;
    return { total, missingFmv, unmatchedTransfers, unmappedAssets, issues };
  }, [events, assets]);

  return (
    <Card data-testid="panel-data-quality">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-white/20" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30">
            // DATA QUALITY CHECK
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {stats.issues === 0 ? (
            <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.15em] text-emerald-500/60">
              <CheckCircle2 className="h-3 w-3" />
              All clear
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.15em] text-[#FF8400]/70">
              <AlertTriangle className="h-3 w-3" />
              {stats.issues} issue{stats.issues !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Total transactions row */}
      <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04]">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-white/20 flex-shrink-0" />
          <span className="text-[13px] text-white/40">Transactions loaded</span>
        </div>
        <span className="font-mono text-[13px] tabular-nums text-white/40">
          {stats.total.toLocaleString()}
        </span>
      </div>

      <Row
        label="Transactions missing EUR value"
        count={stats.missingFmv}
        filterParam="missing-value"
        zeroLabel="✓"
      />
      <Row
        label="Unmatched transfers (possible self-transfers)"
        count={stats.unmatchedTransfers}
        filterParam="unmatched-transfer"
        zeroLabel="✓"
      />
      <Row label="Assets without price mapping" count={stats.unmappedAssets} zeroLabel="✓" />

      {stats.issues > 0 && (
        <p className="mt-3 text-[11px] text-white/25">
          Unresolved issues may reduce tax calculation accuracy. Review before generating the
          report.
        </p>
      )}
    </Card>
  );
}
