/** @jest-environment jsdom */
//
// Tests — disponibilité de la connexion Google (background.ts).
//
// Le serveur relancé n'a pas GOOGLE_CLIENT_ID : /auth/google/token renvoie
// 401 « Invalid Google ID token » APRÈS que l'utilisateur a choisi son
// compte dans la popup. On vérifie maintenant /auth/google/login avant
// d'ouvrir la popup, et l'écran de connexion masque le bouton.

import { handleMessage, resetRateLimitsForTests } from "../../src/background";
import { resetChromeMocks } from "../setup/chrome-api-mock";

const mockFetch = jest.fn();

function response(status: number, body: unknown = {}): unknown {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

describe("Google sign-in availability", () => {
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

  it("GOOGLE_LOGIN fails cleanly without opening the popup when the server has no Google OAuth", async () => {
    mockFetch.mockResolvedValueOnce(
      response(400, { detail: "Google OAuth non activé" }),
    );

    const res = (await handleMessage({ action: "GOOGLE_LOGIN" })) as {
      success: boolean;
      errorCode: string;
    };

    expect(res).toMatchObject({
      success: false,
      errorCode: "google_oauth_unavailable",
    });
    expect(mockFetch.mock.calls[0][0]).toContain("/auth/google/login");
    expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
  });

  it("GOOGLE_LOGIN opens the popup when the server supports Google", async () => {
    mockFetch.mockResolvedValueOnce(
      response(200, { auth_url: "https://accounts.google.com/..." }),
    );

    await handleMessage({ action: "GOOGLE_LOGIN" });

    expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledTimes(1);
  });

  it.each([
    [200, true],
    [400, false],
    [500, false],
    [503, null],
    [429, null],
  ])("GET_AUTH_PROVIDERS maps HTTP %s to google=%s", async (status, google) => {
    mockFetch.mockResolvedValueOnce(response(status));
    const res = (await handleMessage({ action: "GET_AUTH_PROVIDERS" })) as {
      success: boolean;
      result: { google: boolean | null };
    };
    expect(res).toEqual({ success: true, result: { google } });
  });

  it("GET_AUTH_PROVIDERS reports unknown on network errors", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const res = (await handleMessage({ action: "GET_AUTH_PROVIDERS" })) as {
      result: { google: boolean | null };
    };
    expect(res.result.google).toBeNull();
  });
});
