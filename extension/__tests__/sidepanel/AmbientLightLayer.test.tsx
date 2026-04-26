/**
 * Tests — AmbientLightLayer (extension sidepanel)
 * Fichier source : src/sidepanel/components/AmbientLightLayer.tsx
 *
 * Vérifie que le layer overlay rend bien quand le provider est actif et
 * disparaît quand `enabled={false}`.
 */

import React from "react";
import { render } from "@testing-library/react";
import { AmbientLightLayer } from "../../src/sidepanel/components/AmbientLightLayer";
import { AmbientLightingProvider } from "../../src/sidepanel/contexts/AmbientLightingContext";

describe("AmbientLightLayer (extension sidepanel)", () => {
  it("renders fixed inset overlay when enabled", () => {
    const { container } = render(
      <AmbientLightingProvider>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    expect(container.querySelector(".ambient-light-layer")).toBeTruthy();
  });

  it("returns null when disabled", () => {
    const { container } = render(
      <AmbientLightingProvider enabled={false}>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    expect(container.querySelector(".ambient-light-layer")).toBeFalsy();
  });
});
