/**
 * 🧪 Web Vitals Service Tests
 *
 * Vérifie que :
 * - `initWebVitals()` enregistre les listeners pour les 6 metrics standard
 * - Chaque callback forward correctement le `Metric` vers `analytics.captureWebVital`
 * - Le service est idempotent (multiple `initWebVitals` = un seul set de listeners)
 * - Une erreur dans `analytics.captureWebVital` ne casse pas l'app (silent fail)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock web-vitals AVANT l'import du service
vi.mock("web-vitals", () => ({
  onCLS: vi.fn(),
  onFCP: vi.fn(),
  onFID: vi.fn(),
  onINP: vi.fn(),
  onLCP: vi.fn(),
  onTTFB: vi.fn(),
}));

// Mock analytics
vi.mock("../analytics", () => ({
  analytics: {
    captureWebVital: vi.fn(),
  },
}));

import { onCLS, onFCP, onFID, onINP, onLCP, onTTFB } from "web-vitals";
import { analytics } from "../analytics";
import { initWebVitals, __resetWebVitalsForTests } from "../webVitals";

const mockOnCLS = vi.mocked(onCLS);
const mockOnFCP = vi.mocked(onFCP);
const mockOnFID = vi.mocked(onFID);
const mockOnINP = vi.mocked(onINP);
const mockOnLCP = vi.mocked(onLCP);
const mockOnTTFB = vi.mocked(onTTFB);
const mockCapture = vi.mocked(analytics.captureWebVital);

describe("webVitals service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetWebVitalsForTests();
  });

  describe("initWebVitals", () => {
    it("registers listeners for the 6 standard Core Web Vitals", () => {
      initWebVitals();

      expect(mockOnLCP).toHaveBeenCalledTimes(1);
      expect(mockOnFID).toHaveBeenCalledTimes(1);
      expect(mockOnCLS).toHaveBeenCalledTimes(1);
      expect(mockOnINP).toHaveBeenCalledTimes(1);
      expect(mockOnTTFB).toHaveBeenCalledTimes(1);
      expect(mockOnFCP).toHaveBeenCalledTimes(1);
    });

    it("is idempotent — second call is a no-op", () => {
      initWebVitals();
      initWebVitals();
      initWebVitals();

      // Each registrar should only be called once across all calls
      expect(mockOnLCP).toHaveBeenCalledTimes(1);
      expect(mockOnCLS).toHaveBeenCalledTimes(1);
      expect(mockOnINP).toHaveBeenCalledTimes(1);
    });
  });

  describe("metric reporting", () => {
    it("forwards LCP metric to analytics.captureWebVital with correct shape", () => {
      initWebVitals();

      // Récupère le callback enregistré
      const lcpCallback = mockOnLCP.mock.calls[0][0];
      expect(lcpCallback).toBeTypeOf("function");

      // Simule l'émission d'une LCP metric
      lcpCallback({
        name: "LCP",
        value: 2400,
        rating: "good",
        delta: 2400,
        id: "v4-1234567890-1234",
        navigationType: "navigate",
        entries: [],
      });

      expect(mockCapture).toHaveBeenCalledTimes(1);
      expect(mockCapture).toHaveBeenCalledWith({
        name: "LCP",
        value: 2400,
        rating: "good",
        delta: 2400,
        id: "v4-1234567890-1234",
        navigationType: "navigate",
      });
    });

    it("forwards CLS metric (with float value)", () => {
      initWebVitals();

      const clsCallback = mockOnCLS.mock.calls[0][0];
      clsCallback({
        name: "CLS",
        value: 0.05,
        rating: "good",
        delta: 0.02,
        id: "v4-cls-id",
        navigationType: "reload",
        entries: [],
      });

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "CLS",
          value: 0.05,
          rating: "good",
          delta: 0.02,
        }),
      );
    });

    it("forwards INP metric with poor rating", () => {
      initWebVitals();

      const inpCallback = mockOnINP.mock.calls[0][0];
      inpCallback({
        name: "INP",
        value: 600,
        rating: "poor",
        delta: 600,
        id: "v4-inp-id",
        navigationType: "navigate",
        entries: [],
      });

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "INP",
          value: 600,
          rating: "poor",
        }),
      );
    });

    it("does not crash if analytics.captureWebVital throws (silent telemetry)", () => {
      mockCapture.mockImplementationOnce(() => {
        throw new Error("posthog network error");
      });

      initWebVitals();
      const ttfbCallback = mockOnTTFB.mock.calls[0][0];

      // Doit retourner undefined sans propager l'erreur
      expect(() =>
        ttfbCallback({
          name: "TTFB",
          value: 250,
          rating: "good",
          delta: 250,
          id: "v4-ttfb-id",
          navigationType: "navigate",
          entries: [],
        }),
      ).not.toThrow();
    });
  });
});
