import { test, expect } from '@playwright/test';
import { resetApp, signupAndSetupVault, spaNavigate } from './helpers';

test.describe('Feature 24: Settings Tax Profile', () => {
  test('settings page shows all 5 sections', async ({ page, request }) => {
    await resetApp(page, request);
    await signupAndSetupVault(page);
    await spaNavigate(page, '/settings');

    await expect(page.getByTestId('page-settings')).toBeVisible();
    await expect(page.getByTestId('section-account')).toBeVisible();
    await expect(page.getByTestId('section-tax-profile')).toBeVisible();
    await expect(page.getByTestId('section-notifications')).toBeVisible();
    await expect(page.getByTestId('section-integrations')).toBeVisible();
    await expect(page.getByTestId('section-danger-zone')).toBeVisible();
  });

  test('TaxProfileCard: select FI disables lot method and shows HMO toggle', async ({
    page,
    request,
  }) => {
    await resetApp(page, request);
    await signupAndSetupVault(page);
    await spaNavigate(page, '/settings');

    await expect(page.getByTestId('card-tax-profile')).toBeVisible();

    // Initially HMO toggle should not be visible
    await expect(page.getByTestId('form-settings-hmo-enabled')).not.toBeVisible();

    // Click Finland country button
    const countrySelector = page.getByTestId('form-settings-tax-country');
    await countrySelector.getByText('Finland').click();

    // Lot method should be disabled
    const lotMethodSelect = page.getByTestId('form-settings-lot-method-default');
    await expect(lotMethodSelect).toBeDisabled();

    // HMO toggle should appear
    await expect(page.getByTestId('form-settings-hmo-enabled')).toBeVisible();
  });

  test('TaxProfileCard: save settings shows success message', async ({ page, request }) => {
    await resetApp(page, request);
    await signupAndSetupVault(page);
    await spaNavigate(page, '/settings');

    await expect(page.getByTestId('card-tax-profile')).toBeVisible();

    // Select Other to make a change (Sweden/DE are coming-soon disabled)
    const countrySelector = page.getByTestId('form-settings-tax-country');
    await countrySelector.getByText('Other').click();

    // Save
    await page.getByTestId('btn-settings-save-tax-profile').click();

    // Success message
    await expect(page.getByTestId('metric-settings-save-status')).toBeVisible({ timeout: 5_000 });
  });

  test('onboarding: country selector and passphrase visible on signup page', async ({
    page,
    request,
  }) => {
    await resetApp(page, request);
    await page.goto('/auth/signup');

    // Both country selector and passphrase form are on the same combined signup+vault page
    await expect(page.getByTestId('country-selector')).toBeVisible();
    await expect(page.getByTestId('form-vault-passphrase')).toBeVisible();

    // Can select Finland
    await page.getByTestId('btn-country-fi').click();
  });
});
