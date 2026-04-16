import {
  detectExtensions,
  getCachedExtensions,
  refreshDetection,
  DetectedExtensions,
} from "../coexistence";

function expectNoneDetected(result: DetectedExtensions): void {
  expect(result.darkReader).toBe(false);
  expect(result.adBlocker).toBe(false);
  expect(result.enhancerForYoutube).toBe(false);
  expect(result.sponsorBlock).toBe(false);
  expect(result.returnYoutubeDislike).toBe(false);
}

describe("coexistence — third-party extension detection", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-darkreader-mode");
    document.documentElement.removeAttribute("data-darkreader-scheme");
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    // Clear cache by calling refreshDetection with clean DOM
    refreshDetection();
  });

  describe("detectExtensions() — clean DOM", () => {
    it("returns all false when no extensions are present", () => {
      const result = detectExtensions();
      expectNoneDetected(result);
    });
  });

  describe("Dark Reader detection", () => {
    it("detects data-darkreader-mode attribute", () => {
      document.documentElement.setAttribute("data-darkreader-mode", "dynamic");
      const result = detectExtensions();
      expect(result.darkReader).toBe(true);
    });

    it("detects data-darkreader-scheme attribute", () => {
      document.documentElement.setAttribute("data-darkreader-scheme", "dark");
      const result = detectExtensions();
      expect(result.darkReader).toBe(true);
    });

    it("detects meta[name=darkreader]", () => {
      const meta = document.createElement("meta");
      meta.setAttribute("name", "darkreader");
      meta.setAttribute("content", "true");
      document.head.appendChild(meta);
      const result = detectExtensions();
      expect(result.darkReader).toBe(true);
    });

    it("detects style.darkreader", () => {
      const style = document.createElement("style");
      style.className = "darkreader";
      document.head.appendChild(style);
      const result = detectExtensions();
      expect(result.darkReader).toBe(true);
    });
  });

  describe("Ad Blocker detection", () => {
    it("returns false when #secondary does not exist", () => {
      const result = detectExtensions();
      expect(result.adBlocker).toBe(false);
    });

    it("returns false when #secondary has display:none (not ad blocker)", () => {
      const secondary = document.createElement("div");
      secondary.id = "secondary";
      secondary.style.display = "none";
      document.body.appendChild(secondary);
      const result = detectExtensions();
      expect(result.adBlocker).toBe(false);
    });

    it("detects ad blocker when #secondary offsetParent is null and display is not none", () => {
      const secondary = document.createElement("div");
      secondary.id = "secondary";
      // In jsdom, offsetParent is always null (no layout engine)
      // and getComputedStyle returns "" for display (not "none")
      document.body.appendChild(secondary);

      // We need to mock getComputedStyle to return a non-none display
      const originalGetComputedStyle = window.getComputedStyle;
      jest.spyOn(window, "getComputedStyle").mockImplementation((el) => {
        const style = originalGetComputedStyle(el);
        if (el === secondary) {
          return {
            ...style,
            display: "block",
          } as CSSStyleDeclaration;
        }
        return style;
      });

      const result = detectExtensions();
      expect(result.adBlocker).toBe(true);

      jest.restoreAllMocks();
    });
  });

  describe("Enhancer for YouTube detection", () => {
    it("detects class containing enhancer-for-youtube", () => {
      const el = document.createElement("div");
      el.className = "enhancer-for-youtube-controls";
      document.body.appendChild(el);
      const result = detectExtensions();
      expect(result.enhancerForYoutube).toBe(true);
    });

    it("detects #efyt-not-interest element", () => {
      const el = document.createElement("div");
      el.id = "efyt-not-interest";
      document.body.appendChild(el);
      const result = detectExtensions();
      expect(result.enhancerForYoutube).toBe(true);
    });
  });

  describe("SponsorBlock detection", () => {
    it("detects .sponsorSkipButton", () => {
      const el = document.createElement("button");
      el.className = "sponsorSkipButton";
      document.body.appendChild(el);
      const result = detectExtensions();
      expect(result.sponsorBlock).toBe(true);
    });

    it("detects #sponsorblock-bar", () => {
      const el = document.createElement("div");
      el.id = "sponsorblock-bar";
      document.body.appendChild(el);
      const result = detectExtensions();
      expect(result.sponsorBlock).toBe(true);
    });

    it("detects class containing sponsorBlock", () => {
      const el = document.createElement("div");
      el.className = "sponsorBlockOverlay";
      document.body.appendChild(el);
      const result = detectExtensions();
      expect(result.sponsorBlock).toBe(true);
    });
  });

  describe("Return YouTube Dislike detection", () => {
    it("detects #return-youtube-dislike", () => {
      const el = document.createElement("div");
      el.id = "return-youtube-dislike";
      document.body.appendChild(el);
      const result = detectExtensions();
      expect(result.returnYoutubeDislike).toBe(true);
    });

    it("detects class containing ryd-", () => {
      const el = document.createElement("span");
      el.className = "ryd-tooltip";
      document.body.appendChild(el);
      const result = detectExtensions();
      expect(result.returnYoutubeDislike).toBe(true);
    });
  });

  describe("getCachedExtensions()", () => {
    it("returns cached result on second call", () => {
      const first = detectExtensions();
      // Modify DOM after detection
      document.documentElement.setAttribute("data-darkreader-mode", "dynamic");
      const second = getCachedExtensions();
      // Should still be false because cache was set before DOM change
      expect(second.darkReader).toBe(false);
      expect(second).toBe(first);
    });

    it("runs detection if no cache exists", () => {
      document.documentElement.setAttribute("data-darkreader-mode", "dynamic");
      // refreshDetection was called in beforeEach with clean DOM,
      // but we modified DOM after — call refreshDetection to clear, then getCached
      refreshDetection(); // this will detect darkReader now
      const result = getCachedExtensions();
      expect(result.darkReader).toBe(true);
    });
  });

  describe("refreshDetection()", () => {
    it("clears cache and re-detects", () => {
      detectExtensions();
      // Now add Dark Reader to DOM
      document.documentElement.setAttribute("data-darkreader-mode", "dynamic");
      const refreshed = refreshDetection();
      expect(refreshed.darkReader).toBe(true);
    });
  });
});
