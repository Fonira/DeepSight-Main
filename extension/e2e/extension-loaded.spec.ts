import { test, expect } from "./fixtures/extension";

test.describe("Extension loaded on YouTube", () => {
  test("injects host and populates shadow root on /watch", async ({
    context,
  }) => {
    const page = await context.newPage();
    // A real, stable public video (the very first YouTube upload, "Me at the zoo").
    // If it goes 404 switch to another with a stable ID.
    await page.goto("https://www.youtube.com/watch?v=jNQXAC9IVRw", {
      waitUntil: "domcontentloaded",
    });

    // Give the content script up to 20s to inject — YouTube initial render is slow.
    await page.waitForFunction(
      () => !!document.getElementById("deepsight-host"),
      { timeout: 20_000 },
    );

    const host = page.locator("#deepsight-host");
    await expect(host).toBeVisible({ timeout: 5_000 });

    // The shadow is `mode: closed`, so we cannot access shadowRoot from
    // the page context. Bounding box presence is enough to prove the host
    // was rendered and laid out.
    const box = await host.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(40);

    // Screenshot for manual verification (Playwright handles the dir).
    await page.screenshot({
      path: "e2e-report/youtube-watch-injected.png",
      fullPage: false,
    });
  });

  test("no ds_crash_log after boot", async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto("https://www.youtube.com/watch?v=jNQXAC9IVRw", {
      waitUntil: "domcontentloaded",
    });
    // Let the content script run through its full boot window.
    await page.waitForTimeout(10_000);

    // Read chrome.storage.local from an extension context (popup page).
    const swPage = await context.newPage();
    await swPage.goto(`chrome-extension://${extensionId}/popup.html`);
    const crashes = await swPage.evaluate(async () => {
      const { ds_crash_log } = await chrome.storage.local.get("ds_crash_log");
      return ds_crash_log ?? [];
    });

    expect(
      crashes,
      `Unexpected crashes: ${JSON.stringify(crashes, null, 2)}`,
    ).toHaveLength(0);
  });
});
