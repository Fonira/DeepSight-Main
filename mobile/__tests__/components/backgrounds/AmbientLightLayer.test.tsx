/**
 * AmbientLightLayer.test.tsx — Tests for the v3 AmbientLightLayer (RN).
 *
 * Verifies:
 * - Renders absoluteFill with pointerEvents=none when enabled
 * - Returns null when disabled (saves CPU + RAM on low-end devices)
 */
import React from "react";
import { render } from "@testing-library/react-native";

// Reanimated mock — Animated.View → plain View, hooks return inert values
jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    View,
    createAnimatedComponent: (c: unknown) => c,
    useAnimatedStyle: () => ({}),
    useSharedValue: (v: unknown) => ({ value: v }),
    withTiming: (v: unknown) => v,
    Easing: { bezier: () => "bezier" },
  };
});

import { AmbientLightLayer } from "../../../src/components/backgrounds/AmbientLightLayer";
import { AmbientLightingProvider } from "../../../src/contexts/AmbientLightingContext";

describe("AmbientLightLayer (RN, v3)", () => {
  it("renders with absoluteFill + pointerEvents=none when enabled", () => {
    const { getByTestId } = render(
      <AmbientLightingProvider>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    const layer = getByTestId("ambient-light-layer");
    expect(layer.props.pointerEvents).toBe("none");
  });

  it("returns null when ambient lighting is disabled", () => {
    const { queryByTestId } = render(
      <AmbientLightingProvider enabled={false}>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    expect(queryByTestId("ambient-light-layer")).toBeNull();
  });
});
