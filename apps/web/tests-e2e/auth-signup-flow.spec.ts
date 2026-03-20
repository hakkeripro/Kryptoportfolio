import { test, expect } from '@playwright/test';
import { resetApp, signupAndSetupVault, waitForToken } from './helpers';

test.describe('auth: signup flow', () => {
  test('welcome page shows signup + signin + offline buttons', async ({ page, request }) => {
    await resetApp(page, request);
    await page.goto('/welcome');
    await expect(page.getByTestId('page-welcome')).toBeVisible();
    await expect(page.getByTestId('btn-signup')).toBeVisible();
    await expect(page.getByTestId('btn-signin')).toBeVisible();
    await expect(page.getByTestId('btn-offline')).toBeVisible();
  });

  test('signup → dashboard (happy path, vault auto-generated)', async ({ page, request }) => {
    await resetApp(page, request);
    await signupAndSetupVault(page);
    await expect(page.getByTestId('metric-total-value')).toBeVisible();
  });

  test('signup form validates password length', async ({ page, request }) => {
    await resetApp(page, request);
    await page.goto('/auth/signup');
    await page.getByTestId('form-email').fill('test@example.com');
    await page.getByTestId('form-password').fill('short');
    // Error appears inline — submit button should be disabled
    await expect(page.getByTestId('btn-signup')).toBeDisabled();
  });

  test('welcome redirects authenticated+vaultReady user to /home', async ({ page, request }) => {
    await resetApp(page, request);
    await signupAndSetupVault(page);
    // Revisit welcome — should redirect to /home immediately
    await page.goto('/welcome');
    await expect(page).toHaveURL(/\/home/, { timeout: 8_000 });
  });

  test('token is stored after signup', async ({ page, request }) => {
    await resetApp(page, request);
    await signupAndSetupVault(page);
    await waitForToken(page);
    const raw = await page.evaluate(() => localStorage.getItem('kp_auth_v3'));
    const parsed = JSON.parse(raw!);
    expect(parsed?.state?.token).toBeTruthy();
  });
});
