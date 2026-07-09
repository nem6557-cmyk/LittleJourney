import { expect, test } from '@playwright/test';

test.describe('release readiness', () => {
  test('serves public legal and support pages at store-listing URLs', async ({ page }) => {
    await page.goto('/privacy.html');
    await expect(page).toHaveTitle(/Privacy Policy/);
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
    await expect(page.getByText('Supabase for authentication')).toBeVisible();

    await page.goto('/terms.html');
    await expect(page).toHaveTitle(/Terms of Service/);
    await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();

    await page.goto('/support.html');
    await expect(page).toHaveTitle(/Support/);
    await expect(page.getByRole('heading', { name: 'Support' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'support@littlejourney.app' })).toBeVisible();
  });

  test('keeps the login form inside the mobile viewport', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'), 'mobile-only layout smoke test');

    await page.goto('/');
    await page.getByRole('button', { name: 'Skip onboarding' }).click();

    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();

    const viewport = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }));

    expect(Math.max(viewport.scrollWidth, viewport.bodyScrollWidth)).toBeLessThanOrEqual(
      viewport.clientWidth + 2,
    );
  });
});
