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
  it("renders hero variant on /", () => {
    const { container } = renderWithRoute("/");
    const flower = container.querySelector(".sunflower-hero");
    expect(flower).toBeTruthy();
  });

  it("renders mascot variant on /dashboard", () => {
    const { container } = renderWithRoute("/dashboard");
    const flower = container.querySelector(".sunflower-mascot");
    expect(flower).toBeTruthy();
  });

  it("uses sunflower sprite from /assets/ambient/", () => {
    const { container } = renderWithRoute("/");
    const flower = container.querySelector(".sunflower-hero") as HTMLElement;
    expect(flower).toBeTruthy();
    expect(flower.style.backgroundImage).toMatch(
      /url\(.*\/assets\/ambient\/sunflower-(day|night)\.webp.*\)/,
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
