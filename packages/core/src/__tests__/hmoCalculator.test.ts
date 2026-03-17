import { describe, it, expect } from 'vitest';
import { applyHmo } from '../tax/hmoCalculator.js';
import type { Disposal } from '../domain/portfolio.js';

function makeDisposal(overrides: Partial<Disposal> & { eventId: string }): Disposal {
  return {
    eventId: overrides.eventId,
    assetId: 'asset-btc-uuid-0000-0000-000000000001',
    disposedAtISO: overrides.disposedAtISO ?? '2024-01-01T00:00:00.000Z',
    amount: overrides.amount ?? '1',
    proceedsBase: overrides.proceedsBase ?? '1000',
    costBasisBase: overrides.costBasisBase ?? '100',
    feeBase: overrides.feeBase ?? '0',
    realizedGainBase: overrides.realizedGainBase ?? '900',
    lotsMatched: overrides.lotsMatched ?? [
      {
        lotId: 'lot_1',
        amount: '1',
        costBasisBase: '100',
        acquiredAtISO: overrides.acquiredAtISO ?? '2022-01-01T00:00:00.000Z',
      },
    ],
    taxYear: overrides.taxYear ?? 2024,
  };
}

describe('applyHmo', () => {
  it('HMO 20% alle 10v — sovelletaan kun edullisempi', () => {
    // proceeds=1000, costBasis=100 → hmoCost=200 > actual=100 → apply
    const disposal = makeDisposal({
      eventId: 'ev-uuid-00000000-0000-0000-0000-000000000001',
      proceedsBase: '1000',
      costBasisBase: '100',
      disposedAtISO: '2024-01-01T00:00:00.000Z',
      acquiredAtISO: '2021-01-01T00:00:00.000Z', // ~3 years
    });
    const result = applyHmo([disposal], true);
    expect(result.adjustments).toHaveLength(1);
    const adj = result.adjustments[0]!;
    expect(adj.hmoRate).toBe(0.2);
    expect(adj.applied).toBe(true);
    expect(adj.hmoCostBasisBase).toBe('200');
    expect(adj.savedBase).toBe('100'); // 200-100
    expect(result.totalSavingBase).toBe('100');
  });

  it('HMO 20% alle 10v — EI sovelleta kun ei edullisempi', () => {
    // proceeds=1000, costBasis=850 → hmoCost=200 < actual=850 → do not apply
    const disposal = makeDisposal({
      eventId: 'ev-uuid-00000000-0000-0000-0000-000000000002',
      proceedsBase: '1000',
      costBasisBase: '850',
      disposedAtISO: '2024-01-01T00:00:00.000Z',
      acquiredAtISO: '2022-01-01T00:00:00.000Z', // ~2 years
    });
    const result = applyHmo([disposal], true);
    const adj = result.adjustments[0]!;
    expect(adj.hmoRate).toBe(0.2);
    expect(adj.applied).toBe(false);
    expect(result.totalSavingBase).toBe('0');
  });

  it('HMO 40% yli 10v — sovelletaan oikea rate', () => {
    const disposal = makeDisposal({
      eventId: 'ev-uuid-00000000-0000-0000-0000-000000000003',
      proceedsBase: '1000',
      costBasisBase: '100',
      disposedAtISO: '2024-01-01T00:00:00.000Z',
      acquiredAtISO: '2013-01-01T00:00:00.000Z', // ~11 years
    });
    const result = applyHmo([disposal], true);
    const adj = result.adjustments[0]!;
    expect(adj.hmoRate).toBe(0.4);
    expect(adj.hmoCostBasisBase).toBe('400');
    expect(adj.applied).toBe(true);
  });

  it('Juuri 10 vuoden raja — käyttää 40%', () => {
    // > 10 years: use a date clearly past the 10 year threshold
    // 2013-12-01 → 2024-01-01 = ~10.08 years (safely over)
    const disposal = makeDisposal({
      eventId: 'ev-uuid-00000000-0000-0000-0000-000000000004',
      proceedsBase: '1000',
      costBasisBase: '50',
      disposedAtISO: '2024-01-01T00:00:00.000Z',
      acquiredAtISO: '2013-12-01T00:00:00.000Z',
    });
    const result = applyHmo([disposal], true);
    const adj = result.adjustments[0]!;
    expect(adj.hmoRate).toBe(0.4);
    expect(adj.holdingYears).toBeGreaterThanOrEqual(10);
  });

  it('Useita disposaleja — osa sovelletaan, osa ei — totalSavingBase oikein', () => {
    const d1 = makeDisposal({
      eventId: 'ev-uuid-00000000-0000-0000-0000-000000000005',
      proceedsBase: '1000',
      costBasisBase: '100', // hmoCost=200 > 100 → apply, saved=100
      acquiredAtISO: '2021-01-01T00:00:00.000Z',
    });
    const d2 = makeDisposal({
      eventId: 'ev-uuid-00000000-0000-0000-0000-000000000006',
      proceedsBase: '500',
      costBasisBase: '450', // hmoCost=100 < 450 → no apply
      acquiredAtISO: '2022-01-01T00:00:00.000Z',
    });
    const result = applyHmo([d1, d2], true);
    expect(result.adjustments[0]!.applied).toBe(true);
    expect(result.adjustments[1]!.applied).toBe(false);
    expect(result.totalSavingBase).toBe('100');
  });

  it('Ilman acquiredAtISO — fallback holdingYears=0 → rate 20%', () => {
    const disposal: Disposal = {
      eventId: 'ev-uuid-00000000-0000-0000-0000-000000000007',
      assetId: 'asset-btc-uuid-0000-0000-000000000001',
      disposedAtISO: '2024-01-01T00:00:00.000Z',
      amount: '1',
      proceedsBase: '1000',
      costBasisBase: '100',
      feeBase: '0',
      realizedGainBase: '900',
      lotsMatched: [{ lotId: 'lot_1', amount: '1', costBasisBase: '100' }], // no acquiredAtISO
      taxYear: 2024,
    };
    const result = applyHmo([disposal], true);
    expect(result.adjustments[0]!.hmoRate).toBe(0.2);
    expect(result.adjustments[0]!.holdingYears).toBe(0);
  });

  it('hmoEnabled=false — kaikki applied=false, totalSavingBase=0', () => {
    const disposal = makeDisposal({
      eventId: 'ev-uuid-00000000-0000-0000-0000-000000000008',
      proceedsBase: '1000',
      costBasisBase: '100',
    });
    const result = applyHmo([disposal], false);
    expect(result.adjustments[0]!.applied).toBe(false);
    expect(result.totalSavingBase).toBe('0');
  });
});
