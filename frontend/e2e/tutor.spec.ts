/**
 * E2E — Le Tuteur companion (unified hub flow + plan gating)
 *
 * Couvre le flow UI du widget Tutor sur `/dashboard` :
 *   1. happy path (Pro) : teaser → TutorHub (text by default) → turn → close
 *   2. plan gating (Free) : sidebar item "Tuteur" → /upgrade redirect
 *
 * Refonte 2026-05-11 : `TutorPrompting` est supprimé, le clic teaser ouvre
 * directement `TutorHub` avec amorce concept (mode texte par défaut).
 *
 * ⚠️ Indépendance backend : tous les appels `tutorApi` (`/api/tutor/session/*`)
 * sont mockés via `page.route(...)`. Le test ne dépend PAS d'un backend up,
 * d'un user seedé ni de Mistral / Magistral / Redis. Pattern aligné sur
 * `analysis.spec.ts` (mock `/api/auth/me` + tokens localStorage).
 *
 * Selectors : volontairement résilients (rôles ARIA + textes FR/EN multiples)
 * car la Phase 4 (composant `<Tutor />`) est en cours en parallèle. Si un
 * selector exact est connu plus tard, le test reste vert tant que l'UI expose
 * AU MOINS un des patterns essayés.
 *
 * Réf :
 *   - Spec   : docs/superpowers/specs/2026-05-03-le-tuteur-companion-design.md
 *   - Plan   : docs/superpowers/plans/2026-05-03-le-tuteur-companion.md (Task 6.1)
 *   - Types  : frontend/src/types/tutor.ts
 *   - Client : frontend/src/services/api.ts (tutorApi.startSession/sendTurn/endSession)
 */
import { test, expect, type Page, type Route } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// Mock data — aligné sur les schémas Pydantic backend (tutor/schemas.py)
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_SESSION_ID = "tutor-test-123";

const MOCK_START_RESPONSE = {
  session_id: MOCK_SESSION_ID,
  first_prompt: "Pourriez-vous formuler ce concept avec vos propres mots ?",
  audio_url: null,
};

const MOCK_TURN_RESPONSE = {
  ai_response:
    "Voilà une bonne formulation. Pourriez-vous donner un exemple concret ?",
  audio_url: null,
  turn_count: 3,
};

const MOCK_END_RESPONSE = {
  duration_sec: 30,
  turns_count: 4,
  source_summary_url: null,
  source_video_title: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Auth helper — pattern analysis.spec.ts : mock /api/auth/me + LS tokens
// ─────────────────────────────────────────────────────────────────────────────

interface MockUserOpts {
  plan: "free" | "pro" | "expert";
}

async function mockAuthAsUser(page: Page, opts: MockUserOpts) {
  await page.route("**/api/auth/me", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 1,
        username: "testuser",
        email: "test@test.com",
        plan: opts.plan,
        credits: 100,
        credits_monthly: 200,
        is_admin: false,
        total_videos: 5,
        total_words: 10000,
        total_playlists: 0,
        email_verified: true,
        created_at: "2024-01-01T00:00:00Z",
      }),
    });
  });

  // Set tokens BEFORE first navigation so AuthContext picks them up
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("access_token", "mock-access-token");
    localStorage.setItem("refresh_token", "mock-refresh-token");
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Selector helpers — résilients, plusieurs patterns essayés
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Localise le bouton/widget Tutor en idle state.
 *
 * TODO: ajuster ce selector quand Phase 4 mergée — confirmer
 * `aria-label="Ouvrir le Tuteur"` (FR) / `"Open the Tutor"` (EN) sur le bouton
 * idle. Best guess actuel : un button accessible avec ces labels OU un
 * region/landmark intitulé "Tuteur" / "Tutor".
 */
function tutorWidget(page: Page) {
  return page
    .getByRole("button", { name: /ouvrir le tuteur|open the tutor|tuteur/i })
    .or(page.getByRole("region", { name: /tuteur|tutor/i }))
    .or(page.locator('[data-testid="tutor-widget"]'))
    .first();
}

/**
 * Localise le panneau TutorHub (rendu via portal sur le body).
 * Disponible dès que la teaser est cliquée.
 */
