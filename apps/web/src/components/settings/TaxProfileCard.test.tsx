import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import type { Settings } from '@kp/core';

afterEach(() => cleanup());

// Mocks
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@kp/platform-web', () => ({
  ensureWebDbOpen: vi.fn().mockResolvedValue(undefined),
  getWebDb: vi.fn().mockReturnValue({
    settings: { get: vi.fn().mockResolvedValue(null) },
  }),
}));

vi.mock('../../derived/rebuildDerived', () => ({
  rebuildDerivedCaches: vi.fn().mockResolvedValue(undefined),
}));

const makeSettings = (overrides: Partial<Settings> = {}): Settings =>
  ({
    id: 'settings_1',
    schemaVersion: 1,
    createdAtISO: '2026-01-01T00:00:00.000Z',
    updatedAtISO: '2026-01-01T00:00:00.000Z',
    isDeleted: false,
    baseCurrency: 'EUR',
    lotMethodDefault: 'FIFO',
    rewardsCostBasisMode: 'ZERO',
    priceProvider: 'coingecko',
    autoRefreshIntervalSec: 300,
    taxProfile: 'GENERIC',
    privacy: { telemetryOptIn: false },
    ...overrides,
  }) as Settings;

describe('TaxProfileCard', () => {
  it('renders card', async () => {
    const { default: TaxProfileCard } = await import('./TaxProfileCard');
    render(
      <TaxProfileCard
        settings={makeSettings()}
        loading={false}
        error={null}
        busy={false}
        setBusy={vi.fn()}
      />,
    );
    expect(screen.getByTestId('card-tax-profile')).toBeTruthy();
    expect(screen.getByTestId('form-settings-tax-country')).toBeTruthy();
  });

  it('lot method select is disabled when taxCountry=FI', async () => {
    const { default: TaxProfileCard } = await import('./TaxProfileCard');
    render(
      <TaxProfileCard
        settings={makeSettings({ taxCountry: 'FI' })}
        loading={false}
        error={null}
        busy={false}
        setBusy={vi.fn()}
      />,
    );
    const select = screen.getByTestId('form-settings-lot-method-default') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(select.value).toBe('FIFO');
  });

  it('HMO toggle is visible when taxCountry=FI', async () => {
    const { default: TaxProfileCard } = await import('./TaxProfileCard');
    render(
      <TaxProfileCard
        settings={makeSettings({ taxCountry: 'FI' })}
        loading={false}
        error={null}
        busy={false}
        setBusy={vi.fn()}
      />,
    );
    expect(screen.getByTestId('form-settings-hmo-enabled')).toBeTruthy();
  });

  it('HMO toggle is NOT visible when taxCountry is not FI', async () => {
    const { default: TaxProfileCard } = await import('./TaxProfileCard');
    render(
      <TaxProfileCard
        settings={makeSettings({ taxCountry: 'SE' })}
        loading={false}
        error={null}
        busy={false}
        setBusy={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('form-settings-hmo-enabled')).toBeNull();
  });

  it('clicking FI country button disables lot method and shows HMO toggle', async () => {
    const { default: TaxProfileCard } = await import('./TaxProfileCard');
    render(
      <TaxProfileCard
        settings={makeSettings()}
        loading={false}
        error={null}
        busy={false}
        setBusy={vi.fn()}
      />,
    );
    // Initially no HMO toggle
    expect(screen.queryByTestId('form-settings-hmo-enabled')).toBeNull();

    // Click Finland button
    const buttons = screen.getAllByRole('button');
    const fiBtn = buttons.find((b) => b.textContent?.includes('Finland'));
    expect(fiBtn).toBeTruthy();
    fireEvent.click(fiBtn!);

    // Now HMO toggle should appear and lot method should be disabled
    expect(screen.getByTestId('form-settings-hmo-enabled')).toBeTruthy();
    const select = screen.getByTestId('form-settings-lot-method-default') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });
});
