// extension/__tests__/sidepanel/styles/voice-css.test.ts
//
// Vérifie que la CSS du sidepanel définit bien toutes les classes
// utilisées par les composants Voice (Quick Voice Call).
//
// Sans ces classes, ConnectingView/CallActiveView/ContextProgressBar/
// UpgradeCTA s'affichent en HTML brut (boutons gris empilés, pas de
// barre de progression, pas de gradient violet/rose). Cf. finding [B3].

import * as fs from "fs";
import * as path from "path";

const cssPath = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "src",
  "sidepanel",
  "styles",
  "sidepanel.css",
);

function loadCss(): string {
  return fs.readFileSync(cssPath, "utf8");
}

describe("sidepanel.css — Quick Voice Call (B3)", () => {
  let css: string;

  beforeAll(() => {
    css = loadCss();
  });

  describe("ConnectingView", () => {
    it("defines .ds-connecting wrapper", () => {
      expect(css).toMatch(/\.ds-connecting\s*\{/);
    });

    it("defines .ds-connecting__mic", () => {
      expect(css).toMatch(/\.ds-connecting__mic/);
    });

    it("defines .ds-connecting__bar (progress indeterminate)", () => {
      expect(css).toMatch(/\.ds-connecting__bar/);
    });
  });

  describe("CallActiveView", () => {
    it("defines .ds-call-active wrapper", () => {
      expect(css).toMatch(/\.ds-call-active\s*\{/);
    });

    it("defines .ds-call-active__header", () => {
      expect(css).toMatch(/\.ds-call-active__header/);
    });

    it("defines .ds-call-active__indicator (live dot)", () => {
      expect(css).toMatch(/\.ds-call-active__indicator/);
    });

    it("defines .ds-call-active__elapsed", () => {
      expect(css).toMatch(/\.ds-call-active__elapsed/);
    });

    it("defines .ds-call-active__waveform", () => {
      expect(css).toMatch(/\.ds-call-active__waveform/);
    });

    it("defines .ds-call-active__footer", () => {
      expect(css).toMatch(/\.ds-call-active__footer/);
    });

    it("defines .ds-call-active__mute", () => {
      expect(css).toMatch(/\.ds-call-active__mute/);
    });

    it("defines .ds-call-active__hangup", () => {
      expect(css).toMatch(/\.ds-call-active__hangup/);
    });

    it("defines .ds-hangup (shared hangup button style)", () => {
      expect(css).toMatch(/\.ds-hangup\s*[,{]/);
    });
  });

  describe("ContextProgressBar", () => {
    it("defines .ds-ctx-bar wrapper", () => {
      expect(css).toMatch(/\.ds-ctx-bar\s*\{/);
    });

    it("defines .ds-ctx-bar__label", () => {
      expect(css).toMatch(/\.ds-ctx-bar__label/);
    });

    it("defines .ds-ctx-bar__dot", () => {
      expect(css).toMatch(/\.ds-ctx-bar__dot/);
    });

    it("defines .ds-ctx-bar__track and __fill", () => {
      expect(css).toMatch(/\.ds-ctx-bar__track/);
      expect(css).toMatch(/\.ds-ctx-bar__fill/);
    });
  });

  describe("UpgradeCTA", () => {
    it("defines .ds-upgrade-cta wrapper", () => {
      expect(css).toMatch(/\.ds-upgrade-cta\s*\{/);
    });

    it("defines .ds-upgrade-cta__plan card", () => {
      expect(css).toMatch(/\.ds-upgrade-cta__plan/);
    });

    it("defines .ds-upgrade-cta__primary button", () => {
      expect(css).toMatch(/\.ds-upgrade-cta__primary/);
    });

    it("defines .ds-upgrade-cta__dismiss link", () => {
      expect(css).toMatch(/\.ds-upgrade-cta__dismiss/);
    });
  });

  describe("VoiceView fallbacks", () => {
    it("defines .ds-error wrapper", () => {
      expect(css).toMatch(/\.ds-error\s*\{/);
    });

    it("defines .ds-call-ended wrapper", () => {
      expect(css).toMatch(/\.ds-call-ended\s*\{/);
    });
  });
});
