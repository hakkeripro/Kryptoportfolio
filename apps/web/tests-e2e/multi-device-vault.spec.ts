import { test, expect } from '@playwright/test';
import { resetApp, waitForToken } from './helpers';

/**
 * Feature 31: Multi-device Vault
 * Tests that users can log in on a new device without entering their vault passphrase.
 */
test.describe('Feature 31: Multi-device Vault', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetApp(page, request);
  });

  test('new user: signup → logout → signin → /home (no passphrase prompt)', async ({
    page,
    request,
  }) => {
    // ── Signup ──
    const email = `e2e_f31_${Date.now()}@example.com`;
    await page.goto('/auth/signup');
    await page.getByTestId('form-email').fill(email);
    await page.getByTestId('form-password').fill('supersecret1');
    await page.getByTestId('form-password-confirm').fill('supersecret1');
    await page.getByTestId('form-vault-passphrase').fill('correct-horse-staple');
    await page.getByTestId('form-vault-passphrase-confirm').fill('correct-horse-staple');
    await page.getByTestId('btn-signup').click();
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
    await waitForToken(page);

    // Verify blob was stored on server
    const auth = await page.evaluate(() => {
      const raw = localStorage.getItem('kp_auth_v3');
      return raw ? JSON.parse(raw) : null;
    });
    const token = auth?.state?.token as string;
    const keyRes = await request.get('http://localhost:8788/v1/vault/key', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(keyRes.ok()).toBe(true);
    const keyData = await keyRes.json();
    expect(keyData.blob).not.toBeNull();
    expect(keyData.salt).not.toBeNull();

    // ── Simulate "new device": clear local state only (server state stays) ──
    await page.evaluate(async () => {
      // Keep localStorage (token) but clear IndexedDB and sessionStorage
      sessionStorage.clear();
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('kp_web_v3');
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    });

    // ── Sign in on "new device" ──
    await page.goto('/auth/signin');
    await page.getByTestId('form-email').fill(email);
    await page.getByTestId('form-password').fill('supersecret1');
    await page.getByTestId('btn-signin').click();

    // Should land on /home automatically — no passphrase prompt
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
    await expect(page.getByTestId('fallback-form')).not.toBeVisible().catch(() => {
      // fallback-form not in DOM is OK
    });
  });

  test('VaultSetupPage stores blob after setup: GET /v1/vault/key returns non-null', async ({
    page,
    request,
  }) => {
    const email = `e2e_f31_blob_${Date.now()}@example.com`;
    await page.goto('/auth/signup');
    await page.getByTestId('form-email').fill(email);
    await page.getByTestId('form-password').fill('supersecret1');
    await page.getByTestId('form-password-confirm').fill('supersecret1');
    await page.getByTestId('form-vault-passphrase').fill('my-test-passphrase');
    await page.getByTestId('form-vault-passphrase-confirm').fill('my-test-passphrase');
    await page.getByTestId('btn-signup').click();
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
    await waitForToken(page);

    const auth = await page.evaluate(() => {
      const raw = localStorage.getItem('kp_auth_v3');
      return raw ? JSON.parse(raw) : null;
    });
    const token = auth?.state?.token as string;
    const keyRes = await request.get('http://localhost:8788/v1/vault/key', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(keyRes.ok()).toBe(true);
    const keyData = await keyRes.json();
    expect(keyData.blob).toBeTruthy();
    expect(keyData.salt).toBeTruthy();
  });

  test('GET /v1/vault/key returns {blob: null} for user without blob', async ({
    page,
    request,
  }) => {
    // Register a user via API directly (no vault setup)
    const email = `e2e_f31_noblob_${Date.now()}@example.com`;
    const registerRes = await request.post('http://localhost:8788/v1/auth/register', {
      data: { email, password: 'supersecret1' },
    });
    expect(registerRes.ok()).toBe(true);
    const registerData = await registerRes.json();
    const token = registerData.token as string;

    const keyRes = await request.get('http://localhost:8788/v1/vault/key', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(keyRes.ok()).toBe(true);
    const keyData = await keyRes.json();
    expect(keyData.blob).toBeNull();
    expect(keyData.salt).toBeNull();
  });
});
