/**
 * Tests — browser-polyfill helpers
 * Fichier source : src/utils/browser-polyfill.ts
 *
 * Couvre :
 * - detectBrowser() : détection du navigateur via userAgent / navigator.brave
 * - hasIdentityAPI() : disponibilité de chrome.identity.launchWebAuthFlow
 * - getRuntimeURL() : délégation à Browser.runtime.getURL
 */

import Browser, {
  detectBrowser,
  hasIdentityAPI,
  getRuntimeURL,
} from "../../src/utils/browser-polyfill";

// Préserver l'état initial pour restauration post-test
const ORIGINAL_USER_AGENT = navigator.userAgent;

function setUserAgent(ua: string): void {
  Object.defineProperty(navigator, "userAgent", {
    value: ua,
    configurable: true,
  });
}

function restoreUserAgent(): void {
  Object.defineProperty(navigator, "userAgent", {
    value: ORIGINAL_USER_AGENT,
    configurable: true,
  });
}

function deleteBrave(): void {
  // navigator.brave est une extension non standard — on la supprime proprement
  delete (navigator as Navigator & { brave?: unknown }).brave;
}

describe("detectBrowser()", () => {
  afterEach(() => {
    restoreUserAgent();
    deleteBrave();
  });

  it("retourne 'chrome' pour un UA Chrome classique", () => {
    setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );
    expect(detectBrowser()).toBe("chrome");
  });

  it("retourne 'firefox' pour un UA Firefox", () => {
    setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    );
    expect(detectBrowser()).toBe("firefox");
  });

  it("retourne 'safari' pour un UA Safari (sans chrome/chromium)", () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    );
    expect(detectBrowser()).toBe("safari");
  });

  it("retourne 'edge' pour un UA Edge (contient 'edg/')", () => {
    setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    );
    expect(detectBrowser()).toBe("edge");
  });

  it("retourne 'opera' pour un UA Opera (contient 'opr/')", () => {
    setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0",
    );
    expect(detectBrowser()).toBe("opera");
  });

  it("retourne 'brave' quand navigator.brave est défini", () => {
    // UA Brave = UA Chrome sans marqueur distinctif ; seule navigator.brave trahit Brave
    setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );
    Object.defineProperty(navigator, "brave", {
      value: { isBrave: () => Promise.resolve(true) },
      configurable: true,
    });
    expect(detectBrowser()).toBe("brave");
  });
});

describe("hasIdentityAPI()", () => {
  // On manipule Browser.identity — on sauve la référence pour la restaurer
  const originalIdentity = (Browser as { identity?: unknown }).identity;

  afterEach(() => {
    (Browser as { identity?: unknown }).identity = originalIdentity;
  });

  it("retourne true quand Browser.identity.launchWebAuthFlow est une fonction", () => {
    // Le mock polyfill-mock.ts expose chrome.identity.launchWebAuthFlow (jest.fn)
    expect(hasIdentityAPI()).toBe(true);
  });

  it("retourne false quand Browser.identity est undefined", () => {
    (Browser as { identity?: unknown }).identity = undefined;
    expect(hasIdentityAPI()).toBe(false);
  });
});

describe("getRuntimeURL()", () => {
  it("délègue à Browser.runtime.getURL et retourne une string contenant le path", () => {
    const url = getRuntimeURL("popup.html");
    expect(typeof url).toBe("string");
    expect(url).toContain("popup.html");
    // Le mock renvoie `chrome-extension://mock-id/${path}`
    expect(url).toBe("chrome-extension://mock-id/popup.html");
  });
});
