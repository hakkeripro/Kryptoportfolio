import { test, expect } from '@playwright/test';

async function resetApp(page: any, request: any) {
  await request.post('http://localhost:8788/__test/reset');
  await page.goto('/onboarding');
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('kp_web_v3');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
}

async function onboardAndRegister(page: any) {
  await page.goto('/onboarding');

  await page.getByTestId('form-vault-passphrase').fill('passphrase123');
  await page.getByTestId('form-vault-passphrase-confirm').fill('passphrase123');
  await page.getByTestId('btn-create-vault').click();
  await expect(page.getByTestId('badge-unlocked')).toBeVisible();

  const email = `e2e_${Date.now()}@example.com`;
  await page.getByTestId('form-auth-email').fill(email);
  await page.getByTestId('form-auth-password').fill('supersecret1');
  await page.getByTestId('btn-register').click();
  await page.getByTestId('btn-finish-onboarding').click();
  await expect(page.getByTestId('nav-dashboard')).toBeVisible();
}

async function importFixture(page: any) {
  // Use SPA navigation to keep the in-memory vault state (avoid full reload).
  await page.getByTestId('nav-imports').click();
  await expect(page.getByTestId('form-coinbase-keyname')).toBeVisible();

  await page.getByTestId('form-coinbase-keyname').fill('FIXTURE:basic');
  await page.getByTestId('form-coinbase-privatekey').fill('FIXTURE:basic');
  await page.getByTestId('btn-coinbase-connect').click();
  await expect(page.getByTestId('badge-coinbase-connected')).toBeVisible();

  await page.getByTestId('btn-import-run-all').click();
  await expect(page.getByTestId('list-import-preview')).toBeVisible();
  await page.getByTestId('badge-import-step-done').waitFor({ timeout: 20_000 });
}

test('tax report: generate for 2025 and export CSV', async ({ page, request }) => {
  await resetApp(page, request);
  await onboardAndRegister(page);
  await importFixture(page);

  await page.getByTestId('nav-tax').click();
  await expect(page.getByTestId('form-tax-year')).toBeVisible();

  await page.getByTestId('form-tax-year').selectOption('2025');
  await page.getByTestId('btn-tax-generate').click();

  await expect(page.getByTestId('list-tax-disposals')).toBeVisible();
  expect(await page.locator('[data-testid^="row-tax-disposal-"]').count()).toBeGreaterThan(0);

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('btn-tax-export-csv').click();
  const dl = await downloadPromise;
  expect(dl.suggestedFilename()).toContain('tax_2025');
});
