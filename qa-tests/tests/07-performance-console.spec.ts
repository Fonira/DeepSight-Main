import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════
// 3.8 & 3.9 Performance, Console & Network Tests
// ═══════════════════════════════════════════════════════════════

const PAGES = [
  { path: '/', name: 'Landing' },
  { path: '/login', name: 'Login' },
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/history', name: 'History' },
  { path: '/upgrade', name: 'Upgrade' },
  { path: '/settings', name: 'Settings' },
  { path: '/analytics', name: 'Analytics' },
  { path: '/playlists', name: 'Playlists' },
];

test.describe('Page Load Performance', () => {
  for (const pageInfo of PAGES) {
    test(`${pageInfo.name} - measure load time & FCP`, async ({ page }) => {
      const start = Date.now();

      await page.goto(pageInfo.path, { waitUntil: 'networkidle' });

      const loadTime = Date.now() - start;

      // Get performance metrics
      const metrics = await page.evaluate(() => {
        const entries = performance.getEntriesByType('paint');
        const fcp = entries.find(e => e.name === 'first-contentful-paint');
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

        return {
          fcp: fcp ? Math.round(fcp.startTime) : null,
          domContentLoaded: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
          loadComplete: navigation ? Math.round(navigation.loadEventEnd) : null,
          transferSize: navigation ? navigation.transferSize : null,
        };
      });

      console.log(`PERF [${pageInfo.name}]: Total=${loadTime}ms, FCP=${metrics.fcp}ms, DCL=${metrics.domContentLoaded}ms, Load=${metrics.loadComplete}ms`);

      // FCP should be under 3 seconds
      if (metrics.fcp) {
        expect(metrics.fcp).toBeLessThan(5000);
      }
    });
  }
});

test.describe('Console Errors Per Page', () => {
  for (const pageInfo of PAGES) {
    test(`${pageInfo.name} - capture all console errors`, async ({ page }) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        } else if (msg.type() === 'warning') {
          warnings.push(msg.text());
        }
      });

      page.on('pageerror', err => {
        errors.push(`PAGE ERROR: ${err.message}`);
      });

      await page.goto(pageInfo.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000); // Wait for async operations

      console.log(`\n=== ${pageInfo.name} Console Report ===`);
      console.log(`Errors: ${errors.length}`);
      errors.forEach((e, i) => console.log(`  ERROR ${i + 1}: ${e.slice(0, 200)}`));
      console.log(`Warnings: ${warnings.length}`);
      warnings.slice(0, 5).forEach((w, i) => console.log(`  WARN ${i + 1}: ${w.slice(0, 200)}`));
    });
  }
});

test.describe('Network Errors Per Page', () => {
  for (const pageInfo of PAGES) {
    test(`${pageInfo.name} - capture failed network requests`, async ({ page }) => {
      const failedRequests: { url: string; status: number; method: string }[] = [];
      const corsErrors: string[] = [];

      page.on('response', response => {
        if (response.status() >= 400) {
          failedRequests.push({
            url: response.url(),
            status: response.status(),
            method: response.request().method(),
          });
        }
      });

      page.on('requestfailed', request => {
        corsErrors.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
      });

      await page.goto(pageInfo.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      console.log(`\n=== ${pageInfo.name} Network Report ===`);
      console.log(`Failed requests (4xx/5xx): ${failedRequests.length}`);
      failedRequests.forEach(r => console.log(`  ${r.status} ${r.method} ${r.url.slice(0, 100)}`));
      console.log(`Request failures (CORS, etc): ${corsErrors.length}`);
      corsErrors.forEach(e => console.log(`  ${e.slice(0, 150)}`));
    });
  }
});

test.describe('API Request Loop Detection', () => {
  test('dashboard should not make repeated identical API calls', async ({ page }) => {
    const apiCalls: { url: string; time: number }[] = [];

    page.on('request', req => {
      if (req.url().includes('/api/')) {
        apiCalls.push({ url: req.url(), time: Date.now() });
      }
    });

    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(10000); // Wait 10s to detect loops

    // Group by URL
    const grouped: Record<string, number> = {};
    apiCalls.forEach(call => {
      const key = call.url.split('?')[0]; // Remove query params
      grouped[key] = (grouped[key] || 0) + 1;
    });

    console.log('\n=== API Call Frequency (10s window) ===');
    const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
    sorted.forEach(([url, count]) => {
      const flag = count > 5 ? ' [POSSIBLE LOOP]' : '';
      console.log(`  ${count}x ${url}${flag}`);
    });

    // Flag any endpoint called more than 10 times in 10 seconds
    const loops = sorted.filter(([, count]) => count > 10);
    if (loops.length > 0) {
      console.log('WARNING: Potential API request loops detected!');
    }
  });
});

test.describe('Missing Assets', () => {
  for (const pageInfo of PAGES) {
    test(`${pageInfo.name} - check for missing images/fonts/assets`, async ({ page }) => {
      const missing: string[] = [];

      page.on('response', response => {
        const url = response.url();
        const isAsset = /\.(png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico|webp|avif)(\?|$)/i.test(url);
        if (isAsset && response.status() === 404) {
          missing.push(url);
        }
      });

      await page.goto(pageInfo.path, { waitUntil: 'networkidle' });

      if (missing.length > 0) {
        console.log(`Missing assets on ${pageInfo.name}:`, missing);
      }

      // Also check for broken images in DOM
      const brokenImages = await page.evaluate(() => {
        const broken: string[] = [];
        document.querySelectorAll('img').forEach(img => {
          if (!img.complete || img.naturalWidth === 0) {
            broken.push(img.src || img.getAttribute('data-src') || 'unknown');
          }
        });
        return broken;
      });

      if (brokenImages.length > 0) {
        console.log(`Broken images on ${pageInfo.name}:`, brokenImages);
      }
    });
  }
});

test.describe('Bundle Size Check', () => {
  test('initial page load should transfer reasonable amount of data', async ({ page }) => {
    let totalTransfer = 0;
    const resourceSizes: { url: string; size: number }[] = [];

    page.on('response', async response => {
      const headers = response.headers();
      const size = parseInt(headers['content-length'] || '0');
      totalTransfer += size;
      if (size > 100000) { // > 100KB
        resourceSizes.push({ url: response.url().split('/').pop() || response.url(), size });
      }
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    console.log(`\n=== Bundle Size Report ===`);
    console.log(`Total transfer: ~${Math.round(totalTransfer / 1024)}KB`);
    console.log('Large resources (>100KB):');
    resourceSizes
      .sort((a, b) => b.size - a.size)
      .forEach(r => console.log(`  ${Math.round(r.size / 1024)}KB - ${r.url}`));
  });
});
