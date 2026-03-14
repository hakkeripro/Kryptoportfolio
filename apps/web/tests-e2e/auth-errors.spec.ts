import { test, expect } from '@playwright/test';
import { resetApp, waitForToken } from './helpers';

test.describe('auth error paths', () => {
  test('duplicate email registration shows error', async ({ page, request }) => {
    await resetApp(page, request);

    const email = `dup_${Date.now()}@example.com`;

    // Register first user
    await page.goto('/auth/signup');
    await page.getByTestId('form-email').fill(email);
    await page.getByTestId('form-password').fill('supersecret1');
    await page.getByTestId('form-password-confirm').fill('supersecret1');
    await page.getByTestId('btn-signup').click();
    await waitForToken(page);

    // Reset browser and try same email
    await resetApp(page, request);

    await page.goto('/auth/signup');
    await page.getByTestId('form-email').fill(email);
    await page.getByTestId('form-password').fill('supersecret2');
    await page.getByTestId('form-password-confirm').fill('supersecret2');
    await page.getByTestId('btn-signup').click();

    // Should show error (email_taken)
    await expect(page.getByTestId('signup-error')).toBeVisible({ timeout: 10_000 });
  });

  test('wrong password login shows error', async ({ page, request }) => {
    await resetApp(page, request);

    const email = `wrong_pwd_${Date.now()}@example.com`;

    // Register
    await page.goto('/auth/signup');
    await page.getByTestId('form-email').fill(email);
    await page.getByTestId('form-password').fill('supersecret1');
    await page.getByTestId('form-password-confirm').fill('supersecret1');
    await page.getByTestId('btn-signup').click();
    await waitForToken(page);

    // Reset and try login with wrong password
    await resetApp(page, request);

    await page.goto('/auth/signin');
    await page.getByTestId('form-email').fill(email);
    await page.getByTestId('form-password').fill('wrongpassword1');
    await page.getByTestId('btn-signin').click();

    // Should show error (invalid_credentials)
    await expect(page.getByTestId('signin-error')).toBeVisible({ timeout: 10_000 });
  });

  test('login with non-existent email shows error', async ({ page, request }) => {
    await resetApp(page, request);

    await page.goto('/auth/signin');
    await page.getByTestId('form-email').fill(`nonexist_${Date.now()}@example.com`);
    await page.getByTestId('form-password').fill('supersecret1');
    await page.getByTestId('btn-signin').click();

    await expect(page.getByTestId('signin-error')).toBeVisible({ timeout: 10_000 });
  });
});
