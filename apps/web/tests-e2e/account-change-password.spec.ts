import { test, expect } from '@playwright/test';
import { resetApp, signupAndSetupVault, spaNavigate } from './helpers';

test.describe('account: change password', () => {
  test('change password with correct current password succeeds', async ({ page, request }) => {
    await resetApp(page, request);
    await signupAndSetupVault(page);

    await spaNavigate(page, '/account');
    await expect(page.getByTestId('page-account')).toBeVisible();

    await page.getByTestId('form-current-password').fill('supersecret1');
    await page.getByTestId('form-new-password').fill('newsecret99');
    await page.getByTestId('btn-change-password').click();

    // Success message appears
    await expect(page.locator('.text-semantic-success').first()).toBeVisible({ timeout: 8_000 });
  });

  test('change password with wrong current password shows error', async ({ page, request }) => {
    await resetApp(page, request);
    await signupAndSetupVault(page);

    await spaNavigate(page, '/account');
    await expect(page.getByTestId('page-account')).toBeVisible();

    await page.getByTestId('form-current-password').fill('wrongpassword1');
    await page.getByTestId('form-new-password').fill('newsecret99');
    await page.getByTestId('btn-change-password').click();

    await expect(page.locator('.text-semantic-error').first()).toBeVisible({ timeout: 8_000 });
  });

  test('change password button disabled when new password too short', async ({ page, request }) => {
    await resetApp(page, request);
    await signupAndSetupVault(page);

    await spaNavigate(page, '/account');
    await page.getByTestId('form-current-password').fill('supersecret1');
    await page.getByTestId('form-new-password').fill('short');
    await expect(page.getByTestId('btn-change-password')).toBeDisabled();
  });
});
