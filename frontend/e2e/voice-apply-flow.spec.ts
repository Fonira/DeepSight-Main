/**
 * 🧪 E2E — Voice prefs apply flow
 * Covers the happy path: stage two changes (voice + concise preset),
 * confirm the toolbar shows them, click Apply, confirm a single batched
 * PUT /api/voice/preferences with the correct body.
 */

import { test, expect } from "@playwright/test";

const PREFS_FIXTURE = {
  voice_id: "v1",
  voice_name: "Sophie",
  speed: 1.0,
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.3,
  use_speaker_boost: true,
  tts_model: "eleven_multilingual_v2",
  voice_chat_model: "eleven_flash_v2_5",
  language: "fr",
  gender: "female",
  input_mode: "ptt",
  ptt_key: " ",
  interruptions_enabled: true,
  turn_eagerness: 0.5,
  voice_chat_speed_preset: "1x",
  turn_timeout: 15,
  soft_timeout_seconds: 300,
};

const CATALOG_FIXTURE = {
  voices: [
    {
      voice_id: "v1",
      name: "Sophie",
      description_fr: "",
      description_en: "",
      gender: "female",
      accent: "fr",
      language: "fr",
      use_case: "tutor",
      recommended: true,
      preview_url: "https://example.com/v1.mp3",
    },
    {
      voice_id: "v2",
      name: "Mathieu",
      description_fr: "",
      description_en: "",
      gender: "male",
      accent: "fr",
      language: "fr",
      use_case: "tutor",
      recommended: false,
      preview_url: "https://example.com/v2.mp3",
    },
  ],
  speed_presets: [
    { id: "1.0", label_fr: "1x", label_en: "1x", value: 1, icon: "" },
  ],
  voice_chat_speed_presets: [
    {
      id: "1x",
      label_fr: "Normal",
      label_en: "Normal",
      api_speed: 1,
      playback_rate: 1,
      concise: false,
    },
    {
      id: "3x",
      label_fr: "Rapide concis",
      label_en: "Concise",
      api_speed: 1,
      playback_rate: 1,
      concise: true,
    },
  ],
  models: [
    {
      id: "eleven_flash_v2_5",
      name: "Flash",
      description_fr: "",
      description_en: "",
      latency: "lowest",
      recommended_for: "voice_chat",
    },
    {
      id: "eleven_multilingual_v2",
      name: "Multilingual",
      description_fr: "",
      description_en: "",
      latency: "low",
      recommended_for: "tts",
    },
  ],
};

const MOCK_USER = {
  id: 1,
  username: "testuser",
  email: "test@test.com",
  plan: "expert",
  credits: 150,
  credits_monthly: 150,
  is_admin: false,
  total_videos: 0,
  total_words: 0,
  total_playlists: 0,
  email_verified: true,
  created_at: "2024-01-01T00:00:00Z",
};

test.describe("Voice prefs apply flow", () => {
  test("staging voice + concise preset triggers a single batched updatePreferences", async ({
    page,
  }) => {
    // ── Auth mocks ───────────────────────────────────────────────────────
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_USER),
      }),
    );
    // /auth/refresh fires whenever any other endpoint 401s. If it 401s too,
    // the app clears tokens and bounces to /login. Keep it green.
    await page.route("**/api/auth/refresh", (route) => {
      const futureExp = Math.floor((Date.now() + 24 * 3600 * 1000) / 1000);
      const b64url = (obj: object) =>
        Buffer.from(JSON.stringify(obj))
          .toString("base64")
          .replace(/=/g, "")
          .replace(/\+/g, "-")
          .replace(/\//g, "_");
      const fakeJwt = `header.${b64url({ exp: futureExp, sub: "1" })}.sig`;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: fakeJwt,
          refresh_token: fakeJwt,
        }),
      });
    });

    // ── Catalog ──────────────────────────────────────────────────────────
    await page.route("**/api/voice/catalog", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(CATALOG_FIXTURE),
      }),
    );

    // ── Prefs (GET + PUT) ────────────────────────────────────────────────
    let putBody: Record<string, unknown> | null = null;
    let putCount = 0;
    await page.route("**/api/voice/preferences", async (route) => {
      const method = route.request().method();
      if (method === "PUT" || method === "POST" || method === "PATCH") {
        putCount += 1;
        putBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ...PREFS_FIXTURE, ...putBody }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(PREFS_FIXTURE),
        });
      }
    });

    // ── Seed tokens BEFORE the first navigation so AuthContext sees them ─
    // useAuth parses the JWT to check `exp` — we must produce a parseable
    // JWT or it will be marked expired and clearTokens() will run.
    await page.addInitScript(() => {
      const futureExp = Math.floor((Date.now() + 24 * 3600 * 1000) / 1000);
      const b64url = (obj: object) =>
        btoa(JSON.stringify(obj))
          .replace(/=/g, "")
          .replace(/\+/g, "-")
          .replace(/\//g, "_");
      const fakeJwt = `header.${b64url({ exp: futureExp, sub: "1" })}.sig`;
      localStorage.setItem("access_token", fakeJwt);
      localStorage.setItem("refresh_token", fakeJwt);
      // useAuth wraps cached_user in { user, timestamp }
      localStorage.setItem(
        "cached_user",
        JSON.stringify({
          user: {
            id: 1,
            email: "test@test.com",
            username: "testuser",
            plan: "expert",
            credits: 150,
            credits_monthly: 150,
            is_admin: false,
            total_videos: 0,
            total_words: 0,
            total_playlists: 0,
            email_verified: true,
            created_at: "2024-01-01T00:00:00Z",
          },
          timestamp: Date.now(),
        }),
      );
    });

    // ── Navigate to settings ─────────────────────────────────────────────
    await page.goto("/settings");
    // Don't waitForLoadState("networkidle") — boot-time API calls keep
    // firing intermittently. Just wait for the voice settings header to
    // be present, which proves Settings rendered.
    await page
      .getByRole("heading", { name: "🎙️ Paramètres vocaux" })
      .waitFor({ state: "visible", timeout: 15000 });

    // ── Open "Sélection de voix" and pick Mathieu ────────────────────────
    // (voiceSelection is closed by default; chatSpeed is open by default —
    // do NOT toggle it again, that would close it.)
    await page
      .getByRole("button", { name: "Sélection de voix" })
      .click();
    await page.getByText("Mathieu", { exact: true }).click();

    // ── Pick the concise speed preset (3x + Rapide concis) ──────────────
    // The concise preset button shows preset.id ("3x") + label_fr ("Rapide
    // concis") + a "Concis" badge — filter on both for an unambiguous match.
    await page
      .getByRole("button")
      .filter({ hasText: "3x" })
      .filter({ hasText: "Rapide concis" })
      .click();

    // ── Toolbar: 3 staged keys (voice_id + voice_name + speed_preset) ───
    const bar = page.getByTestId("staged-prefs-toolbar");
    await expect(bar).toBeVisible();
    await expect(page.getByTestId("staged-count")).toContainText("3");

    // ── Apply ────────────────────────────────────────────────────────────
    await page.getByTestId("staged-apply").click();
    await expect(bar).toBeHidden();

    // ── Single batched PUT with both diffs ───────────────────────────────
    expect(putCount).toBe(1);
    expect(putBody).toEqual({
      voice_id: "v2",
      voice_name: "Mathieu",
      voice_chat_speed_preset: "3x",
    });
  });
});
