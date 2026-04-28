import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SunflowerLayer } from "../SunflowerLayer";
import { AmbientLightingProvider } from "../../contexts/AmbientLightingContext";

const renderWithRoute = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AmbientLightingProvider>
        <Routes>
          <Route path="*" element={<SunflowerLayer />} />
        </Routes>
      </AmbientLightingProvider>
    </MemoryRouter>,
  );

describe("SunflowerLayer", () => {
  it("renders mascot bottom-right on landing /", () => {
    const { container } = renderWithRoute("/");
    const flower = container.querySelector(".sunflower-mascot");
    expect(flower).toBeTruthy();
  });

  it("renders mascot bottom-right on /dashboard", () => {
    const { container } = renderWithRoute("/dashboard");
    const flower = container.querySelector(".sunflower-mascot");
    expect(flower).toBeTruthy();
  });

  it("never renders a centered hero variant", () => {
    const { container } = renderWithRoute("/");
    expect(container.querySelector(".sunflower-hero")).toBeFalsy();
  });

  it("renders an inline SVG (vector, no sprite WebP)", () => {
    const { container } = renderWithRoute("/");
    const wrap = container.querySelector(".sunflower-mascot") as HTMLElement;
    expect(wrap).toBeTruthy();
    expect(wrap.querySelector("svg")).toBeTruthy();
  });

  it("exposes the current daily phase via data attribute", () => {
    const { container } = renderWithRoute("/dashboard");
    const wrap = container.querySelector(".sunflower-mascot") as HTMLElement;
    expect(wrap).toBeTruthy();
    expect(["dawn", "day", "dusk", "night"]).toContain(
      wrap.getAttribute("data-sunflower-phase"),
    );
  });

  it("renders nothing when provider disabled", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <AmbientLightingProvider enabled={false}>
          <SunflowerLayer />
        </AmbientLightingProvider>
      </MemoryRouter>,
    );
    expect(container.querySelector(".sunflower-hero")).toBeFalsy();
    expect(container.querySelector(".sunflower-mascot")).toBeFalsy();
  });
});
