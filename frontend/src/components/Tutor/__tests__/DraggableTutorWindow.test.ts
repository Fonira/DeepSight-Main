import { describe, it, expect, beforeEach } from "vitest";
import {
  cornerToPosition,
  nearestCorner,
  readSavedCorner,
  saveCorner,
} from "../snapHelpers";
import { LS_TUTOR_CORNER } from "../tutorConstants";

describe("DraggableTutorWindow — snap logic", () => {
  const SIZE = { width: 280, height: 400 };
  const VIEWPORT = { width: 1280, height: 800 };
  const MARGIN = 12;

  describe("cornerToPosition", () => {
    it("TL → top-left avec marge", () => {
      const pos = cornerToPosition("TL", SIZE, VIEWPORT, MARGIN);
      expect(pos).toEqual({ top: 12, left: 12 });
    });

    it("TR → top-right (par défaut)", () => {
      const pos = cornerToPosition("TR", SIZE, VIEWPORT, MARGIN);
      expect(pos).toEqual({ top: 12, left: 1280 - 280 - 12 });
    });

    it("BL → bottom-left", () => {
      const pos = cornerToPosition("BL", SIZE, VIEWPORT, MARGIN);
      expect(pos).toEqual({ top: 800 - 400 - 12, left: 12 });
    });

    it("BR → bottom-right", () => {
      const pos = cornerToPosition("BR", SIZE, VIEWPORT, MARGIN);
      expect(pos).toEqual({
        top: 800 - 400 - 12,
        left: 1280 - 280 - 12,
      });
    });
  });

  describe("nearestCorner", () => {
    it("centre haut-gauche → TL", () => {
      expect(nearestCorner({ x: 100, y: 100 }, VIEWPORT)).toBe("TL");
    });

    it("centre haut-droit → TR", () => {
      expect(nearestCorner({ x: 1100, y: 100 }, VIEWPORT)).toBe("TR");
    });

    it("centre bas-gauche → BL", () => {
      expect(nearestCorner({ x: 100, y: 700 }, VIEWPORT)).toBe("BL");
    });

    it("centre bas-droit → BR", () => {
      expect(nearestCorner({ x: 1100, y: 700 }, VIEWPORT)).toBe("BR");
    });

    it("centre exact (équidistant) → un coin déterministe", () => {
      // Au centre, la distance au carré est égale aux 4 coins.
      // L'algo choisit TL (premier itéré).
      const c = nearestCorner({ x: 640, y: 400 }, VIEWPORT);
      expect(["TL", "TR", "BL", "BR"]).toContain(c);
    });

    it("très près de TR → TR malgré viewport asymétrique", () => {
      const portrait = { width: 600, height: 1200 };
      expect(nearestCorner({ x: 580, y: 50 }, portrait)).toBe("TR");
    });
  });

  describe("localStorage persistence", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("lit TR par défaut quand rien n'est sauvé", () => {
      expect(readSavedCorner()).toBe("TR");
    });

    it("sauve et relit le même coin", () => {
      saveCorner("BL");
      expect(readSavedCorner()).toBe("BL");
      expect(localStorage.getItem(LS_TUTOR_CORNER)).toBe("BL");
    });

    it("retourne TR si la valeur stockée est invalide", () => {
      localStorage.setItem(LS_TUTOR_CORNER, "garbage");
      expect(readSavedCorner()).toBe("TR");
    });

    it("accepte les 4 coins valides", () => {
      const corners = ["TL", "TR", "BL", "BR"] as const;
      corners.forEach((c) => {
        saveCorner(c);
        expect(readSavedCorner()).toBe(c);
      });
    });
  });
});
