import { describe, it, expect } from 'vitest';
import { PROVIDER_REGISTRY, COMING_SOON_PROVIDERS } from './providerRegistry';

describe('providerRegistry', () => {
  it('contains coinbase as the first provider', () => {
    expect(PROVIDER_REGISTRY.length).toBeGreaterThanOrEqual(1);
    expect(PROVIDER_REGISTRY[0]?.descriptor.id).toBe('coinbase');
  });

  it('every plugin implements the required interface', () => {
    for (const plugin of PROVIDER_REGISTRY) {
      expect(typeof plugin.descriptor.id).toBe('string');
      expect(typeof plugin.descriptor.name).toBe('string');
      expect(Array.isArray(plugin.descriptor.authMethods)).toBe(true);
      expect(typeof plugin.ConnectForm).toBe('function');
      expect(typeof plugin.FetchPanel).toBe('function');
      expect(typeof plugin.isConnected).toBe('function');
      expect(typeof plugin.disconnect).toBe('function');
    }
  });

  it('coming-soon providers have required fields', () => {
    expect(COMING_SOON_PROVIDERS.length).toBeGreaterThan(0);
    for (const d of COMING_SOON_PROVIDERS) {
      expect(typeof d.id).toBe('string');
      expect(typeof d.name).toBe('string');
      expect(Array.isArray(d.authMethods)).toBe(true);
    }
  });

  it('no duplicate provider ids', () => {
    const allIds = [
      ...PROVIDER_REGISTRY.map((p) => p.descriptor.id),
      ...COMING_SOON_PROVIDERS.map((d) => d.id),
    ];
    const unique = new Set(allIds);
    expect(unique.size).toBe(allIds.length);
  });
});
