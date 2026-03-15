import { test, expect } from '@playwright/test';
import { resetApp, signupAndSetupVault } from './helpers';

test('smoke: signup + vault setup + dashboard', async ({ page, request }) => {
  await resetApp(page, request);
  await signupAndSetupVault(page);
  await expect(page.getByTestId('metric-total-value')).toBeVisible();
});

test('KP-UI-001: vault passphrase persists across page reload', async ({ page, request }) => {
  await resetApp(page, request);
  await signupAndSetupVault(page);

  // Reload — passphrase should be restored from sessionStorage (KP-UI-001 fix)
  await page.reload();
  await expect(page.getByTestId('nav-home')).toBeVisible({ timeout: 10_000 });
  // Should NOT be redirected to unlock page
  await expect(page).not.toHaveURL(/\/unlock/);
  await expect(page.getByTestId('metric-total-value')).toBeVisible();
});
