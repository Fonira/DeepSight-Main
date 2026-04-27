/** @jest-environment jsdom */
//
// Tests — ContextProgressBar (extension/src/sidepanel/components/ContextProgressBar.tsx)
//
// Affiche une barre de progression "% du transcript reçu" pendant un voice
// call (le SSE alimente progress + complete). Quand complete=true on switch
// le label.
import React from "react";
import { render, screen } from "@testing-library/react";
import { ContextProgressBar } from "../../../src/sidepanel/components/ContextProgressBar";

describe("ContextProgressBar", () => {
  it("shows percent and 'Analyse en cours' label", () => {
    render(<ContextProgressBar progress={64} complete={false} />);
    expect(screen.getByText(/64%/)).toBeInTheDocument();
    expect(screen.getByText(/Analyse en cours/)).toBeInTheDocument();
  });

  it("shows 'Analyse complète' label when complete", () => {
    render(<ContextProgressBar progress={100} complete={true} />);
    expect(screen.getByText(/Analyse complète/)).toBeInTheDocument();
  });

  it("rounds non-integer progress for display", () => {
    render(<ContextProgressBar progress={64.7} complete={false} />);
    expect(screen.getByText(/65%/)).toBeInTheDocument();
  });
});
