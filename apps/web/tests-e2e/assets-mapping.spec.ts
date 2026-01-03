import { test, expect } from '@playwright/test';

async function waitForToken(page: any) {
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('kp_app_state_v3');
    if (!raw) return false;
    try {
      const obj = JSON.parse(raw);
      return !!obj?.state?.token;
    } catch {
      return false;
    }
  }, null, { timeout: 10_000 });
}

async function resetApp(page: any, request: any) {
  const r = await request.post('http://localhost:8788/__test/reset');
  if (!r.ok()) {
    throw new Error(`API test mode not enabled (expected /__test/reset 200): ${r.status()} ${await r.text()}`);
  }
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
  // Wait until auth token is persisted (register/login completed)
  await waitForToken(page);

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

await expect(page.getByTestId('txt-current-coingeckoId')).toContainText(q, { timeout: 10_000 });

});
