import { describe, expect, it, vi } from "vitest";
import { render, renderHook } from "@testing-library/react";
import {
  AmbientLightingProvider,
  useAmbientLightingContext,
} from "../AmbientLightingContext";

describe("AmbientLightingProvider", () => {
  it("provides preset to children via context", () => {
    const { result } = renderHook(() => useAmbientLightingContext(), {
      wrapper: ({ children }) => (
        <AmbientLightingProvider>{children}</AmbientLightingProvider>
      ),
    });
    expect(result.current.preset).toBeDefined();
    expect(result.current.preset.frameIndex).toBeGreaterThanOrEqual(0);
    expect(result.current.preset.frameIndex).toBeLessThanOrEqual(23);
  });

  it("renders children even when enabled=false", () => {
    const { container } = render(
      <AmbientLightingProvider enabled={false}>
        <div data-testid="child">child</div>
      </AmbientLightingProvider>,
    );
    expect(container.querySelector('[data-testid="child"]')).toBeTruthy();
  });

  it("refreshes preset every 30 seconds (no throw on tick)", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAmbientLightingContext(), {
      wrapper: ({ children }) => (
        <AmbientLightingProvider>{children}</AmbientLightingProvider>
      ),
    });
    const initial = result.current.preset.frameIndex;
    vi.advanceTimersByTime(30 * 1000);
    expect(result.current.preset).toBeDefined();
    expect(typeof initial).toBe("number");
    vi.useRealTimers();
  });
});
