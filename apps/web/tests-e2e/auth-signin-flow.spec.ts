import { test, expect } from '@playwright/test';
import { resetApp, signupAndSetupVault, waitForToken } from './helpers';

test.describe('auth: signin flow', () => {
  test('signin → new-device vault setup → dashboard', async ({ page, request }) => {
    await resetApp(page, request);
    const email = await signupAndSetupVault(page);

    // Wipe only client state — keep API user in DB
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

    // Redirects to vault setup (ondevice=1) because no local vault exists
    await expect(page).toHaveURL(/\/vault\/setup/, { timeout: 10_000 });

    // Enter existing passphrase on new device
    await page.getByTestId('form-vault-passphrase').fill('passphrase123');
    await page.getByTestId('btn-create-vault').click();

    // ondevice=1 mode: navigates directly to /home (no done step)
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
