import { useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { usePortfolioData } from '../hooks/usePortfolioData';
import TokenDetailDrawer from '../components/TokenDetailDrawer';

function d(s: string | undefined | null): Decimal {
  if (!s) return new Decimal(0);
  try {
    return new Decimal(s);
  } catch {
    return new Decimal(0);
  }
}

function fmtMoney(val: string | undefined | null, currency: string): string {
  return `${d(val).toDecimalPlaces(2).toFixed()} ${currency}`;
}

function fmtQty(val: string | undefined | null): string {
  const s = d(val).toDecimalPlaces(8).toFixed();
  return s.replace(/\.0+$/, '').replace(/(\.[0-9]*?)0+$/, '$1');
}

export default function PortfolioPage() {
  const dbState = usePortfolioData();
  const baseCurrency = dbState.data.baseCurrency;

  const assetsById = useMemo(
    () => new Map(dbState.data.assets.map((a) => [a.id, a])),
    [dbState.data.assets],
  );

  const accounts = dbState.data.accounts;
  const [accountFilter, setAccountFilter] = useState('all');
  const [sort, setSort] = useState<'value' | 'name'>('value');

  const positions = useMemo(() => {
    const latest = dbState.data.latest;
    if (!latest?.positions?.length) return [];

    const out = [...latest.positions];
    if (sort === 'name') {
      out.sort((a, b) =>
        String(assetsById.get(a.assetId)?.symbol ?? a.assetId).localeCompare(
          String(assetsById.get(b.assetId)?.symbol ?? b.assetId),
        ),
      );
    } else {
      out.sort((a, b) => d(b.valueBase).cmp(d(a.valueBase)));
    }
    return out;
  }, [dbState.data.latest, sort, assetsById]);

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const positionForSelected = useMemo(() => {
    const latest = dbState.data.latest;
    if (!latest?.positions?.length || !selectedAssetId) return null;
    return latest.positions.find((p) => p.assetId === selectedAssetId) ?? null;
  }, [dbState.data.latest, selectedAssetId]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Portfolio</h1>
        <div className="text-xs text-slate-400">
          Holdings are derived from the append-only ledger.
        </div>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <select
          data-testid="filter-account"
          className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-sm"
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
        >
          <option value="all">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          data-testid="sort-positions"
          className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as 'value' | 'name')}
        >
          <option value="value">Sort: Value</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div data-testid="list-positions">
          {positions.length ? (
            <ul className="divide-y divide-slate-800">
              {positions.map((p) => {
                const a = assetsById.get(p.assetId);
                const sym = a?.symbol ?? p.assetId;
                return (
                  <li
                    key={p.assetId}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-900/30 rounded-lg px-2 -mx-2 cursor-pointer"
                    onClick={() => setSelectedAssetId(p.assetId)}
                    data-testid={`row-position-${p.assetId}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold">{sym}</div>
                        <div className="text-xs text-slate-400 truncate">{a?.name ?? ''}</div>
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        {fmtQty(p.amount)} • cost {fmtMoney(p.costBasisBase, baseCurrency)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono">{fmtMoney(p.valueBase, baseCurrency)}</div>
                      <div className="text-xs font-mono text-slate-400">
                        unrealized {fmtMoney(p.unrealizedPnlBase, baseCurrency)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="text-slate-300">
              No positions yet. Import exchange history to populate holdings.
            </div>
          )}
        </div>
      </div>

      {selectedAssetId ? (
        <TokenDetailDrawer
          assetId={selectedAssetId}
          assetsById={assetsById}
          baseCurrency={baseCurrency}
          position={positionForSelected}
          events={dbState.data.events}
          settings={dbState.data.settings}
          onClose={() => setSelectedAssetId(null)}
        />
      ) : null}
    </div>
  );
}
