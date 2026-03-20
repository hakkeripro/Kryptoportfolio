import { test, expect } from '@playwright/test';
import { resetApp, waitForToken } from './helpers';

const API = 'http://localhost:8788';

/** Navigate to /auth/callback with a mock OAuth code+state (state must be in sessionStorage first) */
async function navigateToOAuthCallback(page: any, code = 'mock-google-code') {
  const state = 'mock-state-abc123';
  await page.evaluate((s: string) => {
    sessionStorage.setItem('oauth_state', s);
    sessionStorage.setItem('oauth_code_verifier', 'mock-code-verifier');
  }, state);
  await page.goto(`/auth/callback?code=${code}&state=${state}`);
}

/** Enter a PIN into the 6-digit PIN input */
async function enterPin(page: any, pin: string) {
  for (let i = 0; i < pin.length; i++) {
    await page.getByTestId(`pin-digit-${i}`).fill(pin[i]!);
  }
}

test.describe('Feature 46: Google OAuth', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetApp(page, request);
  });

  test('first registration: Google OAuth → PIN setup → /home', async ({ page }) => {
    await navigateToOAuthCallback(page);

    // Should show PIN setup view
    await expect(page.getByTestId('page-oauth-callback')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('pin-input-group')).toBeVisible({ timeout: 10_000 });
    // Verify it's the setup variant (Set up PIN button text)
    await expect(page.getByTestId('btn-pin-submit')).toContainText('Set up PIN');

    // Enter a 4-digit PIN
    await enterPin(page, '1234');
    await page.getByTestId('btn-pin-submit').click();

    // Should redirect to /home
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
    await waitForToken(page);

    // authMethod should be 'oauth' in localStorage
    const auth = await page.evaluate(() => {
      const raw = localStorage.getItem('kp_auth_v3');
      return raw ? JSON.parse(raw) : null;
    });
    expect(auth?.state?.authMethod).toBe('oauth');
  });

  test('returning user on new device: Google OAuth → PIN enter → /home', async ({
    page,
    request,
  }) => {
    // First: register via OAuth and set up vault
    await navigateToOAuthCallback(page);
    await expect(page.getByTestId('pin-input-group')).toBeVisible({ timeout: 10_000 });
    await enterPin(page, '1234');
    await page.getByTestId('btn-pin-submit').click();
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
    await waitForToken(page);

    // Get token to verify vault blob exists
    const auth = await page.evaluate(() => {
      const raw = localStorage.getItem('kp_auth_v3');
      return raw ? JSON.parse(raw) : null;
    });
    const token = auth?.state?.token as string;
    const keyRes = await request.get(`${API}/v1/vault/key`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect((await keyRes.json()).blob).not.toBeNull();

    // Simulate new device: clear IndexedDB but keep localStorage (token + authMethod)
    await page.evaluate(async () => {
      sessionStorage.clear();
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('kp_web_v3');
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    });

    // Second OAuth callback (same user — mock endpoint finds existing user by googleSub)
    await navigateToOAuthCallback(page);
    await expect(page.getByTestId('pin-input-group')).toBeVisible({ timeout: 10_000 });

    // Should show PIN enter (not setup) — button says "Continue →"
    await expect(page.getByTestId('btn-pin-submit')).toContainText('Continue');

    await enterPin(page, '1234');
    await page.getByTestId('btn-pin-submit').click();
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
  });

  test('wrong PIN: shows error, no navigation', async ({ page }) => {
    // Set up vault first with PIN '1234'
    await navigateToOAuthCallback(page);
    await expect(page.getByTestId('pin-input-group')).toBeVisible({ timeout: 10_000 });
    await enterPin(page, '1234');
    await page.getByTestId('btn-pin-submit').click();
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });

    // New device
    await page.evaluate(async () => {
      sessionStorage.clear();
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('kp_web_v3');
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    });

    // OAuth again → PIN enter view
    await navigateToOAuthCallback(page);
    await expect(page.getByTestId('pin-input-group')).toBeVisible({ timeout: 10_000 });

    // Enter wrong PIN
    await enterPin(page, '9999');
    await page.getByTestId('btn-pin-submit').click();

    // Should show error, NOT navigate to /home
    await expect(page.getByTestId('pin-error')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('pin-error')).toContainText('Incorrect PIN');
    await expect(page).not.toHaveURL(/\/home/);
  });

  test('forgot PIN: vault reset flow → PIN setup → /home with empty vault', async ({
    page,
    request,
  }) => {
    // Set up vault with PIN '1234'
    await navigateToOAuthCallback(page);
    await expect(page.getByTestId('pin-input-group')).toBeVisible({ timeout: 10_000 });
    await enterPin(page, '1234');
    await page.getByTestId('btn-pin-submit').click();
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });

    // New device
    await page.evaluate(async () => {
      sessionStorage.clear();
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('kp_web_v3');
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    });

    // OAuth again → PIN enter view
    await navigateToOAuthCallback(page);
    await expect(page.getByTestId('pin-input-group')).toBeVisible({ timeout: 10_000 });

    // Click "Forgot PIN? Reset vault →"
    await page.getByTestId('btn-forgot-pin').click();

    // Warning text should be visible
    await expect(page.locator('text=This will permanently delete all your encrypted data.')).toBeVisible();

    // Confirm reset
    await page.getByTestId('btn-confirm-reset').click();

    // Should now show PIN setup view (new vault)
    await expect(page.getByTestId('btn-pin-submit')).toContainText('Set up PIN', { timeout: 5_000 });

    // Set new PIN
    await enterPin(page, '5678');
    await page.getByTestId('btn-pin-submit').click();
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });

    // Vault key blob on server should exist (was re-created)
    const auth = await page.evaluate(() => {
      const raw = localStorage.getItem('kp_auth_v3');
      return raw ? JSON.parse(raw) : null;
    });
    const token = auth?.state?.token as string;
    const keyRes = await request.get(`${API}/v1/vault/key`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect((await keyRes.json()).blob).not.toBeNull();
  });

  test('email_taken_password: shows error on callback page', async ({ page, request }) => {
    // Register a password user with the same email that the mock will use
    const mockEmail = 'mock@google.test';
    const registerRes = await request.post(`${API}/v1/auth/register`, {
      data: { email: mockEmail, password: 'supersecret1' },
    });
    expect(registerRes.ok()).toBe(true);

    // Now try OAuth with the same email → should get 409
    await navigateToOAuthCallback(page);

    // Should show error
    await expect(page.getByTestId('oauth-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('oauth-error')).toContainText('already registered with a password');
  });

  test('error=access_denied: shows cancelled message', async ({ page }) => {
    await page.goto('/auth/callback?error=access_denied');
    await expect(page.getByTestId('oauth-error')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('oauth-error')).toContainText('Sign in was cancelled');
  });

  test('invalid state: shows invalid request error', async ({ page }) => {
    // No sessionStorage set → state mismatch
    await page.goto('/auth/callback?code=mock-code&state=wrong-state');
    await expect(page.getByTestId('oauth-error')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('oauth-error')).toContainText('Invalid request');
  });
});
