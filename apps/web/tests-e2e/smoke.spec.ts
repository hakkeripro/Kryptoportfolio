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

test('smoke: onboarding + vault + register + dashboard', async ({ page, request }) => {
  // Reset API (TEST_MODE)
  await request.post('http://localhost:8788/__test/reset');

  // Reset browser storage
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

  await page.goto('/onboarding');

  await page.getByTestId('form-vault-passphrase').fill('passphrase123');
  await page.getByTestId('form-vault-passphrase-confirm').fill('passphrase123');
  await page.getByTestId('btn-create-vault').click();
  await expect(page.getByTestId('badge-unlocked')).toBeVisible();

  // Register
  const email = `e2e_${Date.now()}@example.com`;
  await page.getByTestId('form-auth-email').fill(email);
  await page.getByTestId('form-auth-password').fill('supersecret1');
  await expect(page.getByTestId('btn-register')).toBeEnabled();
  await page.getByTestId('btn-register').click();
  // Wait until auth token is persisted (register/login completed)
  await waitForToken(page);


  await page.getByTestId('btn-finish-onboarding').click();
  await expect(page.getByTestId('nav-dashboard')).toBeVisible();
  await expect(page.getByTestId('metric-total-value')).toBeVisible();
});
