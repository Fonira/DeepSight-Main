/** @jest-environment jsdom */
//
// Tests — START_GUEST_ANALYSIS (mode découverte, background.ts).
//
// Le mode invité appelait POST /videos/analyze, qui exige un compte : il
// échouait toujours. Il utilise maintenant /videos/analyze/guest (3 analyses
// par IP et par 24 h, vidéos < 5 min, aucun stockage).

import { handleMessage, resetRateLimitsForTests } from "../../src/background";
import { resetChromeMocks } from "../setup/chrome-api-mock";

const mockFetch = jest.fn();
const guestMessage = (url: string): Parameters<typeof handleMessage>[0] =>
  ({ action: "START_GUEST_ANALYSIS", data: { url } }) as unknown as Parameters<
    typeof handleMessage
  >[0];

describe("START_GUEST_ANALYSIS", () => {
  const origFetch = global.fetch;

  beforeEach(() => {
    resetChromeMocks();
    resetRateLimitsForTests();
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof global.fetch;
  });

  afterAll(() => {
    global.fetch = origFetch;
  });

  it("posts the canonical URL to the guest endpoint without credentials", async () => {
    const guestResult = {
      video_title: "Vidéo courte",
      video_channel: "Chaîne",
      video_duration: 180,
      thumbnail_url: "",
      summary_content: "## Résumé",
      category: "education",
      word_count: 400,
      mode: "accessible",
      lang: "fr",
      remaining_analyses: 2,
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(guestResult),
    });

    const res = (await handleMessage(
      guestMessage("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s"),
    )) as { success: boolean; result: unknown };

    expect(res).toEqual({ success: true, result: guestResult });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/videos\/analyze\/guest$/);
    expect(JSON.parse(init.body as string)).toEqual({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
  });

  it("reports the exhausted 24 h guest quota as guest_quota_exhausted", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: { get: () => null },
      json: () =>
        Promise.resolve({
          detail:
            "Vous avez utilisé vos 3 analyses gratuites. Créez un compte pour continuer !",
        }),
    });

    const res = (await handleMessage(
      guestMessage("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    )) as { success: boolean; errorCode: string; error: string };

    expect(res).toMatchObject({
      success: false,
      errorCode: "guest_quota_exhausted",
    });
    expect(res.error).toContain("3 analyses gratuites");
  });

  it("surfaces private mode (403) with its code", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () =>
        Promise.resolve({
          detail: { code: "private_mode", message: "Accès privé." },
        }),
    });

    const res = (await handleMessage(
      guestMessage("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    )) as { errorCode: string; error: string };

    expect(res).toMatchObject({ errorCode: "private_mode", error: "Accès privé." });
  });
});
