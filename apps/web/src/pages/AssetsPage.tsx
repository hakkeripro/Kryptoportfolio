import { useEffect, useMemo, useState } from 'react';
import { ensureWebDbOpen, getWebDb } from '@kp/platform-web';
import type { Asset } from '@kp/core';
import { useAppStore } from '../store/useAppStore';
import { useDbQuery } from '../hooks/useDbQuery';
import { coingeckoSearch, type CoingeckoSearchCoin } from '../integrations/coingecko/coingeckoApi';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';
import { rebuildDerivedCaches } from '../derived/rebuildDerived';
import { refreshLivePrices } from '../derived/refreshLivePrices';

function kindLabel(a: Asset): string {
  // v3 domain model: Asset.type is 'crypto' | 'fiat'
  if (a.type === 'fiat') return 'Fiat';
  return 'Crypto';
}

export default function AssetsPage() {
  const apiBase = useAppStore((s) => s.apiBase);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CoingeckoSearchCoin[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const assetsQ = useDbQuery(
    async (db) => {
      const assets = await db.assets.toArray();
      assets.sort((a, b) => (a.symbol || '').localeCompare(b.symbol || ''));
      return assets;
    },
    [],
    [] as Asset[]
  );

  const { unmapped, mapped } = useMemo(() => {
    const all = assetsQ.data;
    // Fiat assets are not mapped to CoinGecko; they are priced via FX.
    const unm = all.filter((a) => !a.providerRef?.coingeckoId && a.type !== 'fiat');
    const map = all.filter((a) => !!a.providerRef?.coingeckoId);
    return { unmapped: unm, mapped: map };
  }, [assetsQ.data]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return assetsQ.data.find((a) => a.id === selectedId) ?? null;
  }, [assetsQ.data, selectedId]);

  // Auto-select first unmapped
  useEffect(() => {
    if (selectedId) return;
    if (unmapped.length) setSelectedId(unmapped[0].id);
  }, [selectedId, unmapped]);

  // Suggest query
  useEffect(() => {
    if (!selected) return;
    setQuery(selected.providerRef?.coingeckoId ? selected.providerRef.coingeckoId : selected.symbol || selected.name || '');
    setResults([]);
  }, [selected?.id]);

  async function doSearch() {
    setMsg(null);
    setSearchLoading(true);
    try {
      // coingeckoSearch returns an array of coins
      const coins = await coingeckoSearch(apiBase, query.trim());
      setResults(coins);
    } catch (e: any) {
      setMsg(String(e?.message ?? e ?? 'search_failed'));
    } finally {
      setSearchLoading(false);
    }
  }

  async function linkAsset(coin: CoingeckoSearchCoin) {
    if (!selected) return;
    setMsg(null);
    setLinking(true);
    try {
      await ensureWebDbOpen();
      const db = getWebDb();
      const now = new Date().toISOString();
      await db.assets.update(selected.id, {
        providerRef: { ...(selected.providerRef ?? {}), coingeckoId: coin.id },
        updatedAtISO: now
      });
      setMsg(`Linked ${selected.symbol} → ${coin.id}`);
    } catch (e: any) {
      setMsg(String(e?.message ?? e ?? 'link_failed'));
    } finally {
      setLinking(false);
    }
  }

  async function unlinkSelected() {
    if (!selected) return;
    setMsg(null);
    setLinking(true);
    try {
      await ensureWebDbOpen();
      const db = getWebDb();
      const now = new Date().toISOString();
      await db.assets.update(selected.id, {
        providerRef: { ...(selected.providerRef ?? {}), coingeckoId: undefined },
        updatedAtISO: now
      });
      setMsg('Unlinked.');
    } catch (e: any) {
      setMsg(String(e?.message ?? e ?? 'unlink_failed'));
    } finally {
      setLinking(false);
    }
  }

  async function refreshPricesAndRebuild() {
    setMsg(null);
    setLinking(true);
    try {
      const settings = await ensureDefaultSettings();
      const res = await refreshLivePrices(apiBase, settings.baseCurrency || 'EUR');
      await rebuildDerivedCaches({ daysBack: 365 });
      setMsg(`Live prices stored: ${res.stored}. Portfolio rebuilt.`);
    } catch (e: any) {
      setMsg(String(e?.message ?? e ?? 'refresh_failed'));
    } finally {
      setLinking(false);
    }
  }

  const mappedCount = mapped.length;
  const unmappedCount = unmapped.length;

  return (
    <div className="space-y-4" data-testid="page-assets">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Assets</h1>
          <div className="text-sm text-slate-500">
            Map assets to CoinGecko IDs (no symbol guessing). Unmapped assets block live pricing and some imports.
          </div>
        </div>
        <button
          className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          onClick={() => void refreshPricesAndRebuild()}
          disabled={linking || searchLoading}
          data-testid="btn-refresh-live-prices"
        >
          Refresh live prices + rebuild
        </button>
      </div>

      {msg ? (
        <div className="rounded-lg border bg-slate-50 p-3 text-sm" data-testid="toast-assets-msg">
          {msg}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Unmapped assets</div>
            <div className="text-xs text-slate-400" data-testid="badge-asset-counts">
              {unmappedCount} unmapped / {mappedCount} mapped
            </div>
          </div>

          <div className="mt-3">
            {assetsQ.loading ? (
              <div className="text-sm text-slate-400">Loading…</div>
            ) : unmappedCount ? (
              <div
                className="max-h-[520px] overflow-auto rounded-lg border border-slate-800"
                data-testid="list-unmapped-assets"
              >
                {unmapped.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedId(a.id)}
                    data-testid={`row-unmapped-${a.id}`}
                    className={`w-full text-left px-3 py-2 text-sm border-b border-slate-800 hover:bg-slate-800/50 ${
                      selectedId === a.id ? 'bg-slate-800/70' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{a.symbol || a.name}</div>
                      <div className="text-xs text-slate-400">{kindLabel(a)}</div>
                    </div>
                    {a.name ? <div className="text-xs text-slate-400">{a.name}</div> : null}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-400">All assets are mapped. ✅</div>
            )}
          </div>
        </div>

        <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm font-medium">Mapping</div>
              {selected ? (
                <div className="mt-1 text-sm text-slate-200" data-testid="selected-asset">
                  <span className="font-semibold">{selected.symbol || selected.name}</span>{' '}
                  <span className="text-slate-400">({selected.name || '—'})</span>
                </div>
              ) : (
                <div className="mt-1 text-sm text-slate-400">Select an asset from the left.</div>
              )}
            </div>
            {selected?.providerRef?.coingeckoId ? (
              <button
                className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                onClick={() => void unlinkSelected()}
                disabled={linking}
                data-testid="btn-unlink-coingecko"
              >
                Unlink
              </button>
            ) : null}
          </div>

          {selected ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm" data-testid="box-current-mapping">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Current coingeckoId</span>
                  <span className="font-mono" data-testid="txt-current-coingeckoId">
                    {selected.providerRef?.coingeckoId || '—'}
                  </span>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void doSearch();
                }}
                className="flex gap-2 flex-wrap"
              >
                <input
                  className="flex-1 min-w-[220px] rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search CoinGecko (e.g. bitcoin, ethereum)"
                  data-testid="form-coingecko-search"
                />
                <button
                  className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-white disabled:opacity-50"
                  type="submit"
                  disabled={searchLoading || !query.trim()}
                  data-testid="btn-coingecko-search"
                >
                  {searchLoading ? 'Searching…' : 'Search'}
                </button>
              </form>

              <div className="rounded-lg border border-slate-800" data-testid="list-coingecko-results">
                {results.length ? (
                  <div className="max-h-[420px] overflow-auto">
                    {results.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-2 text-sm"
                        data-testid={`row-coingecko-${c.id}`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-medium truncate">{c.name}</div>
                            <div className="text-xs text-slate-400 uppercase">{c.symbol}</div>
                            {typeof c.market_cap_rank === 'number' ? (
                              <div className="text-[11px] text-slate-400">rank #{c.market_cap_rank}</div>
                            ) : null}
                          </div>
                          <div className="text-xs text-slate-400 font-mono truncate">{c.id}</div>
                        </div>
                        <button
                          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium hover:bg-white disabled:opacity-50"
                          onClick={() => void linkAsset(c)}
                          disabled={linking}
                          data-testid={`btn-link-coingecko-${c.id}`}
                        >
                          Link
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-3 text-sm text-slate-400">Search to see results.</div>
                )}
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300" data-testid="box-asset-mapping-help">
                <div className="font-semibold text-slate-200">Why this matters</div>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>Live prices use CoinGecko IDs. Without mapping, portfolio value may be 0 for that asset.</li>
                  <li>Fee valuation and reward FMV mode can require deterministic pricing.</li>
                  <li>No symbol guessing: the mapping is explicit and audit-friendly.</li>
                </ul>
              </div>
            </div>
          ) : null}

          {assetsQ.loading ? null : mappedCount ? (
            <div className="mt-6">
              <div className="text-sm font-medium">Mapped assets</div>
              <div className="mt-2 max-h-[240px] overflow-auto rounded-lg border border-slate-800" data-testid="list-mapped-assets">
                {mapped.slice(0, 200).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-2 text-sm"
                    data-testid={`row-mapped-${a.id}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{a.symbol || a.name}</div>
                        <div className="text-xs text-slate-400">{kindLabel(a)}</div>
                      </div>
                      <div className="text-xs text-slate-400 font-mono truncate">{a.providerRef?.coingeckoId}</div>
                    </div>
                    <button
                      className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs hover:bg-slate-800/50"
                      onClick={() => setSelectedId(a.id)}
                      data-testid={`btn-edit-mapped-${a.id}`}
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>
              {mappedCount > 200 ? (
                <div className="mt-2 text-xs text-slate-400">Showing first 200 mapped assets.</div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-3 text-xs text-slate-400" data-testid="box-assets-stats">
            Total assets: {assetsQ.data.length}. Total unmapped: {unmappedCount}.{' '}
            {unmappedCount ? (
              <span>
                Estimated impact: {unmappedCount} asset(s) missing live prices.
              </span>
            ) : (
              <span>All set.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
