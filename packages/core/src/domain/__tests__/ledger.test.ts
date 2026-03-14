import { describe, it, expect } from 'vitest';
import {
  buildLedgerView,
  normalizeActiveLedger,
  feeValueBaseOrZero,
  assertFeeInvariants,
} from '../ledger';
import type { LedgerEvent } from '../ledger';

let _counter = 0;
function ev(partial: Partial<LedgerEvent>): LedgerEvent {
  _counter++;
  const ts = partial.timestampISO ?? '2025-01-01T00:00:00.000Z';
  const base: any = {
    id: `e_ledger_${_counter.toString().padStart(4, '0')}`,
    schemaVersion: 1,
    createdAtISO: ts,
    updatedAtISO: ts,
    timestampISO: ts,
    type: 'BUY',
    assetId: 'asset_btc',
    amount: '1',
    pricePerUnitBase: '10000',
    tags: [],
  };
  return { ...base, ...partial } as LedgerEvent;
}

describe('normalizeActiveLedger', () => {
  it('returns events sorted by timestamp', () => {
    const events = [
      ev({ id: 'e_b', timestampISO: '2025-01-02T00:00:00.000Z' }),
      ev({ id: 'e_a', timestampISO: '2025-01-01T00:00:00.000Z' }),
      ev({ id: 'e_c', timestampISO: '2025-01-03T00:00:00.000Z' }),
    ];
    const active = normalizeActiveLedger(events);
    expect(active.map((e) => e.id)).toEqual(['e_a', 'e_b', 'e_c']);
  });

  it('excludes isDeleted events (tombstones)', () => {
    const events = [ev({ id: 'e_keep' }), ev({ id: 'e_deleted', isDeleted: true })];
    const active = normalizeActiveLedger(events);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('e_keep');
  });

  it('excludes replaced events', () => {
    const events = [
      ev({ id: 'e_original' }),
      ev({ id: 'e_replacement', replacesEventId: 'e_original' }),
    ];
    const active = normalizeActiveLedger(events);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('e_replacement');
  });

  it('concurrent replacements: latest by updatedAtISO wins', () => {
    const events = [
      ev({
        id: 'e_original',
        timestampISO: '2025-01-01T00:00:00.000Z',
      }),
      ev({
        id: 'e_repl_old',
        replacesEventId: 'e_original',
        updatedAtISO: '2025-01-02T00:00:00.000Z',
        timestampISO: '2025-01-01T00:00:00.000Z',
        amount: '1',
      }),
      ev({
        id: 'e_repl_new',
        replacesEventId: 'e_original',
        updatedAtISO: '2025-01-03T00:00:00.000Z',
        timestampISO: '2025-01-01T00:00:00.000Z',
        amount: '2',
      }),
    ];
    const active = normalizeActiveLedger(events);
    // original is replaced, old replacement is not the latest -> 2 remain: repl_old + repl_new
    // Actually the logic: replacedById maps e_original -> e_repl_new (latest).
    // Then filter: e_original is in replacedById -> excluded.
    // e_repl_old: not in replacedById -> included
    // e_repl_new: not in replacedById -> included
    expect(active.some((e) => e.id === 'e_original')).toBe(false);
    expect(active.some((e) => e.id === 'e_repl_new')).toBe(true);
  });

  it('empty input returns empty', () => {
    expect(normalizeActiveLedger([])).toEqual([]);
  });

  it('replacement of non-existent event still includes replacement', () => {
    const events = [ev({ id: 'e_orphan_repl', replacesEventId: 'e_nonexistent' })];
    const active = normalizeActiveLedger(events);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('e_orphan_repl');
  });
});

describe('buildLedgerView', () => {
  it('returns replacedById mapping', () => {
    const events = [ev({ id: 'e_orig' }), ev({ id: 'e_repl', replacesEventId: 'e_orig' })];
    const view = buildLedgerView(events);
    expect(view.replacedById['e_orig']).toBe('e_repl');
    expect(view.allEvents).toHaveLength(2);
    expect(view.activeEvents).toHaveLength(1);
  });
});

describe('feeValueBaseOrZero', () => {
  it('returns feeBase when set', () => {
    const e = ev({ feeBase: '50' });
    expect(feeValueBaseOrZero(e)).toBe('50');
  });

  it('returns feeValueBase when feeBase is not set', () => {
    const e = ev({ feeValueBase: '25' });
    expect(feeValueBaseOrZero(e)).toBe('25');
  });

  it('returns 0 when no fee fields set', () => {
    const e = ev({});
    expect(feeValueBaseOrZero(e)).toBe('0');
  });

  it('prefers feeBase over feeValueBase', () => {
    const e = ev({ feeBase: '50', feeValueBase: '25' });
    expect(feeValueBaseOrZero(e)).toBe('50');
  });
});

describe('assertFeeInvariants', () => {
  it('no error when no token fee', () => {
    expect(() => assertFeeInvariants(ev({}))).not.toThrow();
  });

  it('no error when token fee has amount and valueBase', () => {
    expect(() =>
      assertFeeInvariants(ev({ feeAssetId: 'asset_btc', feeAmount: '0.001', feeValueBase: '10' })),
    ).not.toThrow();
  });

  it('throws when token fee has no feeAmount', () => {
    expect(() => assertFeeInvariants(ev({ feeAssetId: 'asset_btc', feeValueBase: '10' }))).toThrow(
      'ledger_fee_missing_amount',
    );
  });

  it('throws when token fee has no value base', () => {
    expect(() => assertFeeInvariants(ev({ feeAssetId: 'asset_btc', feeAmount: '0.001' }))).toThrow(
      'ledger_fee_missing_value_base',
    );
  });
});
