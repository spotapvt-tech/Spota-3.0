import { test, expect } from '@playwright/test';

// Deliberately narrow smoke test: confirms the landing page actually renders
// and its primary CTA opens the auth flow. This is intentionally NOT the
// full "sign up → drop a gem → see it on the map" flow from the
// production-readiness plan — that needs real (or mocked) Supabase auth,
// camera/geolocation permissions, and verified selectors inside AddGemView's
// 5-step wizard, none of which were safe to guess at blind. Treat this as
// the foundation to build that flow on top of, not the finished item.
test.describe('Landing page', () => {
  test('loads and shows the hero content', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Ditch the tourists. Find the vibe.' })).toBeVisible();
  });

  test('"Start Exploring Free" opens the auth modal', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start Exploring Free' }).click();
    await expect(page.locator('.l-modal-overlay')).toBeVisible();
  });
});
