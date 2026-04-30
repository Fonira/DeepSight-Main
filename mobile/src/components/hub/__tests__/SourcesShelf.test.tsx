/**
 * SourcesShelf.test.tsx — Test rendu basique de la pill plateformes.
 */

import React from "react";
import { render } from "@testing-library/react-native";

jest.mock("@/theme/typography", () => ({
  fontFamily: {
    mono: "System",
  },
}));

import { SourcesShelf } from "../SourcesShelf";

describe("SourcesShelf", () => {
  it("affiche le label par defaut PLATEFORMES SUPPORTEES", () => {
    const { getByText } = render(<SourcesShelf />);
    expect(getByText("PLATEFORMES SUPPORTEES")).toBeTruthy();
  });

  it("accepte un label custom", () => {
    const { getByText } = render(<SourcesShelf label="SOURCES" compact />);
    expect(getByText("SOURCES")).toBeTruthy();
  });
});
