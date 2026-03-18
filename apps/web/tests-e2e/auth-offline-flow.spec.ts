import { test, expect } from '@playwright/test';
import { resetApp, setupVaultOffline } from './helpers';

test.describe('auth: offline flow', () => {
  test('offline vault setup → dashboard without account', async ({ page, request }) => {
    await resetApp(page, request);
    await setupVaultOffline(page);
    await expect(page.getByTestId('metric-total-value')).toBeVisible();
  });

  test('welcome btn-offline navigates to vault setup', async ({ page, request }) => {
    await resetApp(page, request);
    await page.goto('/welcome');
    await page.getByTestId('btn-offline').click();
    await expect(page).toHaveURL(/\/vault\/setup/, { timeout: 5_000 });
  });

  test('offline user has no auth token', async ({ page, request }) => {
    await resetApp(page, request);
    await setupVaultOffline(page);
    const raw = await page.evaluate(() => localStorage.getItem('kp_auth_v3'));
    const parsed = raw ? JSON.parse(raw) : null;
    expect(parsed?.state?.token ?? null).toBeNull();
  });

  test('offline vault reload stays on dashboard', async ({ page, request }) => {
    await resetApp(page, request);
    await setupVaultOffline(page);
    await page.reload();
    // Passphrase in sessionStorage — should not redirect to unlock
    await expect(page.getByTestId('nav-home')).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL(/\/unlock/);
  });
});
