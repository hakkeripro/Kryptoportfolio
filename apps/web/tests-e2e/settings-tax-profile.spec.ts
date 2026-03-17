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

    // Select Sweden to make a change
    const countrySelector = page.getByTestId('form-settings-tax-country');
    await countrySelector.getByText('Sweden').click();

    // Save
    await page.getByTestId('btn-settings-save-tax-profile').click();

    // Success message
    await expect(page.getByTestId('metric-settings-save-status')).toBeVisible({ timeout: 5_000 });
  });

  test('onboarding: country step shown before passphrase', async ({ page, request }) => {
    await resetApp(page, request);
    await page.goto('/welcome');

    // Create account → vault setup
    await page.getByTestId('btn-create-account').click();
    await expect(page).toHaveURL(/\/auth\/signup/, { timeout: 5_000 });

    const email = `e2e_country_${Date.now()}@example.com`;
    await page.getByTestId('form-email').fill(email);
    await page.getByTestId('form-password').fill('supersecret1');
    await page.getByTestId('form-password-confirm').fill('supersecret1');
    await page.getByTestId('btn-signup').click();

    await expect(page.getByTestId('page-vault-setup')).toBeVisible({ timeout: 10_000 });

    // Country step should be visible
    await expect(page.getByTestId('country-selector')).toBeVisible();
    // Passphrase form should NOT be visible yet
    await expect(page.getByTestId('form-vault-passphrase')).not.toBeVisible();

    // Select Finland and continue
    await page.getByTestId('btn-country-fi').click();
    await page.getByTestId('btn-country-continue').click();

    // Passphrase step should now be visible
    await expect(page.getByTestId('form-vault-passphrase')).toBeVisible({ timeout: 5_000 });
  });
});
