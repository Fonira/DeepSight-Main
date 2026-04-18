/**
 * Tests — OAuth auth adapter (cross-browser)
 * Fichier source : src/utils/auth-adapter.ts
 *
 * Couvre :
 *  - extractTokenFromUrl (parsing des redirects OAuth)
 *  - launchOAuthFlow branchement TARGET_BROWSER (chrome vs safari)
 *
 * Note : `__TARGET_BROWSER__` est lu à import-time (const top-level).
 * On utilise donc `jest.resetModules()` + re-require pour changer de cible.
 */

import { resetChromeMocks } from "../setup/chrome-api-mock";

// Types utilitaires pour l'accès au module sous test et au global patché.
type AuthAdapterModule = typeof import("../../src/utils/auth-adapter");
type BrowserPolyfillMock = typeof import("../../src/utils/browser-polyfill");

interface TargetBrowserGlobal {
  __TARGET_BROWSER__: string;
}

function setTargetBrowser(target: string): void {
  (globalThis as unknown as TargetBrowserGlobal).__TARGET_BROWSER__ = target;
}

// ─────────────────────────────────────────────────────────────────────
// extractTokenFromUrl
// ─────────────────────────────────────────────────────────────────────
describe("extractTokenFromUrl", () => {
  let extractTokenFromUrl: AuthAdapterModule["extractTokenFromUrl"];

  beforeEach(() => {
    resetChromeMocks();
    setTargetBrowser("chrome");
    jest.resetModules();
    extractTokenFromUrl = (
      require("../../src/utils/auth-adapter") as AuthAdapterModule
    ).extractTokenFromUrl;
  });

  it("extracts access_token from a valid redirect URL hash", () => {
    const url =
      "https://extension.chromiumapp.org/#access_token=abc123&token_type=bearer&expires_in=3600";
    expect(extractTokenFromUrl(url)).toBe("abc123");
  });

  it("returns null when hash has no access_token param", () => {
    const url =
      "https://extension.chromiumapp.org/#state=xyz&token_type=bearer";
    expect(extractTokenFromUrl(url)).toBeNull();
  });

  it("returns null for a malformed URL", () => {
    expect(extractTokenFromUrl("not-a-valid-url")).toBeNull();
  });

  it("returns null when URL has a query string but no hash", () => {
    const url =
      "https://extension.chromiumapp.org/callback?access_token=shouldNotBeRead&token_type=bearer";
    expect(extractTokenFromUrl(url)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
// launchOAuthFlow — Chrome path (identity API)
// ─────────────────────────────────────────────────────────────────────
describe("launchOAuthFlow — Chrome path", () => {
  let launchOAuthFlow: AuthAdapterModule["launchOAuthFlow"];
  let browserPolyfill: BrowserPolyfillMock;

  beforeEach(() => {
    resetChromeMocks();
    setTargetBrowser("chrome");
    jest.resetModules();
    launchOAuthFlow = (
      require("../../src/utils/auth-adapter") as AuthAdapterModule
    ).launchOAuthFlow;
    browserPolyfill =
      require("../../src/utils/browser-polyfill") as BrowserPolyfillMock;
  });

  it("calls Browser.identity.launchWebAuthFlow and resolves with the redirect URL", async () => {
    const expectedUrl =
      "https://mock-extension-id.chromiumapp.org/#access_token=xyz&token_type=bearer";
    const launchWebAuthFlow = browserPolyfill.default.identity!
      .launchWebAuthFlow as jest.Mock;
    launchWebAuthFlow.mockResolvedValueOnce(expectedUrl);

    const result = await launchOAuthFlow(true);

    expect(result).toBe(expectedUrl);
    expect(launchWebAuthFlow).toHaveBeenCalledTimes(1);
    const callArg = launchWebAuthFlow.mock.calls[0][0] as {
      url: string;
      interactive: boolean;
    };
    expect(typeof callArg.url).toBe("string");
    expect(callArg.url).toContain("accounts.google.com");
    expect(callArg.interactive).toBe(true);
  });

  it("rejects with 'No redirect URL received' when launchWebAuthFlow returns empty", async () => {
    const launchWebAuthFlow = browserPolyfill.default.identity!
      .launchWebAuthFlow as jest.Mock;
    launchWebAuthFlow.mockResolvedValueOnce("");

    await expect(launchOAuthFlow(true)).rejects.toThrow(
      "No redirect URL received",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
// launchOAuthFlow — Safari path (popup + polling)
// ─────────────────────────────────────────────────────────────────────
describe("launchOAuthFlow — Safari path", () => {
  let launchOAuthFlow: AuthAdapterModule["launchOAuthFlow"];
  let windowOpenSpy: jest.SpyInstance;

  beforeEach(() => {
    resetChromeMocks();
    setTargetBrowser("safari");
    // Désamorce setInterval / setTimeout du polling pour éviter les timeouts.
    jest.useFakeTimers();
    jest.resetModules();
    launchOAuthFlow = (
      require("../../src/utils/auth-adapter") as AuthAdapterModule
    ).launchOAuthFlow;
  });

  afterEach(() => {
    if (windowOpenSpy) {
      windowOpenSpy.mockRestore();
    }
    jest.useRealTimers();
    setTargetBrowser("chrome");
  });

  it("takes the popup path and calls window.open when TARGET_BROWSER is 'safari'", () => {
    const mockPopup = {
      closed: false,
      location: { href: "" },
      close: jest.fn(),
    };
    windowOpenSpy = jest
      .spyOn(window, "open")
      .mockReturnValue(mockPopup as unknown as Window);

    // On n'attend pas la promesse (elle reste pending — polling désamorcé).
    // On utilise `.catch(() => {})` pour éviter un UnhandledPromiseRejection
    // si jsdom nettoie les timers en fin de test.
    const pending = launchOAuthFlow(true);
    pending.catch(() => {
      /* swallow — promesse volontairement abandonnée */
    });

    expect(windowOpenSpy).toHaveBeenCalledTimes(1);
    const [urlArg, nameArg, featuresArg] = windowOpenSpy.mock.calls[0];
    expect(typeof urlArg).toBe("string");
    expect(urlArg).toContain("accounts.google.com");
    expect(nameArg).toBe("DeepSight_OAuth");
    expect(typeof featuresArg).toBe("string");
  });

  it("rejects with 'Popup blocked' when window.open returns null", async () => {
    windowOpenSpy = jest.spyOn(window, "open").mockReturnValue(null);

    await expect(launchOAuthFlow(true)).rejects.toThrow(/Popup blocked/);
  });
});
