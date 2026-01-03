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

test('coinbase import: fixture → preview → commit → portfolio + transactions update', async ({ page, request }) => {
  await resetApp(page, request);
  await onboardAndRegister(page);

  // Use SPA navigation to keep the in-memory vault state (avoid full reload).
  await page.getByTestId('nav-imports').click();
  await expect(page.getByTestId('form-coinbase-keyname')).toBeVisible();

  await page.getByTestId('form-coinbase-keyname').fill('FIXTURE:basic');
  await page.getByTestId('form-coinbase-privatekey').fill('FIXTURE:basic');
  await page.getByTestId('btn-coinbase-connect').click();
  await expect(page.getByTestId('badge-coinbase-connected')).toBeVisible();

  // Auto-commit is on by default; fetch all should commit if there are no blocking issues.
  await page.getByTestId('btn-import-run-all').click();

  await expect(page.getByTestId('list-import-preview')).toBeVisible();
  await expect(page.getByTestId('btn-import-commit')).toBeVisible();

  // Wait for commit to happen automatically (or allow manual fallback)
  const done = page.getByTestId('badge-import-step-done');
  await done.waitFor({ timeout: 20_000 });

  await page.getByTestId('nav-transactions').click();
  await expect(page.getByTestId('list-ledger')).toBeVisible();
  expect(await page.locator('[data-testid^="row-ledger-"]').count()).toBeGreaterThan(0);

  await page.getByTestId('nav-portfolio').click();
  await expect(page.getByTestId('list-positions')).toBeVisible();
  expect(await page.locator('[data-testid^="row-position-"]').count()).toBeGreaterThan(0);

  await page.getByTestId('nav-dashboard').click();
  await expect(page.getByTestId('metric-total-value')).toBeVisible();
  const txt = await page.getByTestId('metric-total-value').innerText();
  expect(txt.toUpperCase()).toContain('EUR');
});
