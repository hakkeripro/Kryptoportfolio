/**
 * Feature 47: Passkey / WebAuthn E2E tests
 *
 * Mock strategy:
 *   - navigator.credentials is mocked via page.addInitScript()
 *   - /v1/auth/passkey/* endpoints are handled by the local Fastify mock
 *   - PRF output is mocked as 32 zero bytes
 */

import { test, expect } from '@playwright/test';
import { resetApp } from './helpers';

const API = 'http://localhost:8788';

const MOCK_CREDENTIAL_ID = 'mock-credential-id-001';
const MOCK_PRF_OUTPUT = new Array(32).fill(0);

/** Inject mock WebAuthn API into the page */
async function mockWebAuthn(page: any) {
  await page.addInitScript(
    ({ credId, prfOutput }: { credId: string; prfOutput: number[] }) => {
      function b64urlEncode(buf: Uint8Array): string {
        let s = '';
        for (const b of buf) s += String.fromCharCode(b);
        return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      }

      const mockCredIdBytes = new TextEncoder().encode(credId);

      // Mock create() — returns an AttestationResponse-like object
      const mockCreate = async (_options: any) => {
        return {
          type: 'public-key',
          id: credId,
          rawId: mockCredIdBytes.buffer,
          response: {
            clientDataJSON: new TextEncoder().encode(
              JSON.stringify({
                type: 'webauthn.create',
                challenge: b64urlEncode(new Uint8Array(32)),
                origin: window.location.origin,
              }),
            ).buffer,
            attestationObject: new Uint8Array(64).buffer, // minimal mock
          },
          getClientExtensionResults: () => ({ prf: { enabled: true } }),
        };
      };

      // Mock get() — returns an AssertionResponse-like object
      const mockGet = async (_options: any) => {
        return {
          type: 'public-key',
          id: credId,
          rawId: mockCredIdBytes.buffer,
          response: {
            authenticatorData: new Uint8Array(37).buffer, // 32 rp_id + 1 flags + 4 sign_count
            clientDataJSON: new TextEncoder().encode(
              JSON.stringify({
                type: 'webauthn.get',
                challenge: b64urlEncode(new Uint8Array(32)),
                origin: window.location.origin,
              }),
            ).buffer,
            signature: new Uint8Array(64).buffer,
            userHandle: null,
          },
          getClientExtensionResults: () => ({
            prf: { results: { first: new Uint8Array(prfOutput).buffer } },
          }),
        };
      };

      // Most reliable strategy: patch CredentialsContainer.prototype methods directly.
      // This works regardless of whether navigator.credentials is configurable,
      // because every CredentialsContainer instance inherits from the prototype.
      try {
        CredentialsContainer.prototype.create = mockCreate as any;
        CredentialsContainer.prototype.get = mockGet as any;
      } catch (_e0) {
        // Fallback: try Object.defineProperty on the prototype methods
        try {
          Object.defineProperty(CredentialsContainer.prototype, 'create', {
            value: mockCreate,
            writable: true,
            configurable: true,
          });
          Object.defineProperty(CredentialsContainer.prototype, 'get', {
            value: mockGet,
            writable: true,
            configurable: true,
          });
        } catch (_e1) {
          // Last resort: patch navigator.credentials instance
          try {
            Object.defineProperty(window.navigator, 'credentials', {
              value: {
                create: mockCreate,
                get: mockGet,
                preventSilentAccess: async () => {},
                store: async () => {},
              },
              writable: true,
              configurable: true,
            });
          } catch (_e2) {
            // noop — mock could not be installed
          }
        }
      }
    },
    { credId: MOCK_CREDENTIAL_ID, prfOutput: MOCK_PRF_OUTPUT },
  );
}

test.describe('Feature 47: Passkey authentication', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetApp(page, request);
  });

  test('passkey button appears on signin page', async ({ page }) => {
    await page.goto('/auth/signin');
    await expect(page.getByTestId('btn-passkey-signin')).toBeVisible({ timeout: 5_000 });
  });

  test('passkey button appears on signup page', async ({ page }) => {
    await page.goto('/auth/signup');
    await expect(page.getByTestId('btn-passkey-signup')).toBeVisible({ timeout: 5_000 });
  });

  test('signup with passkey → creates account → /home', async ({ page }) => {
    await mockWebAuthn(page);
    await page.goto('/auth/signup');

    // Enter email first (required for passkey signup)
    await page.getByTestId('form-email').fill('passkey-user@test.example');

    // Click passkey signup button
    const btn = page.getByTestId('btn-passkey-signup');
    await expect(btn).toBeVisible({ timeout: 5_000 });
    await btn.click();

    // Should navigate to /home after successful passkey setup
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
  });

  test('sign in with passkey → vault unlocked → /home', async ({ page }) => {
    await mockWebAuthn(page);

    // First create an account with passkey
    await page.goto('/auth/signup');
    await page.getByTestId('form-email').fill('passkey-signin@test.example');
    await page.getByTestId('btn-passkey-signup').click();
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });

    // Sign out and navigate to sign-in page (full reload).
    // The CredentialsContainer.prototype mock is re-injected by addInitScript on each load.
    await page.goto('/auth/signin');

    // Sign in with passkey
    await expect(page.getByTestId('btn-passkey-signin')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('form-email').fill('passkey-signin@test.example');
    await page.getByTestId('btn-passkey-signin').click();

    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });

    // Verify authMethod is passkey
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('kp_auth_v3');
      return raw ? JSON.parse(raw) : null;
    });
    expect(stored?.state?.authMethod).toBe('passkey');
  });

  test('add passkey from AccountPage → appears in list', async ({ page }) => {
    await mockWebAuthn(page);

    // Create user and vault via UI signup (password flow)
    await page.goto('/auth/signup');
    await page.getByTestId('form-email').fill('passkey-account@test.example');
    await page.getByTestId('form-password').fill('password12345');
    await page.getByTestId('form-password-confirm').fill('password12345');
    await page.getByTestId('btn-signup').click();
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });

    // Go to account page
    await page.goto('/settings/account');
    await expect(page.getByTestId('page-account')).toBeVisible({ timeout: 5_000 });

    // Add passkey
    await page.getByTestId('input-passkey-device-name').fill('My Test Device');
    await page.getByTestId('btn-add-passkey').click();

    // Should appear in list
    await expect(page.locator('text=My Test Device')).toBeVisible({ timeout: 10_000 });
  });
});
