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

  test('serves the account-deletion page required by Google Play', async ({ page }) => {
    await page.goto('/delete-account.html');
    await expect(page).toHaveTitle(/Delete Your Account/);
    await expect(page.getByRole('heading', { name: 'Delete Your Account' })).toBeVisible();
    await expect(page.getByText('Delete My Account').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'privacy@littlejourney.app' })).toBeVisible();
  });

  test('serves an installable PWA manifest with real icons (Microsoft Store)', async ({ request }) => {
    const res = await request.get('/manifest.json');
    expect(res.ok()).toBe(true);
    const manifest = await res.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.start_url).toBe('/');
    const purposes = manifest.icons.map((i: { purpose: string }) => i.purpose);
    expect(purposes).toEqual(expect.arrayContaining(['any', 'maskable']));
    for (const icon of manifest.icons) {
      const img = await request.get(icon.src);
      expect(img.ok()).toBe(true);
      expect(img.headers()['content-type']).toContain('image/png');
    }
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
