import { test, expect } from '@playwright/test';
import { resetApp, signupAndSetupVault, spaNavigate } from './helpers';

test('imports: provider grid shows coinbase + coming-soon cards', async ({ page, request }) => {
  await resetApp(page, request);
  await signupAndSetupVault(page);

  await spaNavigate(page, '/transactions/import');

  // Provider grid is visible
  const grid = page.getByTestId('list-import-sources');
  await expect(grid).toBeVisible();

  // Coinbase card is shown
  await expect(page.getByTestId('card-import-coinbase')).toBeVisible();

  // Connect form is visible (not connected state)
  await expect(page.getByTestId('form-coinbase-keyname')).toBeVisible();
  await expect(page.getByTestId('form-coinbase-privatekey')).toBeVisible();

  // Coming-soon cards are shown
  await expect(page.getByTestId('card-import-binance')).toBeVisible();
  await expect(page.getByTestId('card-import-mexc')).toBeVisible();
});
