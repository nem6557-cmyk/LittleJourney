import { expect, test } from '@playwright/test';

test.describe('auth onboarding', () => {
  test('loads the auth shell within a practical launch budget', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/');
    await expect(page.getByText('Welcome to Little Journey')).toBeVisible();

    const navigation = await page.evaluate(() => {
      const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      return entry
        ? {
            domContentLoaded: entry.domContentLoadedEventEnd,
            loadComplete: entry.loadEventEnd,
          }
        : null;
    });

    expect(pageErrors).toEqual([]);
    expect(navigation?.domContentLoaded ?? 0).toBeLessThan(5_000);
    expect(navigation?.loadComplete ?? 0).toBeLessThan(8_000);
  });

  test('lets users skip onboarding and validates login input', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Skip onboarding' }).click();

    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();

    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Please enter a valid email address')).toBeVisible();
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
  });

  test('does not show local pilot demo entry points in the production web shell', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Use Demo Daycare (Pilot)')).toHaveCount(0);
    await expect(page.getByText('Join Demo Daycare (Pilot)')).toHaveCount(0);
  });
});
