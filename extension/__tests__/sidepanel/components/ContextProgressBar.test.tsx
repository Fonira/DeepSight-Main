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

  describe("phase mode (dynamic labels)", () => {
    it("renders 'searching' phase with looking-up label", () => {
      render(
        <ContextProgressBar progress={0} complete={false} phase="searching" />,
      );
      expect(screen.getByText(/Recherche du transcript/)).toBeInTheDocument();
    });

    it("renders 'transcriptReceived' phase with chunk counters", () => {
      render(
        <ContextProgressBar
          progress={42}
          complete={false}
          phase="transcriptReceived"
          transcriptChunksReceived={3}
          transcriptChunksTotal={7}
        />,
      );
      expect(screen.getByText(/Transcript reçu/)).toBeInTheDocument();
      expect(screen.getByText(/3\/7 segments/)).toBeInTheDocument();
    });

    it("renders 'mistralAnalyzing' phase with Mistral label", () => {
      render(
        <ContextProgressBar
          progress={80}
          complete={false}
          phase="mistralAnalyzing"
        />,
      );
      expect(screen.getByText(/Mistral analyse en cours/)).toBeInTheDocument();
    });

    it("renders 'complete' phase with synthesis-complete label", () => {
      render(
        <ContextProgressBar progress={100} complete={true} phase="complete" />,
      );
      expect(screen.getByText(/Synthèse complète/)).toBeInTheDocument();
    });

    it("falls back to legacy label when phase prop is omitted", () => {
      render(<ContextProgressBar progress={50} complete={false} />);
      expect(screen.getByText(/Analyse en cours/)).toBeInTheDocument();
      expect(screen.getByText(/50%/)).toBeInTheDocument();
    });
  });
});
