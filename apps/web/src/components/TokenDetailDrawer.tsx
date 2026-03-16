import { useMemo } from 'react';
import Decimal from 'decimal.js';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import type { Asset, LedgerEvent, Lot, Settings } from '@kp/core';
import { replayLedgerToLotsAndDisposals } from '@kp/core';
import { ensureWebDbOpen } from '@kp/platform-web';
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
  return `${d(val).toDecimalPlaces(2).toFixed()} ${currency}`;
}

function fmtQty(val: string | undefined | null): string {
  const s = d(val).toDecimalPlaces(8).toFixed();
  return s.replace(/\.0+$/, '').replace(/(\.[0-9]*?)0+$/, '$1');
}

interface Props {
  assetId: string;
  assetsById: Map<string, Asset>;
  baseCurrency: string;
  position: { amount: string; valueBase: string; unrealizedPnlBase?: string } | null;
  events: LedgerEvent[];
  settings: Settings | null;
  onClose: () => void;
}

export default function TokenDetailDrawer({
  assetId,
  assetsById,
  baseCurrency,
  position,
  events,
  settings,
  onClose,
}: Props) {
  const asset = assetsById.get(assetId);
  const symbol = asset?.symbol ?? assetId;
  const name = asset?.name ?? symbol;

  const tokenDetail = useDbQuery(
    async (db) => {
      if (!assetId) return null;
      await ensureWebDbOpen();
      const prices = await db.pricePoints.where('assetId').equals(assetId).sortBy('timestampISO');
      return { prices };
    },
    [assetId],
    null,
  );

  const priceSeries = useMemo(() => {
    const rows = tokenDetail.data?.prices ?? [];
    return rows
      .slice(-180)
      .map((p) => ({ t: p.timestampISO.slice(0, 10), v: Number(d(p.priceBase).toNumber()) }))
      .filter((x) => Number.isFinite(x.v));
  }, [tokenDetail.data?.prices]);

  const lots: Lot[] = useMemo(() => {
    if (!assetId || !events.length) return [];
    const replay = replayLedgerToLotsAndDisposals(events, settings ?? ({} as Settings));
    return replay.lotsByAssetId[assetId] ?? [];
  }, [events, settings, assetId]);

  // Filter events for this asset (including swaps where assetOutId matches)
  const assetEvents = useMemo(() => {
    return events
      .filter((e) => {
        if (e.assetId === assetId) return true;
        if (e.type === 'SWAP' && e.assetOutId === assetId) return true;
        return false;
      })
      .sort((a, b) => String(b.timestampISO).localeCompare(String(a.timestampISO)))
      .slice(0, 40);
  }, [events, assetId]);

  return (
    <div data-testid="drawer-tokendetail" className="fixed inset-0 z-20" aria-hidden="false">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-surface-base border-l border-border p-4 overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">{symbol}</div>
            <div className="text-sm text-content-secondary">{name}</div>
          </div>
          <button
            data-testid="btn-close-tokendetail"
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-raised"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {position ? (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-surface-raised border border-border p-3">
              <div className="text-xs text-content-secondary">Amount</div>
              <div className="text-sm font-mono">{fmtQty(position.amount)}</div>
            </div>
            <div className="rounded-lg bg-surface-raised border border-border p-3">
              <div className="text-xs text-content-secondary">Value</div>
              <div className="text-sm font-mono">{fmtMoney(position.valueBase, baseCurrency)}</div>
            </div>
            <div className="rounded-lg bg-surface-raised border border-border p-3">
              <div className="text-xs text-content-secondary">Unrealized</div>
              <div className="text-sm font-mono">
                {fmtMoney(position.unrealizedPnlBase, baseCurrency)}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-border bg-surface-raised p-4">
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
              <div className="text-sm text-content-secondary">
                No price points yet. Imports add deterministic price points from ledger; later
                versions will fetch external prices.
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-surface-raised p-4">
            <div className="font-medium">Events</div>
            <div className="mt-2" data-testid="list-token-events">
              {assetEvents.length ? (
                <ul className="divide-y divide-border">
                  {assetEvents.map((e) => (
                    <li key={e.id} className="py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{e.type}</span>
                        <span className="text-xs text-content-secondary">
                          {new Date(e.timestampISO).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-xs text-content-secondary font-mono">
                        {fmtQty(e.amount)} {assetsById.get(e.assetId ?? '')?.symbol ?? e.assetId}
                        {e.type === 'SWAP' ? (
                          <>
                            {' '}
                            → {fmtQty(e.amountOut)}{' '}
                            {assetsById.get(e.assetOutId)?.symbol ?? e.assetOutId}
                          </>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-content-secondary">
                  No events found for this asset.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface-raised p-4">
            <div className="font-medium">Lots</div>
            <div className="mt-2" data-testid="list-lots">
              {lots.length ? (
                <ul className="divide-y divide-border">
                  {lots.map((l) => (
                    <li key={l.lotId} className="py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono">
                          {fmtQty(l.amountRemaining)} {symbol}
                        </span>
                        <span className="text-content-secondary">
                          {l.acquiredAtISO.slice(0, 10)}
                        </span>
                      </div>
                      <div className="text-content-secondary font-mono">
                        cost {fmtMoney(l.costBasisBaseRemaining, baseCurrency)}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-content-secondary">
                  No lots (position is empty or not yet derived).
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-content-tertiary">
          Account filter is currently informational (snapshots are aggregated). Detailed per-account
          holdings will be added later.
        </div>
      </div>
    </div>
  );
}
