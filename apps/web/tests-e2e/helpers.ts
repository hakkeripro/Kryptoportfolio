import { expect } from '@playwright/test';

/**
 * SPA-navigate without full page reload (preserves in-memory vault state).
 * Uses the BrowserRouter's pushState + popstate to trigger React Router navigation.
 */
export async function spaNavigate(page: any, path: string) {
  await page.evaluate((p: string) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  // Give React Router time to process the navigation and any redirects
  await page.waitForTimeout(1000);
}

export async function waitForToken(page: any) {
  await page.waitForFunction(
    () => {
      const raw = localStorage.getItem('kp_auth_v3');
      if (!raw) return false;
      try {
        const obj = JSON.parse(raw);
        return !!obj?.state?.token;
      } catch {
        return false;
      }
    },
    null,
    { timeout: 10_000 },
  );
}

export async function resetApp(page: any, request: any) {
  const r = await request.post('http://localhost:8788/__test/reset');
  if (!r.ok()) {
    throw new Error(
      `API test mode not enabled (expected /__test/reset 200): ${r.status()} ${await r.text()}`,
    );
  }
  await page.goto('/welcome');
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
}

/**
 * New auth flow: combined signup + vault setup page → dashboard
 */
export async function signupAndSetupVault(page: any) {
  const email = `e2e_${Date.now()}@example.com`;

  // Combined signup + vault setup page
  await page.goto('/auth/signup');
  await page.getByTestId('form-email').fill(email);
  await page.getByTestId('form-password').fill('supersecret1');
  await page.getByTestId('form-password-confirm').fill('supersecret1');
  await page.getByTestId('form-vault-passphrase').fill('passphrase123');
  await page.getByTestId('form-vault-passphrase-confirm').fill('passphrase123');
  await page.getByTestId('btn-signup').click();

  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
  await waitForToken(page);

  return email;
}

/**
 * Setup vault only (offline mode, no registration)
 */
export async function setupVaultOffline(page: any) {
  await page.goto('/vault/setup?offline=1');

  // Country step: skip
  if (await page.getByTestId('btn-country-skip').isVisible()) {
    await page.getByTestId('btn-country-skip').click();
  }

  await page.getByTestId('form-vault-passphrase').fill('passphrase123');
  await page.getByTestId('form-vault-passphrase-confirm').fill('passphrase123');
  await page.getByTestId('form-saved-checkbox').check();
  await page.getByTestId('btn-create-vault').click();

  // Done → dashboard (passkey step removed from normal flow)
  await page.getByTestId('btn-go-dashboard').click();
  await expect(page).toHaveURL(/\/home/, { timeout: 10_000 });
}
