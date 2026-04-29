/**
 * E2E — Voice ↔ Chat memory symbiosis (Spec #5 / Tasks 1-10)
 *
 * Couvre 3 scénarios end-to-end de l'expérience "merge voice ↔ chat" :
 *   1. voice → chat   : un message texte envoyé après un appel vocal
 *      doit pouvoir être répondu en référençant ce qui s'est dit en voix
 *      (digest de fin de session piped dans le contexte Mistral chat).
 *   2. voice → voice  : un 2e appel rappelle le sujet du 1er appel
 *      (même mécanisme de digest, côté agent ElevenLabs).
 *   3. clear unified  : la corbeille du ChatPanel efface chat texte
 *      ET transcripts vocaux ET digests dans une seule action.
 *
 * ⚠️ Pré-requis runtime :
 *   - E2E_USER_EMAIL / E2E_USER_PASSWORD : compte test seedé (idéalement plan Pro/Expert).
 *   - E2E_VIDEO_ID : id (UUID Summary) d'une analyse vidéo possédée par ce user.
 *   - Backend DeepSight joignable (ElevenLabs voice + Mistral chat fonctionnels).
 *   - Migration Spec #1 (B1) `chat_messages.source` appliquée.
 *
 * Tant qu'une de ces dépendances manque (cas typique en local sans seed),
 * les 3 tests sont `test.fixme()` afin de NE PAS faire échouer la CI.
 *
 * Les sélecteurs sont alignés sur l'UI réelle :
 *   - VoiceCallButton : data-testid="chat-page-voice-toggle" (variant header /chat)
 *   - VoiceOverlay    : data-testid="voice-overlay" + "voice-overlay-end"
 *   - Chat messages   : data-testid="chat-msg-text" (text) / "chat-msg-voice" (voice)
 *   - Trash dashboard : button[title="Effacer l'historique"] dans ChatPanel (DashboardPage)
 *
 * Quand la prod-data sera seedée, retirer `test.fixme()` test par test.
 *
 * Réf : merge-voice-chat-context-implementation.md — Task 11.
 */
import { test, expect } from "@playwright/test";

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL;
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD;
const E2E_VIDEO_ID = process.env.E2E_VIDEO_ID;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — login + open chat for a given summary
// ─────────────────────────────────────────────────────────────────────────────

async function loginAsTestUser(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page
    .locator(
      'input[type="email"], input[name="email"], input[placeholder*="mail" i]',
    )
    .fill(E2E_USER_EMAIL!);
  await page.locator('input[type="password"]').fill(E2E_USER_PASSWORD!);
  await page
    .locator(
      'button[type="submit"], button:has-text("Connexion"), button:has-text("Se connecter"), button:has-text("Log in")',
    )
    .first()
    .click();
  await page.waitForURL(/\/(dashboard|app|$)/, { timeout: 10_000 });
}

