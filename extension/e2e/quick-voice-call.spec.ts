// ── E2E Playwright — Quick Voice Call (V1) ──
//
// Charge l'extension Chrome packagée (dist/) puis simule le flow
// Quick Voice Call complet sans dépendre du backend prod ni du SDK
// ElevenLabs (les 2 requièrent du réseau réel et un mic).
//
// Stratégie de mocking :
//   - On inject `pendingVoiceCall` dans chrome.storage.session via SW.
//   - Le sidepanel route automatiquement vers VoiceView grâce au listener
//     storage.onChanged ajouté dans App.tsx (B4 + I6).
//   - On observe la phase ConnectingView (mic pulsant + "Connexion à
//     l'agent…"). Sans backend, l'appel ne progressera pas — c'est OK
//     pour ce spec qui valide UNIQUEMENT le wiring side panel routing.
//
// Pré-requis : `npm run build` doit avoir tourné (dist/ à jour).
//
// Tags Quick Voice Call I7 — finding de l'audit Quick Voice Call.

import { test, expect } from "./fixtures/extension";

test.describe("Quick Voice Call — wiring side panel (I7)", () => {
  test("pendingVoiceCall in storage.session routes to VoiceView ConnectingView", async ({
    context,
    extensionId,
  }) => {
    // 1. Inject pendingVoiceCall via service worker.
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
          pendingVoiceCall: {
            videoId: "e2e-test-video",
            videoTitle: "E2E Test Video",
            plan: "free",
          },
        });
      }
    });

    // 2. Ouvrir sidepanel.html directement.
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // 3. ConnectingView doit s'afficher (selector data-testid).
    await expect(page.getByTestId("ds-connecting")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(/Connexion à l'agent|Connecting to/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("pendingVoiceCall is consumed once (B4 centralization)", async ({
    context,
    extensionId,
  }) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent("serviceworker");

    // Inject + open sidepanel.
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
          pendingVoiceCall: {
            videoId: "e2e-consume-test",
            videoTitle: "Consume Test",
          },
        });
      }
    });

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await expect(page.getByTestId("ds-connecting")).toBeVisible({
      timeout: 5_000,
    });

    // Vérifier que la clé a été supprimée (centralisation B4).
    const remaining = await sw.evaluate(async () => {
      const session = (
        chrome as unknown as {
          storage: {
            session?: {
              get: (key: string) => Promise<Record<string, unknown>>;
            };
          };
        }
      ).storage.session;
      if (!session) return null;
      const data = await session.get("pendingVoiceCall");
      return data.pendingVoiceCall ?? null;
    });
    expect(remaining).toBeNull();
  });

  test("storage.onChanged triggers VoiceView for late pendingVoiceCall (I6)", async ({
    context,
    extensionId,
  }) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent("serviceworker");

    // Open sidepanel WITHOUT pendingVoiceCall set first.
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // Sidepanel devrait être en login (no auth) ou main (legacy).
    // On ne devrait PAS voir ds-connecting tant que la clé n'est pas set.
    const connectingBefore = await page
      .getByTestId("ds-connecting")
      .count();
    expect(connectingBefore).toBe(0);

    // Maintenant le SW set la clé (clic Quick Voice Call sur YouTube).
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
          pendingVoiceCall: {
            videoId: "e2e-late-update",
            videoTitle: "Late Update",
          },
        });
      }
    });

    // Le sidepanel doit basculer vers VoiceView via storage.onChanged.
    await expect(page.getByTestId("ds-connecting")).toBeVisible({
      timeout: 5_000,
    });
  });
});
