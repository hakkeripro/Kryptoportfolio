import { test, expect } from '@playwright/test';
import { resetApp, signupAndSetupVault, waitForToken } from './helpers';

test.describe('auth: signin flow', () => {
  test('signin → new-device auto-unlock via vault key blob → dashboard', async ({
    page,
    request,
  }) => {
    await resetApp(page, request);
    const email = await signupAndSetupVault(page);

    // Wipe only client state — keep API user + vault key blob in DB
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

    // Sign in on "new device" (no local vault)
    await page.goto('/auth/signin');
    await page.getByTestId('form-email').fill(email);
    await page.getByTestId('form-password').fill('supersecret1');
    await page.getByTestId('btn-signin').click();
    await waitForToken(page);

    // Feature 31: vault key blob fetched from server → auto-unlock → direct to /home
    await expect(page).toHaveURL(/\/home/, { timeout: 10_000 });
    await expect(page.getByTestId('metric-total-value')).toBeVisible();
  });

  test('signin with correct credentials stores token', async ({ page, request }) => {
    await resetApp(page, request);
    const email = await signupAndSetupVault(page);

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

    await page.goto('/auth/signin');
    await page.getByTestId('form-email').fill(email);
    await page.getByTestId('form-password').fill('supersecret1');
    await page.getByTestId('btn-signin').click();
    await waitForToken(page);

    const raw = await page.evaluate(() => localStorage.getItem('kp_auth_v3'));
    const parsed = JSON.parse(raw!);
    expect(parsed?.state?.token).toBeTruthy();
  });
});
