// ── E2E Playwright — Sidepanel Spec #4 ──
//
// Charge l'extension Chrome packagée (dist/) puis ouvre directement
// chrome-extension://<id>/sidepanel.html pour vérifier que :
//   1. Preact monte sur #root sans CSP violation.
//   2. Le bouton "Appeler" s'affiche en mode companion (pas de contexte).
//   3. Le contexte voicePanelContext stocké dans chrome.storage.session
//      est lu au mount et affiché.
//
// Pré-requis : `npm run build` doit avoir tourné. La fixture extension.ts
// lance Chromium avec --load-extension=dist/ et expose `extensionId`.

import { test, expect } from "./fixtures/extension";

test.describe("Sidepanel — chargement & CSP", () => {
  test("sidepanel.html charge sans violation CSP", async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    const cspViolations: string[] = [];
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      const text = msg.text();
      if (msg.type() === "error") consoleErrors.push(text);
      if (text.toLowerCase().includes("content security policy")) {
        cspViolations.push(text);
      }
    });

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // Attendre que Preact monte
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 5_000 });
    await expect(page.getByText(/DeepSight Voice/i)).toBeVisible();

    // Le bouton "Appeler" / mic-btn doit être présent (mode companion)
    await expect(page.getByTestId("voice-toggle-btn")).toBeVisible();

    // Pas de CSP violation
    expect(cspViolations).toEqual([]);

    // Pas d'erreur de blocage CSP sur les hosts ElevenLabs/DeepSight
    const blockingErrors = consoleErrors.filter(
      (e) =>
        e.toLowerCase().includes("refused to connect") ||
        e.toLowerCase().includes("blocked by csp"),
    );
    expect(blockingErrors).toEqual([]);
  });

  test("sidepanel lit le contexte depuis chrome.storage.session", async ({
    context,
    extensionId,
  }) => {
    // Inject context dans storage.session via service worker
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent("serviceworker");
    await sw.evaluate(async () => {
      const session = (
        chrome as unknown as {
          storage: {
            session?: {
              set: (data: Record<string, unknown>) => Promise<void>;
            };
          };
        }
      ).storage.session;
      if (session) {
        await session.set({
          voicePanelContext: {
            summaryId: 42,
            videoId: "test-video-id",
            videoTitle: "Test E2E Video",
            platform: "youtube",
          },
        });
      }
    });

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    // Le card video-context doit afficher le titre injecté
    await expect(page.getByTestId("voice-context-card")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(/Test E2E Video/i)).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByTestId("agent-type")).toContainText(/explorer/i);
  });
});
