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

async function runFixtureImport(page: any) {
  // Use SPA navigation to keep the in-memory vault state (avoid full reload).
  await page.getByTestId('nav-imports').click();
  await expect(page.getByTestId('form-coinbase-keyname')).toBeVisible();
  await page.getByTestId('form-coinbase-keyname').fill('FIXTURE:basic');
  await page.getByTestId('form-coinbase-privatekey').fill('FIXTURE:basic');
  await page.getByTestId('btn-coinbase-connect').click();
  await expect(page.getByTestId('badge-coinbase-connected')).toBeVisible();
  await page.getByTestId('btn-import-run-all').click();
  const done = page.getByTestId('badge-import-step-done');
  await done.waitFor({ timeout: 20_000 });
}

test('asset catalog mapping: shows unmapped assets and can link CoinGecko id', async ({ page, request }) => {
  await resetApp(page, request);
  await onboardAndRegister(page);
  await runFixtureImport(page);

  await page.getByTestId('nav-assets').click();
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

  const mapped = await page.getByTestId('txt-current-coingeckoId').innerText();
  expect(mapped).toContain(q);
});
