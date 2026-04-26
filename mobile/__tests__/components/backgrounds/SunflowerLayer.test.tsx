/**
 * SunflowerLayer.test.tsx — Tests for the v3 SunflowerLayer mascot (RN).
 *
 * Verifies:
 * - Renders the bottom-right mascot with pointerEvents=none when enabled
 * - Returns null when ambient lighting is disabled
 */
import React from "react";
import { render } from "@testing-library/react-native";

import { SunflowerLayer } from "../../../src/components/backgrounds/SunflowerLayer";
import { AmbientLightingProvider } from "../../../src/contexts/AmbientLightingContext";

describe("SunflowerLayer (RN, v3)", () => {
  it("renders mascot bottom-right with pointerEvents=none when enabled", () => {
    const { getByTestId } = render(
      <AmbientLightingProvider>
        <SunflowerLayer />
      </AmbientLightingProvider>,
    );
    const layer = getByTestId("sunflower-mascot");
    expect(layer.props.pointerEvents).toBe("none");
  });

  it("returns null when ambient lighting is disabled", () => {
    const { queryByTestId } = render(
      <AmbientLightingProvider enabled={false}>
        <SunflowerLayer />
      </AmbientLightingProvider>,
    );
    expect(queryByTestId("sunflower-mascot")).toBeNull();
  });
});
