import { expect, test, type Page } from '@playwright/test';

const testUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'qa@example.test',
  full_name: 'QA Customer',
  is_premium: false,
  payment_completed: false,
  plan_type: 'free',
  ai_ready: false,
  recording_completed: false,
  usage_quota: {
    limits: {
      recording_minutes: 15,
      text_messages: 5,
      family_members: 1,
      storage_mb: 500,
    },
  },
};

async function installAuthenticatedSession(page: Page) {
  await page.addInitScript((user) => {
    window.localStorage.setItem(
      'voicevault_session',
      JSON.stringify({ access: 'test.access.token', refresh: 'test-refresh-token' })
    );
    window.localStorage.setItem('voicevault_last_activity', String(Date.now()));
    window.localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: {
          user,
          tokens: { access: 'test.access.token', refresh: 'test-refresh-token' },
          isAuthenticated: true,
        },
        version: 0,
      })
    );
  }, testUser);

  await page.route('**/api/users/profile/', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(testUser) })
  );
  await page.route('**/api/family/accessible-ais/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [] }),
    })
  );
}

test('signup reports every required validation error inline', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel(/I agree to the/i).check();
  await page.getByRole('button', { name: /Create Free Account/i }).click();

  await expect(page.getByText('Full name is required')).toBeVisible();
  await expect(page.getByText('Valid email is required')).toBeVisible();
  await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
  await expect(page.getByText('Please confirm your password')).toBeVisible();

  await page.getByLabel(/Full name/i).fill('QA Customer');
  await page.getByLabel(/Email address/i).fill('qa@example.test');
  await page.getByLabel(/^Password$/i).fill('Password123!');
  await page.getByLabel(/Confirm password/i).fill('Different123!');
  await page.getByRole('button', { name: /Create Free Account/i }).click();
  await expect(page.getByText('Passwords do not match')).toBeVisible();

  await page.getByLabel(/Confirm password/i).fill('Password123!');
  await page.getByLabel(/I agree to the/i).uncheck();
  await page.getByRole('button', { name: /Create Free Account/i }).click();
  await expect(page.getByText('You must accept the Terms and Privacy Policy')).toBeVisible();
});

test('authenticated marketing header and page landmarks are correct', async ({ page }) => {
  await installAuthenticatedSession(page);
  await page.goto('/');

  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(navigation.getByRole('link', { name: 'Settings' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Open My Vault' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveCount(1);
});

test('mobile CTA fits and the How It Works anchor clears the sticky header', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');

  const cta = page.getByRole('link', { name: /Preserve My Voice — \$149\.99 Lifetime/i });
  const ctaBox = await cta.boundingBox();
  expect(ctaBox).not.toBeNull();
  expect(ctaBox!.x).toBeGreaterThanOrEqual(0);
  expect(ctaBox!.x + ctaBox!.width).toBeLessThanOrEqual(320);

  await page.goto('/#how-it-works');
  const sectionTop = await page
    .locator('#how-it-works')
    .evaluate((element) => element.getBoundingClientRect().top);
  const headerHeight = await page
    .locator('header')
    .evaluate((element) => element.getBoundingClientRect().height);
  expect(sectionTop).toBeGreaterThanOrEqual(headerHeight - 1);
});

test('404 Go Back falls safely to Home without prior app history', async ({ page }) => {
  await page.goto('/definitely-not-a-real-route');
  await page.getByRole('button', { name: 'Go Back' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('payment return requires authentication and preserves a safe return path', async ({
  page,
}) => {
  await page.goto('/pricing/success?session_id=cs_test_safe');
  await expect(page).toHaveURL(/\/login\?redirect=/);
  const redirect = new URL(page.url()).searchParams.get('redirect');
  expect(redirect).toBe('/pricing/success?session_id=cs_test_safe');
});

test('payment return without a session never claims Premium', async ({ page }) => {
  await page.goto('/pricing/success');
  await expect(page.getByText(/missing its verification code/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Return to pricing' })).toBeVisible();
  await expect(page.getByText(/Welcome to VoiceVault Premium/i)).toHaveCount(0);
});

test('payment return explains cross-account ownership without granting success', async ({
  page,
}) => {
  await installAuthenticatedSession(page);
  await page.route('**/api/payments/confirm-checkout/', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Checkout session does not belong to this user' }),
    })
  );

  await page.goto('/pricing/success?session_id=cs_test_other_account');
  await expect(page.getByText(/belongs to a different VoiceVault account/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Switch account' })).toBeVisible();
  await expect(page.getByText(/Welcome to VoiceVault Premium/i)).toHaveCount(0);
});

test('settings exposes correct password-manager semantics', async ({ page }) => {
  await installAuthenticatedSession(page);
  await page.route('**/api/payments/billing/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        is_paid: false,
        plan_name: null,
        amount_paid_cents: null,
        paid_at: null,
        payment_method_display: null,
        is_lifetime: false,
        receipt_url: null,
      }),
    })
  );

  await page.goto('/settings');
  await expect(page.getByLabel('Current Password')).toHaveAttribute(
    'autocomplete',
    'current-password'
  );
  await expect(page.getByLabel('New Password', { exact: true })).toHaveAttribute(
    'autocomplete',
    'new-password'
  );
  await expect(page.getByLabel('Confirm New Password')).toHaveAttribute(
    'autocomplete',
    'new-password'
  );
  await expect(page.locator('h1')).toHaveCount(1);
});

test('checkout loading copy does not reference a missing button', async ({ page }) => {
  await installAuthenticatedSession(page);
  await page.route('**/api/payments/create-checkout/', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Test checkout unavailable' }),
    });
  });

  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Redirecting to secure checkout' })).toBeVisible();
  await expect(page.getByText(/continue automatically/i)).toBeVisible();
  await expect(page.getByText(/click below/i)).toHaveCount(0);
});

test('pricing states the exact Premium question count', async ({ page }) => {
  await page.route('**/api/payments/packages/', (route) => route.abort());
  await page.goto('/pricing');
  await expect(page.getByText('30 guided questions + optional reflection')).toBeVisible();
  await expect(page.getByText('30+ guided questions')).toHaveCount(0);
});
