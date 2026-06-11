import { expect, test } from '@playwright/test';

test('new customer can sign up, start the free vault, record answers, and reach processing', async ({ page }) => {
  const unique = Date.now();
  const email = `customer-${unique}@voicevault.test`;
  const password = `VaultPass-${unique}!`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /One Day, Your Voice/i })).toBeVisible();

  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: /Preserve a Legacy/i })).toBeVisible();
  await page.getByRole('button', { name: /Start Free Today/i }).click();

  await expect(page).toHaveURL(/\/signup/);
  await page.getByLabel(/Full name/i).fill('E2E Customer');
  await page.getByLabel(/Email address/i).fill(email);
  await page.getByLabel(/^Password$/i).fill(password);
  await page.getByLabel(/Confirm password/i).fill(password);
  await page.getByLabel(/I agree to the/i).check();
  await page.getByRole('button', { name: /Secure My Legacy/i }).click();

  await expect(page).toHaveURL(/\/checkout|checkout\.stripe\.com/);

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: /Welcome back, E2E Customer/i })).toBeVisible();
  await page.getByRole('button', { name: /Start Recording/i }).click();

  await expect(page).toHaveURL(/\/record/);
  await expect(page.getByRole('heading', { name: /Let Your Voice Live On/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Start Recording/i })).toBeEnabled();
  await page.getByRole('button', { name: /Start Recording/i }).click();

  await expect(page.getByText(/Question 1 of 5/i)).toBeVisible();
  const main = page.getByRole('main');

  for (let i = 1; i <= 5; i += 1) {
    await expect(page.getByText(new RegExp(`Question ${i} of 5`, 'i'))).toBeVisible();
    await page.getByRole('button', { name: /^Start$/i }).click();
    await expect(page.getByText(/Recording in progress/i)).toBeVisible();
    await page.waitForTimeout(1_500);
    await page.getByRole('button', { name: /^Stop$/i }).click();
    await expect(main.getByText(/Recording saved!/i)).toBeVisible();

    if (i < 5) {
      await page.getByRole('button', { name: /Next Question/i }).click();
    }
  }

  await expect(page.getByText(/All Questions Complete/i)).toBeVisible();
  await page.getByRole('button', { name: /Review Recordings/i }).click();
  await expect(page.getByRole('heading', { name: /Review Your Recordings/i })).toBeVisible();
  await expect(page.getByText(/5 \/ 5/i)).toBeVisible();

  await page.getByRole('button', { name: /Upload Recordings/i }).click();
  await expect(page.getByText('Combine recordings')).toBeVisible();
  await expect(page).toHaveURL(/\/processing/, { timeout: 90_000 });
  await expect(page.getByRole('heading', { name: /AI Processing/i })).toBeVisible();
});
