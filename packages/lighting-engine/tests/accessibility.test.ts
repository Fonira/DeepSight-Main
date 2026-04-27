import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectHighContrast,
  detectReducedMotion,
  getReadingZoneCap,
} from "../src/accessibility";

type MatchMediaQuery = (query: string) => MediaQueryList;

interface FakeWindow {
  matchMedia?: MatchMediaQuery;
}

function setWindow(fake: FakeWindow | undefined): void {
  // @ts-expect-error — overriding global window for tests
  globalThis.window = fake;
}

describe("detectReducedMotion", () => {
  let originalWindow: unknown;

  beforeEach(() => {
    // @ts-expect-error — capture pre-test global
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    // @ts-expect-error — restore global
    globalThis.window = originalWindow;
  });

  it("returns false when window is undefined (SSR / Node)", () => {
    setWindow(undefined);
    expect(detectReducedMotion()).toBe(false);
  });

  it("returns false when matchMedia is missing", () => {
    setWindow({});
    expect(detectReducedMotion()).toBe(false);
  });

  it("returns true when matchMedia matches reduce", () => {
    setWindow({
      matchMedia: vi.fn(() => ({ matches: true }) as unknown as MediaQueryList),
    });
    expect(detectReducedMotion()).toBe(true);
  });

  it("returns false when no preference matches", () => {
    setWindow({
      matchMedia: vi.fn(
        () => ({ matches: false }) as unknown as MediaQueryList,
      ),
    });
    expect(detectReducedMotion()).toBe(false);
  });

  it("returns false if matchMedia throws", () => {
    setWindow({
      matchMedia: () => {
        throw new Error("media-error");
      },
    });
    expect(detectReducedMotion()).toBe(false);
  });
});

describe("detectHighContrast", () => {
  let originalWindow: unknown;

  beforeEach(() => {
    // @ts-expect-error — capture pre-test global
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    // @ts-expect-error — restore global
    globalThis.window = originalWindow;
  });

  it("returns false when window is undefined", () => {
    setWindow(undefined);
    expect(detectHighContrast()).toBe(false);
  });

  it("returns true when prefers-contrast: more matches", () => {
    setWindow({
      matchMedia: vi.fn(() => ({ matches: true }) as unknown as MediaQueryList),
    });
    expect(detectHighContrast()).toBe(true);
  });

  it("returns false when matchMedia throws", () => {
    setWindow({
      matchMedia: () => {
        throw new Error("media-error");
      },
    });
    expect(detectHighContrast()).toBe(false);
  });
});

describe("getReadingZoneCap", () => {
  it("caps to 0.5 by default", () => {
    expect(getReadingZoneCap(0.8)).toBe(0.5);
    expect(getReadingZoneCap(0.5)).toBe(0.5);
  });

  it("returns the original intensity when below cap (default)", () => {
    expect(getReadingZoneCap(0.3)).toBe(0.3);
  });

  it("caps to 0.3 when high contrast", () => {
    expect(getReadingZoneCap(0.8, true)).toBe(0.3);
    expect(getReadingZoneCap(0.5, true)).toBe(0.3);
  });

  it("returns intensity below 0.3 unchanged in high contrast", () => {
    expect(getReadingZoneCap(0.2, true)).toBe(0.2);
  });
});
