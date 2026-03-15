import { test, expect } from '@playwright/test';
import { resetApp, signupAndSetupVault, spaNavigate } from './helpers';

async function onboardAndRegister(page: any) {
  await signupAndSetupVault(page);
}

async function runFixtureImport(page: any) {
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
  await page.getByTestId('btn-import-run-all').click();
  const done = page.getByTestId('badge-import-step-done');
  await done.waitFor({ timeout: 20_000 });
}

test('asset catalog mapping: shows unmapped assets and can link CoinGecko id', async ({ page, request }) => {
  await resetApp(page, request);
  await onboardAndRegister(page);
  await runFixtureImport(page);

  await spaNavigate(page, '/settings/assets');
  await expect(page.getByTestId('list-unmapped-assets')).toBeVisible();
  const first = page.locator('[data-testid^="row-unmapped-"]').first();
  await expect(first).toBeVisible();
  await first.click();

  const selectedTxt = await page.getByTestId('selected-asset').innerText();
  const q = selectedTxt.toUpperCase().includes('ETH') ? 'ethereum' : 'bitcoin';

  await page.getByTestId('form-coingecko-search').fill(q);
  await page.getByTestId('btn-coingecko-search').click();
  const btnId = q === 'ethereum' ? 'btn-link-coingecko-ethereum' : 'btn-link-coingecko-bitcoin';
  await page.getByTestId(btnId).click();

  // Mapping update is async (Dexie liveQuery refresh), so wait for the UI to reflect the new id.
  await expect(page.getByTestId('txt-current-coingeckoId')).toContainText(q, { timeout: 10_000 });
});
