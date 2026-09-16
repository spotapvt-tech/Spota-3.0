import { test, expect } from '@playwright/test';

// Deliberately narrow smoke test: confirms the landing page actually renders
// and its primary CTA opens the auth flow. This is intentionally NOT the
// full "sign up → drop a gem → see it on the map" flow from the
// production-readiness plan — that needs real (or mocked) Supabase auth,
// camera/geolocation permissions, and verified selectors inside AddGemView's
// 5-step wizard, none of which were safe to guess at blind. Treat this as
// the foundation to build that flow on top of, not the finished item.
//
// Note: the marketing landing page only lives at /landing and /welcome
// (see App.jsx) — root "/" renders AuthView directly for signed-out users.
test.describe('Landing page', () => {
  test('loads and shows the hero content', async ({ page }) => {
    await page.goto('/landing');
    await expect(page.getByRole('heading', { name: 'Ditch the tourists. Find the vibe.' })).toBeVisible();
  });

  test('"Start Exploring Free" opens the auth modal', async ({ page }) => {
    await page.goto('/landing');
    // The same CTA label appears in the nav, hero, and closing section
    // (intentional - one label per intent) so target the hero's specifically.
    await page.locator('.l-hero-ctas').getByRole('button', { name: 'Start Exploring Free' }).click();
    await expect(page.locator('.l-modal-overlay')).toBeVisible();
  });
});
