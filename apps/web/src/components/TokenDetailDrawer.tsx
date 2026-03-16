import { useMemo } from 'react';
import Decimal from 'decimal.js';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import type { Asset, LedgerEvent, Lot, Settings } from '@kp/core';
import { replayLedgerToLotsAndDisposals } from '@kp/core';
import { ensureWebDbOpen } from '@kp/platform-web';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';
import { useDbQuery } from '../hooks/useDbQuery';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui';
import { TokenIcon } from './ui/TokenIcon';

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
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full max-w-2xl bg-surface-base border-l border-border p-0 overflow-y-auto"
        data-testid="drawer-tokendetail"
      >
        <div className="p-5">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-3">
              <TokenIcon symbol={symbol} size="md" />
              <div>
                <div className="font-heading text-heading-2 text-content-primary">{symbol}</div>
                <div className="text-sm text-content-secondary font-normal">{name}</div>
              </div>
            </SheetTitle>
          </SheetHeader>

          {position ? (
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Amount', value: fmtQty(position.amount) },
                { label: 'Value', value: fmtMoney(position.valueBase, baseCurrency) },
                { label: 'Unrealized P&L', value: fmtMoney(position.unrealizedPnlBase, baseCurrency) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-surface-raised border border-border p-3">
                  <div className="text-[11px] text-content-secondary mb-1">{label}</div>
                  <div className="text-sm font-mono text-content-primary font-medium">{value}</div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-surface-raised p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-heading text-heading-4 text-content-primary">Price ({baseCurrency})</div>
              {!priceSeries.length ? (
                <span
                  className="text-[11px] rounded bg-amber-900/30 border border-amber-800 px-2 py-1 text-amber-200"
                  data-testid="badge-token-missing-price"
                >
                  missing price data
                </span>
              ) : null}
            </div>
            <div className="h-56" data-testid="chart-token-price">
              {priceSeries.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={priceSeries}>
                    <Tooltip
                      contentStyle={{ background: '#1A1A1A', border: '1px solid #2E2E2E', borderRadius: '8px' }}
                      labelStyle={{ color: '#B8B9B6' }}
                      itemStyle={{ color: '#FF8400' }}
                    />
                    <XAxis dataKey="t" hide />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Line type="monotone" dataKey="v" dot={false} stroke="#FF8400" strokeWidth={1.5} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm text-content-secondary">
                  No price points yet. Imports add deterministic price points from ledger.
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-surface-raised p-4">
              <div className="font-heading text-heading-4 text-content-primary mb-3">Events</div>
              <div data-testid="list-token-events">
                {assetEvents.length ? (
                  <ul className="divide-y divide-border/60">
                    {assetEvents.map((e) => (
                      <li key={e.id} className="py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-content-primary">{e.type}</span>
                          <span className="text-[11px] text-content-secondary">
                            {new Date(e.timestampISO).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="text-[11px] text-content-secondary font-mono mt-0.5">
                          {fmtQty(e.amount)} {assetsById.get(e.assetId ?? '')?.symbol ?? e.assetId}
                          {e.type === 'SWAP' ? (
                            <> → {fmtQty(e.amountOut)} {assetsById.get(e.assetOutId)?.symbol ?? e.assetOutId}</>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-content-secondary">No events found for this asset.</div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface-raised p-4">
              <div className="font-heading text-heading-4 text-content-primary mb-3">Lots</div>
              <div data-testid="list-lots">
                {lots.length ? (
                  <ul className="divide-y divide-border/60">
                    {lots.map((l) => (
                      <li key={l.lotId} className="py-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-mono text-content-primary">
                            {fmtQty(l.amountRemaining)} {symbol}
                          </span>
                          <span className="text-[11px] text-content-secondary">{l.acquiredAtISO.slice(0, 10)}</span>
                        </div>
                        <div className="text-[11px] text-content-secondary font-mono">
                          cost {fmtMoney(l.costBasisBaseRemaining, baseCurrency)}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-content-secondary">No lots (position is empty or not yet derived).</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
