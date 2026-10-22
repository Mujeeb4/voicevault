import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// Run against a disposable local stack. These tests create accounts and use real
// backend auth; they never finalize recordings or call payment/AI providers.
test('new frontend authenticates against Django and protects private screens', async ({ page, baseURL }) => {
  const hostname = new URL(baseURL!).hostname;
  test.skip(!['localhost', '127.0.0.1', '[::1]'].includes(hostname), 'Use a disposable local stack.');
  const email = `browser-${randomUUID()}@example.com`;
  const password = `Vault-${randomUUID()}!`;
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Create your free account' })).toBeVisible();
  await page.getByLabel('Full name').fill('Browser Smoke');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.locator('#terms').check();
  await page.getByRole('button', { name: 'Create free account' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: /Welcome.*Browser/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /Welcome.*Browser/ })).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Account settings' })).toBeVisible();
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
  await page.getByRole('button', { name: 'Go to Dashboard' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: /Welcome.*Browser/ })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});
