import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page).toHaveTitle(/Unity Voice Lab – System Check/);
});
