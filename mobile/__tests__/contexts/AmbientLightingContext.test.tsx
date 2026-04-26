/**
 * Tests for AmbientLightingContext (RN)
 * Covers: provider exposes preset, respects enabled=false, fallback outside provider.
 */
import React from "react";
import { renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";

import {
  AmbientLightingProvider,
  useAmbientLightingContext,
} from "../../src/contexts/AmbientLightingContext";

describe("AmbientLightingProvider (RN)", () => {
  it("provides a v3 preset with valid frameIndex", () => {
    const { result } = renderHook(() => useAmbientLightingContext(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <AmbientLightingProvider>{children}</AmbientLightingProvider>
      ),
    });
    expect(result.current.preset).toBeDefined();
    expect(result.current.enabled).toBe(true);
    expect(result.current.preset.frameIndex).toBeGreaterThanOrEqual(0);
    expect(result.current.preset.frameIndex).toBeLessThan(48);
  });

  it("respects enabled=false (enabled flag exposed)", () => {
    const { result } = renderHook(() => useAmbientLightingContext(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <AmbientLightingProvider enabled={false}>
          {children}
        </AmbientLightingProvider>
      ),
    });
    expect(result.current.enabled).toBe(false);
    // Preset is still computed (so layers can render fallback if needed),
    // but no AppState listener registers when disabled.
    expect(result.current.preset).toBeDefined();
  });

  it("returns a fallback preset when used outside any provider", () => {
    const { result } = renderHook(() => useAmbientLightingContext());
    expect(result.current.enabled).toBe(false);
    expect(result.current.preset).toBeDefined();
  });

  it("registers an AppState listener when enabled", () => {
    const spy = jest.spyOn(AppState, "addEventListener");
    spy.mockClear();

    renderHook(() => useAmbientLightingContext(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <AmbientLightingProvider>{children}</AmbientLightingProvider>
      ),
    });

    expect(spy).toHaveBeenCalledWith("change", expect.any(Function));
    spy.mockRestore();
  });

  it("does NOT register an AppState listener when disabled", () => {
    const spy = jest.spyOn(AppState, "addEventListener");
    spy.mockClear();

    renderHook(() => useAmbientLightingContext(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <AmbientLightingProvider enabled={false}>
          {children}
        </AmbientLightingProvider>
      ),
    });

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
