import { useEffect, useMemo, useRef, useState } from 'react';
import Decimal from 'decimal.js';
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell, Line, LineChart, XAxis, YAxis } from 'recharts';
import { ensureWebDbOpen, getMeta, getWebDb } from '@kp/platform-web';
import { rebuildDerivedCaches } from '../derived/rebuildDerived';
import { refreshLivePrices } from '../derived/refreshLivePrices';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';
import { useDbQuery } from '../hooks/useDbQuery';
import { useAppStore } from '../store/useAppStore';

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
  const rounded = x.toDecimalPlaces(2);
  return `${rounded.toFixed()} ${currency}`;
}

const PALETTE = [
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#a78bfa',
  '#fb7185',
  '#22d3ee',
  '#c084fc',
  '#4ade80',
  '#f97316'
];

function colorForKey(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export default function DashboardPage() {
  const apiBase = useAppStore((s) => s.apiBase);
  const dbState = useDbQuery(
    async (db) => {
      await ensureWebDbOpen();
      const settings = ((await db.settings.get('settings_1')) as any) ?? (await ensureDefaultSettings());
      const latest = await db.portfolioSnapshots.orderBy('dayISO').last();
      const snaps = await db.portfolioSnapshots.orderBy('dayISO').reverse().limit(120).toArray(); // ~4 months
      const assets = await db.assets.toArray();
      return { settings, latest, snaps: snaps.reverse(), assets };
    },
    [],
    { settings: null as any, latest: null as any, snaps: [] as any[], assets: [] as any[] }
  );

  const [status, setStatus] = useState<{ lastRebuildISO: string | null }>({ lastRebuildISO: null });
  const [refreshing, setRefreshing] = useState(false);
  const refreshLock = useRef(false);

  useEffect(() => {
    void (async () => {
      const lastRebuildISO = await getMeta('derived:lastRebuildISO');
      setStatus({ lastRebuildISO: lastRebuildISO || null });
    })();
  }, [dbState.data.latest?.dayISO]);

  const baseCurrency = (dbState.data.settings?.baseCurrency ?? 'EUR').toUpperCase();

  const metrics = useMemo(() => {
    const latest = dbState.data.latest;
    return {
      totalValueBase: latest?.totalValueBase ?? '0',
      realizedPnlBaseToDate: latest?.realizedPnlBaseToDate ?? '0',
      unrealizedPnlBase: latest?.unrealizedPnlBase ?? '0'
    };
  }, [dbState.data.latest]);

  const allocation = useMemo(() => {
    const latest = dbState.data.latest;
    if (!latest?.positions?.length) return [] as { name: string; value: number; assetId: string }[];
    const nameById = new Map(dbState.data.assets.map((a: any) => [a.id, a.symbol]));
    return latest.positions
      .map((p: any) => ({
        assetId: p.assetId,
        name: nameById.get(p.assetId) ?? p.assetId,
        value: Number(d(p.valueBase).toNumber())
      }))
      .filter((x) => Number.isFinite(x.value) && x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [dbState.data.latest, dbState.data.assets]);

  const topPositions = useMemo(() => {
    const latest = dbState.data.latest;
    if (!latest?.positions?.length) return [] as any[];
    const byId = new Map(dbState.data.assets.map((a: any) => [a.id, a]));
    return [...latest.positions]
      .sort((a: any, b: any) => d(b.valueBase).cmp(d(a.valueBase)))
      .slice(0, 8)
      .map((p: any) => ({ ...p, symbol: byId.get(p.assetId)?.symbol ?? p.assetId }));
  }, [dbState.data.latest, dbState.data.assets]);

  const valueSeries = useMemo(() => {
    return dbState.data.snaps.map((s: any) => ({ day: s.dayISO, value: Number(d(s.totalValueBase).toNumber()) }));
  }, [dbState.data.snaps]);

  const autoRefreshEnabled = (dbState.data.settings?.autoRefreshIntervalSec ?? 0) > 0;
  const [autoRefresh, setAutoRefresh] = useState(autoRefreshEnabled);

  useEffect(() => {
    setAutoRefresh(autoRefreshEnabled);
  }, [autoRefreshEnabled]);

  useEffect(() => {
    let timer: number | null = null;
    if (!autoRefresh) return;

    const intervalSec = dbState.data.settings?.autoRefreshIntervalSec ?? 300;
    const ms = Math.max(60_000, intervalSec * 1000);
    timer = window.setInterval(() => void refreshNow({ silent: true }), ms);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [autoRefresh, dbState.data.settings?.autoRefreshIntervalSec]);

  async function toggleAutoRefresh(next: boolean) {
    setAutoRefresh(next);
    await ensureWebDbOpen();
    const db = getWebDb();
    const s = ((await db.settings.get('settings_1')) as any) ?? (await ensureDefaultSettings());
    const updated = {
      ...s,
      updatedAtISO: new Date().toISOString(),
      autoRefreshIntervalSec: next ? (s.autoRefreshIntervalSec && s.autoRefreshIntervalSec !== 0 ? s.autoRefreshIntervalSec : 300) : 0
    };
    await db.settings.put(updated as any);
  }

  async function refreshNow(opts?: { silent?: boolean }) {
    if (refreshLock.current) return;
    refreshLock.current = true;
    if (!opts?.silent) setRefreshing(true);
    try {
      // Best-effort live prices (requires mapped CoinGecko IDs).
      try {
        await refreshLivePrices(apiBase, baseCurrency);
      } catch {
        // Ignore live price fetch failures; snapshot rebuild still works from imported valuations.
      }
      await rebuildDerivedCaches({ daysBack: 365 });
      const lastRebuildISO = await getMeta('derived:lastRebuildISO');
      setStatus({ lastRebuildISO: lastRebuildISO || new Date().toISOString() });
    } finally {
      refreshLock.current = false;
      if (!opts?.silent) setRefreshing(false);
    }
  }

  const statusText = status.lastRebuildISO ? `last rebuild: ${new Date(status.lastRebuildISO).toLocaleString()}` : 'cached';

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="flex gap-2">
          <button
            data-testid="btn-refresh-prices"
            className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-2 text-sm disabled:opacity-50"
            onClick={() => void refreshNow()}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <label className="flex items-center gap-2 text-sm" data-testid="toggle-auto-refresh">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => void toggleAutoRefresh(e.target.checked)} />
            Auto refresh
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs text-slate-400">Total value</div>
          <div data-testid="metric-total-value" className="text-lg font-semibold">
            {fmtMoney(metrics.totalValueBase, baseCurrency)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs text-slate-400">Realized</div>
          <div data-testid="metric-realized" className="text-lg font-semibold">
            {fmtMoney(metrics.realizedPnlBaseToDate, baseCurrency)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs text-slate-400">Unrealized</div>
          <div data-testid="metric-unrealized" className="text-lg font-semibold">
            {fmtMoney(metrics.unrealizedPnlBase, baseCurrency)}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between">
          <div className="font-medium">Price / derived status</div>
          <span data-testid="badge-price-status" className="text-xs rounded bg-slate-800 px-2 py-1">
            {statusText}
          </span>
        </div>
        {dbState.error ? <div className="text-sm text-red-300 mt-2">{dbState.error}</div> : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div data-testid="chart-allocation" className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="font-medium mb-2">Allocation</div>
          {allocation.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip />
                  <Pie data={allocation} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                    {allocation.map((x) => (
                      <Cell key={x.assetId} fill={colorForKey(x.assetId)} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-sm text-slate-400">No data yet. Import transactions to build snapshots.</div>
          )}
        </div>

        <div data-testid="chart-portfolio-value" className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="font-medium mb-2">Portfolio value</div>
          {valueSeries.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={valueSeries}>
                  <Tooltip />
                  <XAxis dataKey="day" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Line type="monotone" dataKey="value" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-sm text-slate-400">No snapshots yet.</div>
          )}
        </div>
      </div>

      <div data-testid="card-portfolio-top" className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="font-medium mb-2">Top positions</div>
        <div data-testid="list-top-positions">
          {topPositions.length ? (
            <ul className="divide-y divide-slate-800">
              {topPositions.map((p: any) => (
                <li key={p.assetId} className="py-2 flex items-center justify-between">
                  <div className="text-sm">{p.symbol}</div>
                  <div className="text-sm font-mono">{fmtMoney(p.valueBase, baseCurrency)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-slate-400">No positions yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
