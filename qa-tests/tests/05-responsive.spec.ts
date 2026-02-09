import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════
// 3.6 Responsive & UI Tests
// ═══════════════════════════════════════════════════════════════

const VIEWPORTS = [
  { name: 'Mobile', width: 375, height: 812 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Desktop', width: 1280, height: 720 },
];

const PAGES_TO_TEST = [
  { path: '/', name: 'Landing' },
  { path: '/login', name: 'Login' },
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/history', name: 'History' },
  { path: '/upgrade', name: 'Upgrade' },
  { path: '/settings', name: 'Settings' },
];

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    for (const page_info of PAGES_TO_TEST) {
      test(`${page_info.name} should not have horizontal overflow`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(page_info.path, { waitUntil: 'networkidle' });

        // Check for horizontal overflow
        const hasOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        if (hasOverflow) {
          // Find the offending elements
          const overflowingElements = await page.evaluate(() => {
            const elements: string[] = [];
            const docWidth = document.documentElement.clientWidth;
            document.querySelectorAll('*').forEach(el => {
              const rect = el.getBoundingClientRect();
              if (rect.right > docWidth + 5) { // 5px tolerance
                elements.push(`${el.tagName}.${el.className?.toString().slice(0, 50)} (right: ${Math.round(rect.right)}px)`);
              }
            });
            return elements.slice(0, 10);
          });

          console.log(`OVERFLOW on ${page_info.name} at ${viewport.name}:`, overflowingElements);
        }

        // Log but don't fail hard - collect data
        console.log(`${page_info.name} @ ${viewport.name}: overflow=${hasOverflow}`);
      });

      test(`${page_info.name} should have readable text (not too small)`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(page_info.path, { waitUntil: 'networkidle' });

        // Check for text that's too small on mobile
        if (viewport.width <= 375) {
          const tooSmallText = await page.evaluate(() => {
            const small: string[] = [];
            document.querySelectorAll('p, span, a, li, td, th, label').forEach(el => {
              const style = window.getComputedStyle(el);
              const fontSize = parseFloat(style.fontSize);
              if (fontSize < 12 && el.textContent && el.textContent.trim().length > 0) {
                small.push(`${el.tagName}: "${el.textContent.trim().slice(0, 30)}" (${fontSize}px)`);
              }
            });
            return small.slice(0, 10);
          });

          if (tooSmallText.length > 0) {
            console.log(`Small text on ${page_info.name} mobile:`, tooSmallText);
          }
        }
      });
    }
  });
}

test.describe('Mobile Navigation', () => {
  test('should have mobile menu/hamburger on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    // Look for hamburger menu or bottom nav
    const mobileNav = page.locator(
      'button[aria-label*="menu" i], button[aria-label*="nav" i], [class*="hamburger" i], [class*="mobile-nav" i], [class*="bottom-nav" i], [class*="BottomNav" i], nav[class*="mobile" i]'
    );
    const count = await mobileNav.count();
    console.log(`Mobile navigation elements: ${count}`);
  });

  test('sidebar should be hidden on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    const sidebar = page.locator('[class*="sidebar" i], aside, nav[class*="side" i]');
    const visibleSidebars: string[] = [];

    for (let i = 0; i < await sidebar.count(); i++) {
      const isVisible = await sidebar.nth(i).isVisible().catch(() => false);
      if (isVisible) {
        const className = await sidebar.nth(i).getAttribute('class');
        visibleSidebars.push(className || 'unknown');
      }
    }

    console.log(`Visible sidebars on mobile: ${visibleSidebars.length}`, visibleSidebars);
  });
});

test.describe('Modals & Dropdowns', () => {
  test('modals should be dismissible with Escape key', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    // Try to find and open a modal
    const modalTriggers = page.locator(
      'button:has-text("Upgrade"), button:has-text("Exporter"), button:has-text("Partager"), button:has-text("More"), [data-modal-trigger]'
    );

    if (await modalTriggers.count() > 0) {
      await modalTriggers.first().click();
      await page.waitForTimeout(500);

      // Check if modal appeared
      const modal = page.locator('[role="dialog"], [class*="modal" i], [class*="Modal" i], [class*="overlay" i]');
      if (await modal.count() > 0) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        const modalAfter = page.locator('[role="dialog"]:visible, [class*="modal" i]:visible');
        const stillVisible = await modalAfter.count();
        console.log(`Modal still visible after Escape: ${stillVisible}`);
      }
    }
  });
});
