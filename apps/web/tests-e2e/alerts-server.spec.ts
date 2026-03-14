import { test, expect } from '@playwright/test';
import { resetApp, signupAndSetupVault } from './helpers';

async function onboardAndRegister(page: any) {
  await signupAndSetupVault(page);
}

async function runFixtureImport(page: any) {
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
  const done = page.getByTestId('badge-import-step-done');
  await done.waitFor({ timeout: 20_000 });
}

test('server alerts: create alert → enable server → log shows triggers', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  await resetApp(page, request);
  await onboardAndRegister(page);
  await runFixtureImport(page);

  await page.getByTestId('nav-alerts').click();
  await expect(page.getByTestId('panel-alerts')).toBeVisible();

  await page.getByTestId('form-alert-type').selectOption('PORTFOLIO_VALUE');
  await page.getByTestId('form-alert-direction').selectOption('ABOVE');
  await page.getByTestId('form-alert-threshold').fill('1');
  await page.getByTestId('btn-save-alert').click();

  await expect(page.locator('[data-testid^="row-alert-"]')).toHaveCount(1);

  await page.getByTestId('btn-enable-server-alerts').click();
  await expect(page.getByTestId('txt-alert-server-message')).toBeVisible({ timeout: 20_000 });

  // Poll: click refresh repeatedly until trigger log rows appear
  const row = page.locator('[data-testid^="row-trigger-log-"]').first();
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await page.getByTestId('btn-refresh-alert-log').click();
    try {
      await expect(row).toBeVisible({ timeout: 3_000 });
      break;
    } catch {
      await page.waitForTimeout(2_000);
    }
  }
  await expect(row).toBeVisible({ timeout: 5_000 });
  const n = await page.locator('[data-testid^="row-trigger-log-"]').count();
  expect(n).toBeGreaterThan(0);
});

test('server alerts: empty local list does not clear server rules when cancelled', async ({
  page,
  request,
}) => {
  await resetApp(page, request);
  await onboardAndRegister(page);
  await runFixtureImport(page);

  await page.getByTestId('nav-alerts').click();
  await expect(page.getByTestId('panel-alerts')).toBeVisible();

  // Create a single alert and sync to the server.
  await page.getByTestId('form-alert-type').selectOption('PORTFOLIO_VALUE');
  await page.getByTestId('form-alert-direction').selectOption('ABOVE');
  await page.getByTestId('form-alert-threshold').fill('1');
  await page.getByTestId('btn-save-alert').click();
  await expect(page.locator('[data-testid^="row-alert-"]')).toHaveCount(1);

  await page.getByTestId('btn-enable-server-alerts').click();
  await expect(page.getByTestId('txt-alert-server-message')).toBeVisible({ timeout: 20_000 });

  // Delete locally, making the "active" local list empty.
  const row = page.locator('[data-testid^="row-alert-"]').first();
  const rowId = await row.getAttribute('data-testid');
  const id = String(rowId ?? '').replace('row-alert-', '');
  await page.getByTestId(`btn-delete-alert-${id}`).click();

  // "Sync rules to server" with 0 local alerts shows confirm dialog. Dismissing cancels the action.
  page.once('dialog', async (d) => {
    await d.dismiss();
  });
  await page.getByTestId('btn-enable-server-alerts').click();
  // No server message should appear (action was cancelled)
  await page.waitForTimeout(500);

  // "Enable delivery" button keeps existing server rules via enable_only mode.
  await page.getByTestId('btn-enable-delivery').click();
  await expect(page.getByTestId('txt-alert-server-message')).toContainText('existing rules kept', {
    timeout: 20_000,
  });

  await page.getByTestId('btn-refresh-server-status').click();
  await expect(page.getByTestId('box-alerts-server-status')).toContainText('1/1');
});
