import { describe, it, expect } from 'vitest';
import { PROVIDER_REGISTRY, COMING_SOON_PROVIDERS } from './providerRegistry';

describe('providerRegistry', () => {
  it('contains coinbase, binance, kraken', () => {
    const ids = PROVIDER_REGISTRY.map((p) => p.descriptor.id);
    expect(ids).toContain('coinbase');
    expect(ids).toContain('binance');
    expect(ids).toContain('kraken');
  });

  it('every plugin has at least one capability (api or csv)', () => {
    for (const plugin of PROVIDER_REGISTRY) {
      const hasCapability = !!plugin.api || !!plugin.csv;
      expect(hasCapability).toBe(true);
    }
  });

  it('api capability has required functions', () => {
    for (const plugin of PROVIDER_REGISTRY) {
      if (!plugin.api) continue;
      expect(typeof plugin.api.ConnectForm).toBe('function');
      expect(typeof plugin.api.FetchPanel).toBe('function');
      expect(typeof plugin.api.isConnected).toBe('function');
      expect(typeof plugin.api.disconnect).toBe('function');
    }
  });

  it('csv capability has UploadForm', () => {
    for (const plugin of PROVIDER_REGISTRY) {
      if (!plugin.csv) continue;
      expect(typeof plugin.csv.UploadForm).toBe('function');
    }
  });

  it('binance has both api and csv capabilities', () => {
    const binance = PROVIDER_REGISTRY.find((p) => p.descriptor.id === 'binance');
    expect(binance?.api).toBeDefined();
    expect(binance?.csv).toBeDefined();
  });

  it('kraken has only api capability', () => {
    const kraken = PROVIDER_REGISTRY.find((p) => p.descriptor.id === 'kraken');
    expect(kraken?.api).toBeDefined();
    expect(kraken?.csv).toBeUndefined();
  });

  it('coming-soon providers have required fields', () => {
    expect(COMING_SOON_PROVIDERS.length).toBeGreaterThan(0);
    for (const d of COMING_SOON_PROVIDERS) {
      expect(typeof d.id).toBe('string');
      expect(typeof d.name).toBe('string');
      expect(Array.isArray(d.authMethods)).toBe(true);
    }
  });

  it('no duplicate provider ids across registry and coming-soon', () => {
    const allIds = [
      ...PROVIDER_REGISTRY.map((p) => p.descriptor.id),
      ...COMING_SOON_PROVIDERS.map((d) => d.id),
    ];
    const unique = new Set(allIds);
    expect(unique.size).toBe(allIds.length);
  });

  it('northcrypto and coinmotion are in coming-soon (Finnish exchanges)', () => {
    const ids = COMING_SOON_PROVIDERS.map((d) => d.id);
    expect(ids).toContain('northcrypto');
    expect(ids).toContain('coinmotion');
  });
});
