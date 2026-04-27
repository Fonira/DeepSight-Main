/**
 * Tests — SunflowerLayer (extension sidepanel)
 * Fichier source : src/sidepanel/components/SunflowerLayer.tsx
 *
 * Vérifie le rendu du tournesol mascot bottom-right + le no-render quand
 * le provider est désactivé.
 */

import React from "react";
import { render } from "@testing-library/react";
import { SunflowerLayer } from "../../src/sidepanel/components/SunflowerLayer";
import { AmbientLightingProvider } from "../../src/sidepanel/contexts/AmbientLightingContext";

describe("SunflowerLayer (extension sidepanel)", () => {
  it("renders mascot fixed bottom-right when enabled", () => {
    const { container } = render(
      <AmbientLightingProvider>
        <SunflowerLayer />
      </AmbientLightingProvider>,
    );
    expect(container.querySelector(".sunflower-mascot")).toBeTruthy();
  });

  it("returns null when disabled", () => {
    const { container } = render(
      <AmbientLightingProvider enabled={false}>
        <SunflowerLayer />
      </AmbientLightingProvider>,
    );
    expect(container.querySelector(".sunflower-mascot")).toBeFalsy();
  });
});
