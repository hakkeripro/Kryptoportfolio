import { useState } from 'react';
import { ClipboardCopy, Check } from 'lucide-react';
import type { TaxYearReport } from '@kp/core';
import { Card } from '../ui/Card';

interface OmaVeroGuideProps {
  report: TaxYearReport;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px]
        font-mono bg-white/[0.05] hover:bg-white/[0.1] text-white/50 hover:text-white/80
        transition-colors border border-white/[0.08]"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3 w-3 text-semantic-success" />
      ) : (
        <ClipboardCopy className="h-3 w-3" />
      )}
    </button>
  );
}

function Row({ label, value, copyValue }: { label: string; value: string; copyValue?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
      <span className="text-[13px] text-content-secondary">{label}</span>
      <span className="flex items-center font-mono text-[13px] text-content-primary">
        {value}
        <CopyButton value={copyValue ?? value} />
      </span>
    </div>
  );
}

/**
 * OmaVero guide for Finnish tax filing.
 * Shows pre-computed values for the OmaVero "Luovutusvoitot ja -tappiot" section.
 * Pro-gated (caller is responsible for gating).
 */
export function OmaVeroGuide({ report }: OmaVeroGuideProps) {
  const cur = report.baseCurrency;
  const { proceedsBase, costBasisBase, feesBase, realizedGainBase } = report.totals;

  const hmoAppliedCount = (report.hmoAdjustments ?? []).filter((a) => a.applied).length;
  const hmoSaving = report.hmoTotalSavingBase;

  // HMO-adjusted cost basis = actual cost basis + HMO savings (when applied)
  const hmoCostBasis = hmoSaving ? String(Number(costBasisBase) + Number(hmoSaving)) : null;

  return (
    <Card data-testid="panel-omavero-guide">
      <div className="mb-4">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30">
          // OMAVERO GUIDE — Tax Year {report.year}
        </span>
        <p className="text-[11px] text-white/30 mt-1">
          This is a calculation aid, not tax advice. Verify values before filing.
        </p>
      </div>

      <div className="mb-4">
        <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/20 mb-2">
          Step 1 — OmaVero → &quot;Muut tulot&quot; → &quot;Luovutusvoitot ja -tappiot&quot;
        </p>
        <Row
          label={`Myyntihinnat yhteensä (${cur})`}
          value={`${Number(proceedsBase).toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`}
          copyValue={proceedsBase}
        />
        <Row
          label={`Hankintahinnat yhteensä (${cur})`}
          value={`${Number(costBasisBase).toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`}
          copyValue={costBasisBase}
        />
        <Row
          label={`  — josta kulut (${cur})`}
          value={`${Number(feesBase).toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`}
          copyValue={feesBase}
        />
        <Row
          label={`Voitto / tappio (${cur})`}
          value={`${Number(realizedGainBase).toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`}
          copyValue={realizedGainBase}
        />
      </div>

      {report.hmoEnabled && hmoAppliedCount > 0 && hmoCostBasis && (
        <div className="mb-4">
          <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/20 mb-2">
            Step 2 — Jos käytit hankintameno-olettamaa (HMO)
          </p>
          <div className="rounded-lg border border-[#FF8400]/20 bg-[#FF8400]/[0.03] px-4 py-3 text-[12px] text-white/60">
            HMO sovellettu {hmoAppliedCount} myynnissä — säästö{' '}
            <span className="text-[#FF8400] font-semibold">
              {Number(hmoSaving).toLocaleString('fi-FI', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              {cur}
            </span>
          </div>
          <div className="mt-2">
            <Row
              label={`HMO-korjattu hankintameno (${cur})`}
              value={`${Number(hmoCostBasis).toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`}
              copyValue={hmoCostBasis}
            />
          </div>
        </div>
      )}

      {report.yearEndHoldings.length > 0 && (
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/20 mb-2">
            Step 3 — Virtuaalivaluuttojen arvo vuodenvaihteessa
          </p>
          <p className="text-[11px] text-white/40">
            Ilmoita omistukset {report.year} lopussa (kustannusperuste tai markkina-arvo):
          </p>
        </div>
      )}
    </Card>
  );
}
