import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { AmbientLightLayer } from "../AmbientLightLayer";
import { AmbientLightingProvider } from "../../contexts/AmbientLightingContext";

describe("AmbientLightLayer", () => {
  it("renders fixed inset overlay with aria-hidden", () => {
    const { container } = render(
      <AmbientLightingProvider>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    const layer = container.querySelector(
      '.ambient-light-layer[aria-hidden="true"]',
    );
    expect(layer).toBeTruthy();
    expect((layer as HTMLElement).style.position).toBe("fixed");
  });

  it("renders nothing when provider disabled", () => {
    const { container } = render(
      <AmbientLightingProvider enabled={false}>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    expect(container.querySelector(".ambient-light-layer")).toBeFalsy();
  });

  it("applies beam angle from preset as CSS transform", () => {
    const { container } = render(
      <AmbientLightingProvider>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    const beam = container.querySelector(".ambient-beam");
    expect(beam).toBeTruthy();
    const style = (beam as HTMLElement).style;
    expect(style.transform).toMatch(/rotate\(-?\d+(\.\d+)?deg\)/);
  });
});