async function openChatForSummary(
  page: import("@playwright/test").Page,
  summaryId: string,
) {
  await page.goto(`/chat?summary=${summaryId}`);
  // Wait for chat header (voice toggle button is rendered when voiceEnabled=true,
  // textarea is present once a summary is loaded).
  await page.waitForSelector("textarea", { timeout: 15_000 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Voice ↔ Chat memory symbiosis", () => {
  test.beforeEach(() => {
    if (!E2E_USER_EMAIL || !E2E_USER_PASSWORD || !E2E_VIDEO_ID) {
      test.skip(
        true,
        "Missing E2E_USER_EMAIL / E2E_USER_PASSWORD / E2E_VIDEO_ID env vars — skipping voice-chat-symbiosis suite.",
      );
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Scenario 1 — voice → chat memory
  //
  // 1) login + open /chat?summary=ID
  // 2) start voice call (click chat-page-voice-toggle)
  // 3) inject 2-3 transcripts via POST /api/voice/transcripts/append
  //    (mocking real ElevenLabs is out of scope for this E2E ; we feed
  //    transcripts directly to simulate a finished call)
  // 4) hang up the call (voice-overlay-end)
  // 5) wait ~3.5s for the end-of-session digest (Mistral)
  // 6) send a chat message that references the topic
  // 7) assert the assistant response cites it
  // ───────────────────────────────────────────────────────────────────────────
  test("voice → chat: text chat references something said in voice", async ({
    page,
  }) => {
    test.fixme(
      true,
      "Requires (a) seeded user/summary, (b) wired POST /api/voice/transcripts/append in the test env, " +
        "(c) deterministic Mistral digest within 3.5s — none of which are guaranteed in CI today.",
    );

    await loginAsTestUser(page);
    await openChatForSummary(page, E2E_VIDEO_ID!);

    // 1. Click voice call button — testId on /chat is "chat-page-voice-toggle"
    await page.click('[data-testid="chat-page-voice-toggle"]');
    await page.waitForSelector('[data-testid="voice-overlay"]', {
      timeout: 5_000,
    });

    // 2. Simulate voice transcripts via direct API POST.
    //    En l'absence d'un vrai pipeline ElevenLabs en E2E, on insère les
    //    transcripts via le backend pour reproduire l'état post-call.
    //    Voir frontend/src/services/api.ts → voiceApi.appendTranscript().
    //    Implementation note: POST nécessite l'access_token JWT du user
    //    (à récupérer depuis localStorage), un voice_session_id valide
    //    (créé par le backend au /api/voice/session), et il faut que
    //    Spec #1 B1 (col `source`) soit appliquée.
    // TODO when env is wired:
    //   const token = await page.evaluate(() => localStorage.getItem("access_token"));
    //   await page.request.post("/api/voice/transcripts/append", {
    //     headers: { Authorization: `Bearer ${token}` },
    //     data: { voice_session_id: "<from-overlay>", speaker: "user",
    //             content: "Parle-moi du satellite Janus", time_in_call_secs: 4 },
    //   });
    //   ...

    // 3. Hang up the call
    await page.click('[data-testid="voice-overlay-end"]');
    await page.waitForSelector('[data-testid="voice-overlay"]', {
      state: "detached",
      timeout: 5_000,
    });

    // 4. Wait for end-of-session digest to land (~3.5s for Mistral medium)
    await page.waitForTimeout(3500);

    // 5. Send a chat message that references the voice topic.
    //    On /chat, l'input est un <textarea> et le bouton est dans un <form>.
    await page
      .locator("textarea")
      .first()
      .fill("Tu as dit quoi sur Janus tout à l'heure ?");
    await page.keyboard.press("Enter");

    // 6. Assert response references "Janus" or related concept.
    const lastAssistant = page.locator('[data-testid="chat-msg-text"]').last();
    await expect(lastAssistant).toBeVisible({ timeout: 30_000 });
    const text = (await lastAssistant.innerText()).toLowerCase();
    expect(text).toMatch(/janus|satellite|gravit/);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Scenario 2 — voice → voice recall
  //
  // Identique au scénario 1 mais le 2e tour est un appel vocal
  // qui doit s'ouvrir avec un message agent rappelant le sujet du 1er appel.
  // (Skeleton minimal — la vérification finale se fait sur le transcript voix
  // injecté côté agent, ce qui requiert un setup plus lourd.)
  // ───────────────────────────────────────────────────────────────────────────
  test("voice → voice recall: second call references first call topic", async ({
    page,
  }) => {
    test.fixme(
      true,
      "Same prerequisites as scenario 1 + ability to assert against ElevenLabs " +
        "agent first-message (currently delivered via the agent's own TTS, " +
        "non triviallement observable depuis Playwright).",
    );

    await loginAsTestUser(page);
    await openChatForSummary(page, E2E_VIDEO_ID!);

    // 1. First call — open + inject transcript + hang up
    await page.click('[data-testid="chat-page-voice-toggle"]');
    await page.waitForSelector('[data-testid="voice-overlay"]', {
      timeout: 5_000,
    });
    // (POST /api/voice/transcripts/append — see scenario 1)
    await page.click('[data-testid="voice-overlay-end"]');
    await page.waitForSelector('[data-testid="voice-overlay"]', {
      state: "detached",
      timeout: 5_000,
    });

    // 2. Wait for digest
    await page.waitForTimeout(3500);

    // 3. Second call — should be primed with the first call's digest
    await page.click('[data-testid="chat-page-voice-toggle"]');
    await page.waitForSelector('[data-testid="voice-overlay"]', {
      timeout: 5_000,
    });

    // 4. Assert : la première transcription agent contient un rappel.
    //    En l'état, l'agent ElevenLabs joue son audio TTS — il faut soit lire
    //    le transcript live (data-testid="voice-overlay-transcript") après
    //    quelques secondes, soit attendre que le message soit persisté en DB
    //    via /api/voice/transcripts/append → chat_messages source='voice'.
    const liveTranscript = page.locator(
      '[data-testid="voice-overlay-transcript"]',
    );
    await expect(liveTranscript).toBeVisible({ timeout: 10_000 });
    // Placeholder assertion — à raffiner quand le digest agent sera observable.
    const transcriptText = (await liveTranscript.innerText()).toLowerCase();
    expect(transcriptText.length).toBeGreaterThan(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Scenario 3 — clear unified (text + voice + digests)
  //
  // Plus self-contained : login + dashboard + ouverture du ChatPanel +
  // click "Effacer" + accept window.confirm + assert empty state.
  //
  // ⚠️ Le bouton trash unifié (Trash2 + window.confirm parlant de
  // "transcripts d'appels vocaux") est hébergé dans ChatPanel sur DashboardPage,
  // pas dans /chat. On teste donc sur /dashboard.
  // ───────────────────────────────────────────────────────────────────────────
  test("clear unified: deletes text + voice + digests", async ({ page }) => {
    test.fixme(
      true,
      "Requires seeded chat history (text + voice transcripts) on E2E_VIDEO_ID. " +
        "Without seed data, ChatPanel n'affiche pas le bouton Effacer (gate `messages.length > 0`).",
    );

    await loginAsTestUser(page);
    // Le ChatPanel est ouvert depuis Dashboard une fois qu'un summary est sélectionné.
    // En attendant la mise en place du seed, on suppose que l'app navigue
    // automatiquement vers la dernière analyse de l'user, ou on force via URL.
    await page.goto(`/dashboard?summary=${E2E_VIDEO_ID!}`);

    // Ouvrir le chat panel s'il ne l'est pas déjà (bouton Chat dans la page).
    // On accepte plusieurs sélecteurs car le wording peut varier FR/EN.
    const openChatBtn = page
      .locator('button:has-text("Chat"), button[aria-label*="chat" i]')
      .first();
    if (await openChatBtn.isVisible().catch(() => false)) {
      await openChatBtn.click();
    }

    // Set up window.confirm handler — assert le message FR mentionne "vocaux"
    // (texte exact dans frontend/src/i18n/fr.json : confirmBody) ou "voice" en EN.
    page.once("dialog", async (dialog) => {
      const message = dialog.message();
      expect(message).toMatch(/vocaux|voice call transcripts|d'appels vocaux/i);
      await dialog.accept();
    });

    // Le bouton "Effacer" du ChatPanel n'a pas de data-testid — on cible par
    // texte (FR "Effacer" / EN "Clear", classe text-text-tertiary).
    // Le bouton Trash2 du FloatingChatWindow utilise title="Effacer l'historique".
    await page
      .locator(
        'button:has-text("Effacer"), button[title="Effacer l\'historique"], button[title="Clear history"]',
      )
      .first()
      .click();

    // Verify : aucun message visible avec data-testid chat-msg-* (text OU voice).
    await expect(page.locator('[data-testid^="chat-msg-"]')).toHaveCount(0, {
      timeout: 5_000,
    });
  });
});
