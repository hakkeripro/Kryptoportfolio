import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Decimal from 'decimal.js';
import { PieChart } from 'lucide-react';
import { usePortfolioData } from '../hooks/usePortfolioData';
import TokenDetailDrawer from '../components/TokenDetailDrawer';
import PageHeader from '../components/PageHeader';
import { Card, EmptyState, TokenIcon } from '../components/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/Select';

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
  const { t } = useTranslation();
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
    <div className="space-y-section">
      <PageHeader title={t('portfolio.title')} />

      {/* Filters */}
      <div className="flex gap-3 items-end flex-wrap">
        <div className="w-44">
          <Select
            value={accountFilter}
            onValueChange={setAccountFilter}
          >
            <SelectTrigger data-testid="filter-account">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('portfolio.filter.allAccounts')}</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-36">
          <Select
            value={sort}
            onValueChange={(v) => setSort(v as 'value' | 'name')}
          >
            <SelectTrigger data-testid="sort-positions">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="value">{t('portfolio.sort.value')}</SelectItem>
              <SelectItem value="name">{t('portfolio.sort.name')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Holdings */}
      <Card>
        <div data-testid="list-positions">
          {positions.length ? (
            <ul className="divide-y divide-border/50">
              {positions.map((p, i) => {
                const a = assetsById.get(p.assetId);
                const sym = a?.symbol ?? p.assetId;
                const pnl = d(p.unrealizedPnlBase);
                return (
                  <li
                    key={p.assetId}
                    className="group py-3 flex items-center justify-between gap-3 hover:bg-surface-overlay/30 hover:shadow-sm
                      rounded-button px-2 -mx-2 cursor-pointer transition-all duration-150 ease-expo animate-slide-up"
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() => setSelectedAssetId(p.assetId)}
                    data-testid={`row-position-${p.assetId}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <TokenIcon symbol={sym} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-body font-semibold text-content-primary">
                            {sym}
                          </span>
                          <span className="text-caption text-content-tertiary truncate">
                            {a?.name ?? ''}
                          </span>
                        </div>
                        <div className="text-caption text-content-secondary font-mono">
                          {fmtQty(p.amount)} · {t('portfolio.row.cost')}{' '}
                          {fmtMoney(p.costBasisBase, baseCurrency)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-body font-mono text-content-primary">
                        {fmtMoney(p.valueBase, baseCurrency)}
                      </div>
                      <div
                        className={`text-caption font-mono ${pnl.isPositive() ? 'text-semantic-success' : pnl.isNegative() ? 'text-semantic-error' : 'text-content-tertiary'}`}
                      >
                        {pnl.isPositive() ? '+' : ''}
                        {fmtMoney(p.unrealizedPnlBase, baseCurrency)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={<PieChart className="h-10 w-10" />}
              title={t('portfolio.empty.title')}
              description={t('portfolio.empty.desc')}
              actionLabel={t('portfolio.empty.action')}
              onAction={() => window.location.assign('/transactions/import')}
            />
          )}
        </div>
      </Card>

      {selectedAssetId && (
        <TokenDetailDrawer
          assetId={selectedAssetId}
          assetsById={assetsById}
          baseCurrency={baseCurrency}
          position={positionForSelected}
          events={dbState.data.events}
          settings={dbState.data.settings}
          onClose={() => setSelectedAssetId(null)}
        />
      )}
    </div>
  );
}
