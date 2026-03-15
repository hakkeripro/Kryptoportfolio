import { test, expect } from '@playwright/test';
import { resetApp, signupAndSetupVault, spaNavigate } from './helpers';

test.describe('Feature 22: UI/UX Redesign', () => {
  /* ── Welcome page ────────────────────────────────── */
  test('welcome page renders branding, USP cards, and CTA buttons', async ({ page }) => {
    await page.goto('/welcome');
    await expect(page.getByTestId('page-welcome')).toBeVisible();

    // Logo (scoped to welcome page to avoid sidebar duplicate)
    await expect(
      page.getByTestId('page-welcome').locator('svg[aria-label="VaultFolio"]'),
    ).toBeVisible();

    // Tagline
    await expect(
      page.getByText('The only crypto tracker that never sees your data.'),
    ).toBeVisible();

    // 3 USP cards
    await expect(page.getByText('Zero-Knowledge Encryption')).toBeVisible();
    await expect(page.getByText('Multi-Exchange Import')).toBeVisible();
    await expect(page.getByText('Tax Reports')).toBeVisible();

    // CTA buttons
    await expect(page.getByTestId('btn-signup')).toBeVisible();
    await expect(page.getByTestId('btn-signin')).toBeVisible();
    await expect(page.getByTestId('btn-offline')).toBeVisible();
  });

  test('welcome CTA navigates to signup', async ({ page }) => {
    await page.goto('/welcome');
    await page.getByTestId('btn-signup').click();
    await expect(page).toHaveURL(/\/auth\/signup/);
  });

  test('welcome CTA navigates to signin', async ({ page }) => {
    await page.goto('/welcome');
    await page.getByTestId('btn-signin').click();
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  /* ── Navigation (desktop: sidebar) ───────────────── */
  test('sidebar navigation: 5 main views accessible', async ({ page, request }) => {
    await resetApp(page, request);
    await signupAndSetupVault(page);

    // Should be on /home with sidebar visible
    await expect(page.getByTestId('nav-home')).toBeVisible();
    await expect(page.getByTestId('nav-portfolio')).toBeVisible();
    await expect(page.getByTestId('nav-transactions')).toBeVisible();
    await expect(page.getByTestId('nav-taxes')).toBeVisible();
    await expect(page.getByTestId('nav-settings')).toBeVisible();

    // Navigate to each view
    await page.getByTestId('nav-portfolio').click();
    await expect(page).toHaveURL(/\/portfolio/);

    await page.getByTestId('nav-transactions').click();
    await expect(page).toHaveURL(/\/transactions/);

    await page.getByTestId('nav-taxes').click();
    await expect(page).toHaveURL(/\/taxes/);

    await page.getByTestId('nav-settings').click();
    await expect(page).toHaveURL(/\/settings/);

    await page.getByTestId('nav-home').click();
    await expect(page).toHaveURL(/\/home/);
  });

  /* ── Backward-compat redirects ───────────────────── */
  test('old URLs redirect to new routes', async ({ page, request }) => {
    await resetApp(page, request);
    await signupAndSetupVault(page);

    await spaNavigate(page, '/dashboard');
    await expect(page).toHaveURL(/\/home/, { timeout: 5_000 });

    await spaNavigate(page, '/imports');
    await expect(page).toHaveURL(/\/transactions\/import/, { timeout: 5_000 });

    await spaNavigate(page, '/alerts');
    await expect(page).toHaveURL(/\/settings\/alerts/, { timeout: 5_000 });

    await spaNavigate(page, '/assets');
    await expect(page).toHaveURL(/\/settings\/assets/, { timeout: 5_000 });

    await spaNavigate(page, '/account');
    await expect(page).toHaveURL(/\/settings\/account/, { timeout: 5_000 });
  });

  /* ── Language switch ─────────────────────────────── */
  test('language switch: EN → FI → EN', async ({ page, request }) => {
    await resetApp(page, request);
    await signupAndSetupVault(page);

    // Navigate to settings
    await spaNavigate(page, '/settings');
    await expect(page.getByTestId('page-settings')).toBeVisible();

    // Default language is EN — sidebar should show "Home"
    await expect(page.getByTestId('nav-home')).toContainText('Home');

    // Switch to FI
    await page.getByTestId('btn-lang-fi').click();
    // Sidebar should now show Finnish labels
    await expect(page.getByTestId('nav-home')).toContainText('Koti');
    await expect(page.getByTestId('nav-settings')).toContainText('Asetukset');

    // Switch back to EN
    await page.getByTestId('btn-lang-en').click();
    await expect(page.getByTestId('nav-home')).toContainText('Home');
  });

  /* ── Mobile viewport: bottom tab bar ─────────────── */
  test('mobile viewport shows bottom tab bar, hides sidebar', async ({ page, request }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await resetApp(page, request);
    await signupAndSetupVault(page);

    // Bottom tab bar should be visible
    await expect(page.getByTestId('tab-home')).toBeVisible();
    await expect(page.getByTestId('tab-portfolio')).toBeVisible();
    await expect(page.getByTestId('tab-transactions')).toBeVisible();
    await expect(page.getByTestId('tab-taxes')).toBeVisible();
    await expect(page.getByTestId('tab-settings')).toBeVisible();

    // Sidebar nav items should be hidden (md:flex = hidden on mobile)
    await expect(page.getByTestId('nav-home')).not.toBeVisible();

    // Navigate via bottom tabs
    await page.getByTestId('tab-portfolio').click();
    await expect(page).toHaveURL(/\/portfolio/);

    await page.getByTestId('tab-settings').click();
    await expect(page).toHaveURL(/\/settings/);
  });
});
