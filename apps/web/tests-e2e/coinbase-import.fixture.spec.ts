import { test, expect } from '@playwright/test';
import { resetApp, signupAndSetupVault } from './helpers';

async function onboardAndRegister(page: any) {
  await signupAndSetupVault(page);
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
  const connected = page.getByTestId('badge-coinbase-connected');
  const err = page.getByTestId('alert-import-error');
  const start = Date.now();
  while (Date.now() - start < 15_000) {
    if (await connected.count()) {
      try { if (await connected.isVisible()) break; } catch {}
    }
    if (await err.count()) {
      try {
        if (await err.isVisible()) {
          const msg = (await err.innerText()).trim();
          throw new Error(`Coinbase connect failed: ${msg}`);
        }
      } catch (e) { throw e; }
    }
    await page.waitForTimeout(200);
  }
  await expect(connected).toBeVisible({ timeout: 5_000 });

  // Auto-commit is on by default; fetch all should commit if there are no blocking issues.
  await page.getByTestId('btn-import-run-all').click();

  await expect(page.getByTestId('list-import-preview')).toBeVisible();
  const commitBtn = page.getByTestId('btn-import-commit');
  await expect(commitBtn).toBeVisible();

  // Commit explicitly (auto-commit may be disabled/slow in CI)
  try {
    if (await commitBtn.isEnabled()) await commitBtn.click();
  } catch {}

  const done = page.getByTestId('badge-import-step-done');
  await done.waitFor({ timeout: 30_000 });

  await page.getByTestId('nav-transactions').click();
  await expect(page.getByTestId('list-ledger')).toBeVisible();
  await expect.poll(async () => await page.locator('[data-testid^="row-ledger-"]').count(), { timeout: 20_000 }).toBeGreaterThan(0);

  await page.getByTestId('nav-portfolio').click();
  await expect(page.getByTestId('list-positions')).toBeVisible();
  await expect.poll(async () => await page.locator('[data-testid^="row-position-"]').count(), { timeout: 20_000 }).toBeGreaterThan(0);

  await page.getByTestId('nav-dashboard').click();
  await expect(page.getByTestId('metric-total-value')).toBeVisible();
  const txt = await page.getByTestId('metric-total-value').innerText();
  expect(txt.toUpperCase()).toContain('EUR');
});
