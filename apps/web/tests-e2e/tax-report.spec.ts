import { test, expect } from '@playwright/test';
import { resetApp, signupAndSetupVault, spaNavigate } from './helpers';

async function onboardAndRegister(page: Parameters<typeof signupAndSetupVault>[0]) {
  await signupAndSetupVault(page);
}

async function importFixture(page: Parameters<typeof signupAndSetupVault>[0]) {
  // Use SPA navigation to keep the in-memory vault state (avoid full reload).
  await spaNavigate(page, '/transactions/import');
  await expect(page.getByTestId('form-coinbase-keyname')).toBeVisible();

  await page.getByTestId('form-coinbase-keyname').fill('FIXTURE:basic');
  await page.getByTestId('form-coinbase-privatekey').fill('FIXTURE:basic');
  await page.getByTestId('btn-coinbase-connect').click();
  const connected = page.getByTestId('badge-coinbase-connected');
  const err = page.getByTestId('alert-import-error');
  const start = Date.now();
  while (Date.now() - start < 15_000) {
    if (await connected.count()) {
      try {
        if (await connected.isVisible()) break;
      } catch {}
    }
    if (await err.count()) {
      try {
        if (await err.isVisible()) {
          const msg = (await err.innerText()).trim();
          throw new Error(`Coinbase connect failed: ${msg}`);
        }
      } catch (e) {
        throw e;
      }
    }
    await page.waitForTimeout(200);
  }
  await expect(connected).toBeVisible({ timeout: 5_000 });

  await page.getByTestId('btn-import-run-all').click();
  await expect(page.getByTestId('list-import-preview')).toBeVisible();
  await page.getByTestId('badge-import-step-done').waitFor({ timeout: 20_000 });
}

test('tax report: generate for 2025 — free user sees KPI cards and gate wall', async ({
  page,
  request,
}) => {
  await resetApp(page, request);
  await onboardAndRegister(page);
  await importFixture(page);

  await spaNavigate(page, '/taxes');
  await expect(page.getByTestId('form-tax-year')).toBeVisible();

  await page.getByTestId('form-tax-year').selectOption('2025');
  await page.getByTestId('btn-tax-generate').click();

  // Free user: KPI cards are visible after generating
  await expect(page.getByTestId('kpi-total-gains')).toBeVisible({ timeout: 5_000 });

  // Free user: blur overlay is shown instead of full disposals table
  await expect(page.getByTestId('blur-overlay').first()).toBeVisible();

  // Free user: clicking Export CSV opens upgrade modal
  await page.getByTestId('btn-tax-export-csv').click();
  await expect(page.getByTestId('upgrade-modal')).toBeVisible();
  await page.getByTestId('upgrade-modal-close').click();
  await expect(page.getByTestId('upgrade-modal')).not.toBeVisible();
});
