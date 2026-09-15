import { expect, test } from '@playwright/test';

const testUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'microphone-test@voicevault.test',
  full_name: 'Microphone Test User',
  plan_type: 'free',
  package_tier: 'free',
  is_premium: false,
  payment_completed: false,
  recording_completed: false,
  ai_ready: false,
};

test('microphone setup requests permission and reports a real test result', async ({ context, page, baseURL }) => {
  if (!baseURL) throw new Error('A base URL is required for the microphone test.');
  await context.grantPermissions(['microphone'], { origin: new URL(baseURL).origin });

  await page.addInitScript((user) => {
    const tokens = { access: 'test-access-token', refresh: 'test-refresh-token' };
    localStorage.setItem('voicevault_session', JSON.stringify(tokens));
    localStorage.setItem('voicevault_last_activity', String(Date.now()));
    localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: { user, tokens, isAuthenticated: true },
        version: 0,
      })
    );
  }, testUser);

  await page.route('**/api/users/profile/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(testUser) });
  });
  await page.route('**/api/recordings/questions/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            question_text: 'Tell us about a happy memory.',
            domain: 'childhood',
            order: 1,
            suggested_duration_seconds: 60,
            is_active: true,
            created_at: '2026-09-15T00:00:00Z',
            updated_at: '2026-09-15T00:00:00Z',
          },
        ],
      }),
    });
  });

  await page.goto('/record');

  await expect(page.getByText('Microphone access granted')).toBeVisible();
  await page.getByRole('button', { name: 'Test Microphone' }).click();
  await expect(page.getByText('Speak normally — listening now')).toBeVisible();
  await expect(
    page.getByText(/Sound detected\. Your microphone is working|Microphone connected, but no sound was detected/)
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Start Recording' })).toBeEnabled();
});
