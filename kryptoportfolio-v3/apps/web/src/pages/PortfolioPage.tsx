import { useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { ensureWebDbOpen, getWebDb } from '@kp/platform-web';
import { replayLedgerToLotsAndDisposals } from '@kp/core';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';
import { useDbQuery } from '../hooks/useDbQuery';

function d(s: string | undefined | null): Decimal {
  if (!s) return new Decimal(0);
  try {
    return new Decimal(s);
  } catch {
    return new Decimal(0);
  }
}

function fmtMoney(val: string | undefined | null, currency: string): string {
  const x = d(val);
  return `${x.toDecimalPlaces(2).toFixed()} ${currency}`;
}

function fmtQty(val: string | undefined | null): string {
  const x = d(val);
  // Show up to 8 decimals, trim trailing zeros.
  const s = x.toDecimalPlaces(8).toFixed();
  return s.replace(/\.0+$/, '').replace(/(\.[0-9]*?)0+$/, '$1');
}

export default function PortfolioPage() {
  const dbState = useDbQuery(
    async (db) => {
      await ensureWebDbOpen();
      const settings = ((await db.settings.get('settings_1')) as any) ?? (await ensureDefaultSettings());
      const baseCurrency = String(settings.baseCurrency ?? 'EUR').toUpperCase();
      const accounts = await db.accounts.toArray();
      const assets = await db.assets.toArray();
      const latest = await db.portfolioSnapshots.orderBy('dayISO').last();
      const events = await db.ledgerEvents.toArray();
      return { settings, baseCurrency, accounts, assets, latest, events };
    },
    [],
    { settings: null as any, baseCurrency: 'EUR', accounts: [] as any[], assets: [] as any[], latest: null as any, events: [] as any[] }
  );

  const baseCurrency = dbState.data.baseCurrency;
  const assetsById = useMemo(() => new Map(dbState.data.assets.map((a: any) => [a.id, a])), [dbState.data.assets]);

  const accounts = dbState.data.accounts;
  const [accountFilter, setAccountFilter] = useState('all');
  const [sort, setSort] = useState<'value' | 'name'>('value');

  const positions = useMemo(() => {
    const latest = dbState.data.latest;
    if (!latest?.positions?.length) return [] as any[];

    // v3 snapshots are aggregated across accounts. Keep filter in UI for future parity.
    let out = [...latest.positions];

    if (sort === 'name') {
      out.sort((a: any, b: any) =>
        String(assetsById.get(a.assetId)?.symbol ?? a.assetId).localeCompare(String(assetsById.get(b.assetId)?.symbol ?? b.assetId))
      );
    } else {
      out.sort((a: any, b: any) => d(b.valueBase).cmp(d(a.valueBase)));
    }
    return out;
  }, [dbState.data.latest, sort, assetsById]);

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const tokenDetail = useDbQuery(
    async (db) => {
      if (!selectedAssetId) return null;
      await ensureWebDbOpen();
      const asset = await db.assets.get(selectedAssetId);
      const prices = await db.pricePoints.where('assetId').equals(selectedAssetId).sortBy('timestampISO');
      const events = await db.ledgerEvents
        .filter((e: any) => e.assetId === selectedAssetId || (e.type === 'SWAP' && (e as any).assetOutId === selectedAssetId))
        .toArray();
      const settings = ((await db.settings.get('settings_1')) as any) ?? (await ensureDefaultSettings());
      return { asset, prices, events, settings };
    },
    [selectedAssetId],
    null as any
  );

  const priceSeries = useMemo(() => {
    const rows = tokenDetail.data?.prices ?? [];
    return rows
      .slice(-180)
      .map((p: any) => ({ t: p.timestampISO.slice(0, 10), v: Number(d(p.pricePerUnitBase).toNumber()) }))
      .filter((x) => Number.isFinite(x.v));
  }, [tokenDetail.data?.prices]);

  const lots = useMemo(() => {
    if (!selectedAssetId) return [] as any[];
    const replay = replayLedgerToLotsAndDisposals(dbState.data.events as any, dbState.data.settings ?? ({} as any));
    return replay.lotsByAssetId[selectedAssetId] ?? [];
  }, [dbState.data.events, dbState.data.settings, selectedAssetId]);

  const positionForSelected = useMemo(() => {
    const latest = dbState.data.latest;
    if (!latest?.positions?.length || !selectedAssetId) return null;
    return latest.positions.find((p: any) => p.assetId === selectedAssetId) ?? null;
  }, [dbState.data.latest, selectedAssetId]);

  const selectedSymbol = selectedAssetId ? (assetsById.get(selectedAssetId)?.symbol ?? selectedAssetId) : '';
  const selectedName = selectedAssetId ? (assetsById.get(selectedAssetId)?.name ?? selectedSymbol) : '';

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Portfolio</h1>
        <div className="text-xs text-slate-400">Holdings are derived from the append-only ledger.</div>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <select
          data-testid="filter-account"
          className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-sm"
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
        >
          <option value="all">All accounts</option>
          {accounts.map((a: any) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          data-testid="sort-positions"
          className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
        >
          <option value="value">Sort: Value</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div data-testid="list-positions">
          {positions.length ? (
            <ul className="divide-y divide-slate-800">
              {positions.map((p: any) => {
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
            <div className="text-slate-300">No positions yet. Import exchange history to populate holdings.</div>
          )}
        </div>
      </div>

      {/* Token detail drawer */}
      <div
        data-testid="drawer-tokendetail"
        className={selectedAssetId ? 'fixed inset-0 z-20' : 'hidden'}
        aria-hidden={selectedAssetId ? 'false' : 'true'}
      >
        <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedAssetId(null)} />
        <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-slate-950 border-l border-slate-800 p-4 overflow-y-auto">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">{selectedSymbol}</div>
              <div className="text-sm text-slate-400">{selectedName}</div>
            </div>
            <button
              data-testid="btn-close-tokendetail"
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
              onClick={() => setSelectedAssetId(null)}
            >
              Close
            </button>
          </div>

          {positionForSelected ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-slate-900/40 border border-slate-800 p-3">
                <div className="text-xs text-slate-400">Amount</div>
                <div className="text-sm font-mono">{fmtQty(positionForSelected.amount)}</div>
              </div>
              <div className="rounded-lg bg-slate-900/40 border border-slate-800 p-3">
                <div className="text-xs text-slate-400">Value</div>
                <div className="text-sm font-mono">{fmtMoney(positionForSelected.valueBase, baseCurrency)}</div>
              </div>
              <div className="rounded-lg bg-slate-900/40 border border-slate-800 p-3">
                <div className="text-xs text-slate-400">Unrealized</div>
                <div className="text-sm font-mono">{fmtMoney(positionForSelected.unrealizedPnlBase, baseCurrency)}</div>
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">Price ({baseCurrency})</div>
              {!priceSeries.length ? (
                <span
                  className="text-xs rounded bg-amber-900/30 border border-amber-800 px-2 py-1 text-amber-200"
                  data-testid="badge-token-missing-price"
                >
                  missing price data
                </span>
              ) : null}
            </div>
            <div className="mt-3 h-56" data-testid="chart-token-price">
              {priceSeries.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={priceSeries}>
                    <Tooltip />
                    <XAxis dataKey="t" hide />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Line type="monotone" dataKey="v" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm text-slate-400">
                  No price points yet. Imports add deterministic price points from ledger; later versions will fetch external prices.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="font-medium">Events</div>
              <div className="mt-2" data-testid="list-token-events">
                {tokenDetail.data?.events?.length ? (
                  <ul className="divide-y divide-slate-800">
                    {tokenDetail.data.events
                      .sort((a: any, b: any) => String(b.timestampISO).localeCompare(String(a.timestampISO)))
                      .slice(0, 40)
                      .map((e: any) => (
                        <li key={e.id} className="py-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">{e.type}</span>
                            <span className="text-xs text-slate-400">{new Date(e.timestampISO).toLocaleDateString()}</span>
                          </div>
                          <div className="text-xs text-slate-400 font-mono">
                            {fmtQty(e.amount)} {assetsById.get(e.assetId)?.symbol ?? e.assetId}
                            {e.type === 'SWAP' ? (
                              <> → {fmtQty((e as any).amountOut)} {assetsById.get((e as any).assetOutId)?.symbol ?? (e as any).assetOutId}</>
                            ) : null}
                          </div>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <div className="text-sm text-slate-400">No events found for this asset.</div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="font-medium">Lots</div>
              <div className="mt-2" data-testid="list-lots">
                {lots.length ? (
                  <ul className="divide-y divide-slate-800">
                    {lots.map((l: any) => (
                      <li key={l.lotId} className="py-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono">{fmtQty(l.amountRemaining)} {selectedSymbol}</span>
                          <span className="text-slate-400">{l.acquiredAtISO.slice(0, 10)}</span>
                        </div>
                        <div className="text-slate-400 font-mono">cost {fmtMoney(l.costBasisBaseRemaining, baseCurrency)}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-slate-400">No lots (position is empty or not yet derived).</div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-slate-500">
            Account filter is currently informational (snapshots are aggregated). Detailed per-account holdings will be added later.
          </div>
        </div>
      </div>
    </div>
  );
}
