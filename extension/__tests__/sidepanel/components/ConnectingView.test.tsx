/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { ConnectingView } from "../../../src/sidepanel/components/ConnectingView";

describe("ConnectingView", () => {
  it("shows pulsing mic + 'Connexion à l'agent…' message", () => {
    render(<ConnectingView />);
    expect(screen.getByText(/Connexion à l'agent/)).toBeInTheDocument();
    expect(
      screen.getByText(/L'appel démarre dans une seconde/),
    ).toBeInTheDocument();
  });
});
