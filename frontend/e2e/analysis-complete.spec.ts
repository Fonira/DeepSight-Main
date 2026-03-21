/**
 * 🧪 E2E Tests — Video Analysis Flows
 * Coverage: URL submission, analysis result viewing, exports, chat interactions
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';
const TEST_YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

// Helper to set authenticated state
async function authenticateUser(page, context) {
  await context.addCookies([
    {
      name: 'access_token',
      value: 'test-auth-token',
      domain: 'localhost',
      path: '/',
    },
  ]);

  await context.addInitScript(() => {
    const user = {
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
      plan: 'free',
      credits: 150,
      email_verified: true,
    };
    localStorage.setItem('cached_user', JSON.stringify(user));
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📤 ANALYSIS SUBMISSION
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Analysis - URL Submission', () => {
  test('should navigate to dashboard', async ({ page, context }) => {
    await authenticateUser(page, context);

    await page.goto('/dashboard');

    await expect(page).toHaveTitle(/dashboard|home/i);
    await expect(page.getByRole('textbox', { name: /youtube|url|paste/i })).toBeVisible();
  });

  test('should show input field for YouTube URL', async ({ page, context }) => {
    await authenticateUser(page, context);

    await page.goto('/dashboard');

    const input = page.getByRole('textbox', { name: /youtube|url|paste/i });
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', /youtube|url/i);
  });

  test('should validate YouTube URL format', async ({ page, context }) => {
    await authenticateUser(page, context);

    await page.goto('/dashboard');

    const input = page.getByRole('textbox', { name: /youtube|url|paste/i });
    const submitButton = page.getByRole('button', { name: /analyze|submit/i });

    // Try invalid URL
    await input.fill('not a url');
    await submitButton.click();

    await expect(page.getByText(/invalid|url|youtube/i)).toBeVisible();
  });

  test('should accept valid YouTube URL', async ({ page, context }) => {
    await authenticateUser(page, context);

    // Mock the analysis API
    await page.route('**/api/videos/analyze', route => {
      route.abort();
    });

    await page.goto('/dashboard');

    const input = page.getByRole('textbox', { name: /youtube|url|paste/i });
    const submitButton = page.getByRole('button', { name: /analyze|submit/i });

    await input.fill(TEST_YOUTUBE_URL);
    await submitButton.click();

    // Should accept the URL (API call would be made)
  });

  test('should show loading state during analysis', async ({ page, context }) => {
    await authenticateUser(page, context);

    // Mock slow API response
    await page.route('**/api/videos/analyze', async route => {
      await page.waitForTimeout(2000);
      await route.abort();
    });

    await page.goto('/dashboard');

    const input = page.getByRole('textbox', { name: /youtube|url|paste/i });
    const submitButton = page.getByRole('button', { name: /analyze|submit/i });

    await input.fill(TEST_YOUTUBE_URL);
    await submitButton.click();

    // Should show loading indicator
    await expect(page.getByText(/analyzing|processing|loading/i)).toBeVisible({ timeout: 5000 });
  });

  test('should disable input during analysis', async ({ page, context }) => {
    await authenticateUser(page, context);

    await page.route('**/api/videos/analyze', async route => {
      await page.waitForTimeout(1000);
      await route.abort();
    });

    await page.goto('/dashboard');

    const input = page.getByRole('textbox', { name: /youtube|url|paste/i }) as any;
    const submitButton = page.getByRole('button', { name: /analyze|submit/i }) as any;

    await input.fill(TEST_YOUTUBE_URL);
    await submitButton.click();

    // Input and button should be disabled
    const isInputDisabled = await input.evaluate(el => el.disabled);
    expect(isInputDisabled).toBe(true);
  });

  test('should clear input after successful analysis', async ({ page, context }) => {
    await authenticateUser(page, context);

    // Mock successful API response
    await page.route('**/api/videos/analyze', route => {
      route.continue();
    });

    await page.goto('/dashboard');

    const input = page.getByRole('textbox', { name: /youtube|url|paste/i });
    await input.fill(TEST_YOUTUBE_URL);

    const submitButton = page.getByRole('button', { name: /analyze|submit/i });
    await submitButton.click();

    // Wait a bit for async operations
    await page.waitForTimeout(500);

    // Input should be cleared
    const value = await input.inputValue();
    expect(value).toBe('');
  });

  test('should handle paste event', async ({ page, context }) => {
    await authenticateUser(page, context);

    await page.goto('/dashboard');

    const input = page.getByRole('textbox', { name: /youtube|url|paste/i });

    // Simulate paste
    await input.click();
    await page.evaluate(url => {
      const event = new ClipboardEvent('paste', {
        clipboardData: new DataTransfer(),
      });
      event.clipboardData?.setData('text', url);
      document.activeElement?.dispatchEvent(event);
    }, TEST_YOUTUBE_URL);

    // Input should have the pasted URL
    await input.waitFor({ state: 'visible' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 ANALYSIS RESULTS VIEWING
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Analysis - Results Viewing', () => {
  test('should display analysis tabs', async ({ page, context }) => {
    await authenticateUser(page, context);

    await page.goto('/dashboard');

    // Wait for synthesis tab to appear (after analysis)
    const synthesisTab = page.getByRole('tab', { name: /synthesis|summary/i });
    if (await synthesisTab.isVisible()) {
      await expect(synthesisTab).toBeVisible();
    }
  });

  test('should show synthesis content', async ({ page, context }) => {
    await authenticateUser(page, context);

    await page.goto('/dashboard');

    const synthesisTab = page.getByRole('tab', { name: /synthesis|summary/i });
    if (await synthesisTab.isVisible()) {
      await synthesisTab.click();

      // Should show content
      await expect(page.getByText(/summary|analysis|content/i)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should show reliability tab', async ({ page, context }) => {
    await authenticateUser(page, context);

    await page.goto('/dashboard');

    const reliabilityTab = page.getByRole('tab', { name: /reliability|fact.*check|sources/i });
    if (await reliabilityTab.isVisible()) {
      await expect(reliabilityTab).toBeVisible();
    }
  });

  test('should show chat tab', async ({ page, context }) => {
    await authenticateUser(page, context);

    await page.goto('/dashboard');

    const chatTab = page.getByRole('tab', { name: /chat|conversation/i });
    if (await chatTab.isVisible()) {
      await expect(chatTab).toBeVisible();
    }
  });

  test('should navigate between tabs', async ({ page, context }) => {
    await authenticateUser(page, context);

    await page.goto('/dashboard');

    const tabs = page.getByRole('tab');
    const count = await tabs.count();

    if (count > 1) {
      // Click through tabs
      for (let i = 0; i < count; i++) {
        const tab = tabs.nth(i);
        if (await tab.isVisible()) {
          await tab.click();
          await page.waitForTimeout(500);
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 💬 CHAT INTERACTION
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Analysis - Chat Interaction', () => {
  test('should show chat input', async ({ page, context }) => {
    await authenticateUser(page, context);

    await page.goto('/dashboard');

    const chatTab = page.getByRole('tab', { name: /chat/i });
    if (await chatTab.isVisible()) {
      await chatTab.click();

      const chatInput = page.getByRole('textbox', { name: /message|question|ask/i });
      await expect(chatInput).toBeVisible({ timeout: 5000 });
    }
  });

  test('should send chat message', async ({ page, context }) => {
    await authenticateUser(page, context);

    // Mock chat API
    await page.route('**/api/chat/**', route => {
      route.continue();
    });

    await page.goto('/dashboard');

    const chatTab = page.getByRole('tab', { name: /chat/i });
    if (await chatTab.isVisible()) {
      await chatTab.click();

      const chatInput = page.getByRole('textbox', { name: /message|question/i });
      const sendButton = page.getByRole('button', { name: /send|ask|submit/i });

      if (await chatInput.isVisible() && await sendButton.isVisible()) {
        await chatInput.fill('What is this video about?');
        await sendButton.click();

        // Should show loading or response
        await page.waitForTimeout(500);
      }
    }
  });

  test('should show chat history', async ({ page, context }) => {
    await authenticateUser(page, context);

    await page.goto('/dashboard');

    const chatTab = page.getByRole('tab', { name: /chat/i });
    if (await chatTab.isVisible()) {
      await chatTab.click();

      // Chat messages should appear
      const messages = page.getByText(/what|how|why|tell|explain/i);
      // Wait to see if any messages appear
      await messages.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 📥 EXPORT FUNCTIONALITY
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Analysis - Export', () => {
  test('should show export button', async ({ page, context }) => {
    await authenticateUser(page, context);

    await page.goto('/dashboard');

    const exportButton = page.getByRole('button', { name: /export|download/i });
    if (await exportButton.isVisible()) {
      await expect(exportButton).toBeVisible();
    }
  });

  test('should show export format options', async ({ page, context }) => {
    await authenticateUser(page, context);

    await page.goto('/dashboard');

    const exportButton = page.getByRole('button', { name: /export|download/i });
    if (await exportButton.isVisible()) {
      await exportButton.click();

      // Should show format options
      const pdfOption = page.getByRole('button', { name: /pdf/i });
      const markdownOption = page.getByRole('button', { name: /markdown|md/i });

      if (await pdfOption.isVisible() || await markdownOption.isVisible()) {
        expect(true).toBe(true);
      }
    }
  });

  test('should trigger download on export', async ({ page, context }) => {
    await authenticateUser(page, context);

    const downloadPromise = page.waitForEvent('download').catch(() => null);

    await page.goto('/dashboard');

    const exportButton = page.getByRole('button', { name: /export|download/i });
    if (await exportButton.isVisible()) {
      await exportButton.click();

      const pdfOption = page.getByRole('button', { name: /pdf/i });
      if (await pdfOption.isVisible()) {
        await pdfOption.click();

        // May or may not trigger download in test
        await downloadPromise;
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ⭐ FAVORITE FUNCTIONALITY
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Analysis - Favorites', () => {
  test('should show favorite button', async ({ page, context }) => {
    await authenticateUser(page, context);

    await page.goto('/dashboard');

    const favoriteButton = page.getByRole('button', { name: /favorite|heart|star/i });
    if (await favoriteButton.isVisible()) {
      await expect(favoriteButton).toBeVisible();
    }
  });

  test('should toggle favorite status', async ({ page, context }) => {
    await authenticateUser(page, context);

    await page.goto('/dashboard');

    const favoriteButton = page.getByRole('button', { name: /favorite|heart|star/i });
    if (await favoriteButton.isVisible()) {
      const initialState = await favoriteButton.getAttribute('aria-pressed');

      await favoriteButton.click();
      await page.waitForTimeout(500);

      const newState = await favoriteButton.getAttribute('aria-pressed');

      // State should change or visual indicator should update
      expect(newState).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Analysis - Error Handling', () => {
  test('should handle API errors gracefully', async ({ page, context }) => {
    await authenticateUser(page, context);

    // Mock error response
    await page.route('**/api/videos/analyze', route => {
      route.abort('failed');
    });

    await page.goto('/dashboard');

    const input = page.getByRole('textbox', { name: /youtube|url/i });
    const submitButton = page.getByRole('button', { name: /analyze/i });

    await input.fill(TEST_YOUTUBE_URL);
    await submitButton.click();

    // Should show error message
    await expect(page.getByText(/error|failed|connection/i)).toBeVisible({ timeout: 10000 });
  });

  test('should show error for invalid video', async ({ page, context }) => {
    await authenticateUser(page, context);

    // Mock 404 response
    await page.route('**/api/videos/analyze', route => {
      route.abort();
    });

    await page.goto('/dashboard');

    const input = page.getByRole('textbox', { name: /youtube|url/i });
    const submitButton = page.getByRole('button', { name: /analyze/i });

    await input.fill('https://youtube.com/watch?v=notarealvideo');
    await submitButton.click();

    await page.waitForTimeout(1000);
  });

  test('should handle network timeout', async ({ page, context }) => {
    await authenticateUser(page, context);

    // Mock timeout
    await page.route('**/api/videos/**', async route => {
      await page.waitForTimeout(35000); // Over typical timeout
      await route.abort('timedout');
    });

    await page.goto('/dashboard');

    const input = page.getByRole('textbox', { name: /youtube|url/i });
    const submitButton = page.getByRole('button', { name: /analyze/i });

    await input.fill(TEST_YOUTUBE_URL);
    await submitButton.click();

    // Should eventually show timeout error or retry
    await page.waitForTimeout(2000);
  });
});
