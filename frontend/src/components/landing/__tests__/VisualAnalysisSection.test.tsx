import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VisualAnalysisSection from "../VisualAnalysisSection";

describe("VisualAnalysisSection", () => {
  it("renders tagline and key copy in French", () => {
    render(<VisualAnalysisSection language="fr" />);
    expect(
      screen.getByText(/ne se contente plus d'écouter — elle regarde/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Mistral Vision/i)).toBeInTheDocument();
    // Phase 2 badge
    expect(screen.getByText(/Phase 2/i)).toBeInTheDocument();
  });

  it("renders English version when language=en", () => {
    render(<VisualAnalysisSection language="en" />);
    expect(
      screen.getByText(/doesn't just listen — it watches/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Mistral Vision/i)).toBeInTheDocument();
  });

  it("renders 3 mockup moments with timestamps", () => {
    render(<VisualAnalysisSection language="fr" />);
    expect(screen.getByText("00:03")).toBeInTheDocument();
    expect(screen.getByText("01:42")).toBeInTheDocument();
    expect(screen.getByText("04:18")).toBeInTheDocument();
  });

  it("renders all 3 moment types as uppercase tags", () => {
    render(<VisualAnalysisSection language="fr" />);
    expect(screen.getByText("hook")).toBeInTheDocument();
    expect(screen.getByText("reveal")).toBeInTheDocument();
    expect(screen.getByText("cta")).toBeInTheDocument();
  });

  it("renders JSON mockup with key fields", () => {
    render(<VisualAnalysisSection language="fr" />);
    expect(screen.getByText(/visual_analysis\.json/i)).toBeInTheDocument();
    expect(screen.getByText(/"visual_hook"/)).toBeInTheDocument();
    expect(screen.getByText(/"visual_structure"/)).toBeInTheDocument();
    expect(screen.getByText(/"key_moments"/)).toBeInTheDocument();
  });

  it("renders 3 trust badges (frames, mistral, no download)", () => {
    render(<VisualAnalysisSection language="fr" />);
    expect(screen.getByText(/Frames extraites/i)).toBeInTheDocument();
    expect(screen.getByText(/Pixtral Large/i)).toBeInTheDocument();
    expect(screen.getByText(/Pas de download vidéo/i)).toBeInTheDocument();
  });

  it("has section aria-label for accessibility", () => {
    const { container } = render(<VisualAnalysisSection language="fr" />);
    const section = container.querySelector("section");
    expect(section).toHaveAttribute("aria-label", "Analyse visuelle");
  });
});