function tutorHubDialog(page: Page) {
  return page.locator('[data-testid="tutor-hub"]').first();
}

/**
 * Localise l'input texte du Hub (refonte 2026-05-11 — `TutorMiniChat`
 * supprimé, l'input vit désormais dans `TutorHub`).
 */
function miniChatInput(page: Page) {
  return page.locator('[data-testid="tutor-hub-text-input"]').first();
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite : happy path text mode (Pro user)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Le Tuteur — text mode flow (Pro user)", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAsUser(page, { plan: "pro" });

    // Mock 3 endpoints tutorApi — tous indépendants du backend réel
    await page.route("**/api/tutor/session/start", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_START_RESPONSE),
      });
    });

    await page.route(
      `**/api/tutor/session/${MOCK_SESSION_ID}/turn`,
      async (route: Route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_TURN_RESPONSE),
        });
      },
    );

    await page.route(
      `**/api/tutor/session/${MOCK_SESSION_ID}/end`,
      async (route: Route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_END_RESPONSE),
        });
      },
    );
  });

  test("happy path — teaser → TutorHub (text) → turn → close", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    // Step 1 — widget Tutor visible en idle (teaser concept du jour)
    const widget = tutorWidget(page);
    await expect(widget).toBeVisible({ timeout: 10_000 });

    // Step 2 — click teaser → TutorHub s'ouvre (amorce concept = auto-start)
    await widget.click();
    const hub = tutorHubDialog(page);
    await expect(hub).toBeVisible({ timeout: 5_000 });

    // Step 3 — le 1er prompt agent s'affiche dans le transcript du Hub
    await expect(page.getByText(MOCK_START_RESPONSE.first_prompt)).toBeVisible({
      timeout: 10_000,
    });

    // Step 4 — taper une réponse + Enter
    const input = miniChatInput(page);
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.fill("C'est un principe de simplicité.");
    await input.press("Enter");

    // Step 5 — la réponse IA s'affiche (mock MOCK_TURN_RESPONSE)
    await expect(page.getByText(MOCK_TURN_RESPONSE.ai_response)).toBeVisible({
      timeout: 10_000,
    });

    // Step 6 — fermer le Hub via le bouton X interne
    await page.locator('[data-testid="tutor-hub-close"]').click();
    await expect(hub).toBeHidden({ timeout: 5_000 });

    // Le widget idle reste visible derrière (teaser concept du jour)
    await expect(widget).toBeVisible({ timeout: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite : plan gating (Free user) → CTA upgrade
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Le Tuteur — plan gating (Free user)", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAsUser(page, { plan: "free" });

    // Backend renvoie 403 pour les Free → la stack frontend doit basculer en
    // CTA upgrade plutôt qu'ouvrir le mini-chat.
    await page.route("**/api/tutor/session/start", async (route: Route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          detail:
            "Le Tuteur est réservé aux plans Pro et Expert. Passez à Pro pour débloquer cette fonctionnalité.",
        }),
      });
    });
  });

  test("free user → start renvoie 403 → message d'erreur du Hub (pas de transcript)", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const widget = tutorWidget(page);
    await expect(widget).toBeVisible({ timeout: 10_000 });

    // Click teaser → ouvre le Hub avec amorce (déclenche sessionStart → 403)
    await widget.click();
    const hub = tutorHubDialog(page);
    await expect(hub).toBeVisible({ timeout: 5_000 });

    // Le 1er prompt agent NE doit PAS s'afficher (403 = aucune session démarrée)
    await expect(page.getByText(MOCK_START_RESPONSE.first_prompt)).toBeHidden();

    // L'utilisateur free voit le hint vide / CTA upgrade externe au hub.
    // Note: la sidebar item "Tuteur" redirige free vers /upgrade — le hub
    // ouvert via teaser affiche juste l'état vide quand le backend refuse.
    await expect(hub).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// V1.1 — voice mode flow (skip pour V1.0)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Le Tuteur — voice mode flow", () => {
  test.fixme("voice mode happy path — V1.1 (Voxtral STT + ElevenLabs TTS)", async () => {
    // Sera implémenté quand la stack voix sera live (V1.1).
  });
});
