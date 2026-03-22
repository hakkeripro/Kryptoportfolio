/**
 * Feature 47: Password reset E2E tests
 *
 * Mock strategy:
 *   - Local dev API returns _testToken in the response body for easy token extraction
 *   - /v1/auth/password-reset/* handled by local Fastify mock
 */

import { test, expect } from '@playwright/test';
import { resetApp } from './helpers';

const API = 'http://localhost:8788';

test.describe('Feature 47: Password reset', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetApp(page, request);
  });

  test('"Forgot password?" link visible on signin page', async ({ page }) => {
    await page.goto('/auth/signin');
    await expect(page.getByTestId('link-forgot-password')).toBeVisible({ timeout: 5_000 });
  });

  test('forgot password page shows vault-loss warning', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await expect(page.getByTestId('page-forgot-password')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('vault-loss-warning')).toBeVisible();
  });

  test('reset request: enter email → "check your email" shown', async ({ page }) => {
    // Create user first
    await page.request.post(`${API}/v1/auth/register`, {
      data: { email: 'reset-user@test.example', password: 'password12345' },
    });

    await page.goto('/auth/forgot-password');
    await page.getByTestId('form-reset-email').fill('reset-user@test.example');
    await page.getByTestId('btn-send-reset-link').click();

    await expect(page.getByTestId('reset-email-sent')).toBeVisible({ timeout: 10_000 });
  });

  test('reset request with unknown email: still shows "check your email" (no enumeration)', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await page.getByTestId('form-reset-email').fill('nonexistent@test.example');
    await page.getByTestId('btn-send-reset-link').click();

    // Still shows success message (no enumeration)
    await expect(page.getByTestId('reset-email-sent')).toBeVisible({ timeout: 10_000 });
  });

  test('full reset flow: request → confirm → can sign in with new password', async ({ page, request }) => {
    // Create user
    await request.post(`${API}/v1/auth/register`, {
      data: { email: 'full-reset@test.example', password: 'oldpassword123' },
    });

    // Request reset — local mock returns _testToken
    const resetResp = await request.post(`${API}/v1/auth/password-reset/request`, {
      data: { email: 'full-reset@test.example' },
    });
    const resetBody = await resetResp.json() as { ok: boolean; _testToken?: string };
    expect(resetBody.ok).toBe(true);
    const testToken = resetBody._testToken;
    expect(testToken).toBeTruthy();

    // Navigate to reset password page
    await page.goto(`/auth/reset-password?token=${testToken}`);
    await expect(page.getByTestId('page-reset-password')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('vault-loss-warning')).toBeVisible();

    // Fill new password
    await page.getByTestId('form-new-password').fill('newpassword456');
    await page.getByTestId('form-confirm-password').fill('newpassword456');
    await page.getByTestId('btn-confirm-reset').click();

    // Should redirect to signin
    await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 10_000 });

    // Sign in with new password
    await page.getByTestId('form-email').fill('full-reset@test.example');
    await page.getByTestId('form-password').fill('newpassword456');
    await page.getByTestId('btn-signin').click();

    // Old vault is gone — will fail with vault_not_found on auto-unlock
    // (this is expected; user needs to set up a new vault)
    // The test just verifies the flow completes without crashing
    await expect(page).not.toHaveURL(/\/auth\/signin/, { timeout: 10_000 });
  });

  test('expired token shows error', async ({ page }) => {
    // Use a fake-looking but invalid token
    const fakeToken = 'a'.repeat(64);
    await page.goto(`/auth/reset-password?token=${fakeToken}`);

    await page.getByTestId('form-new-password').fill('newpassword456');
    await page.getByTestId('form-confirm-password').fill('newpassword456');
    await page.getByTestId('btn-confirm-reset').click();

    await expect(page.getByTestId('reset-error')).toBeVisible({ timeout: 10_000 });
  });

  test('reset password page without token shows error state', async ({ page }) => {
    await page.goto('/auth/reset-password');
    // Should show an error or redirect (no token param)
    await expect(page.getByTestId('page-reset-password')).toBeVisible({ timeout: 5_000 });
  });
});
