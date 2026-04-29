import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Testimonials from "../Testimonials";

describe("Testimonials", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders 3 testimonial cards in French", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("PROD", false);
    render(<Testimonials language="fr" />);
    expect(screen.getByText(/Dr\. Marie L\./i)).toBeInTheDocument();
    expect(screen.getByText(/Thomas B\./i)).toBeInTheDocument();
    expect(screen.getByText(/Léa K\./i)).toBeInTheDocument();
    // Métriques visibles
    expect(screen.getByText(/2h\s*→\s*30 min/i)).toBeInTheDocument();
    expect(screen.getByText(/3 fact-checks\/jour/i)).toBeInTheDocument();
    expect(screen.getByText(/\+40\s*%\s*rétention/i)).toBeInTheDocument();
  });

  it("renders 3 testimonial cards in English", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("PROD", false);
    render(<Testimonials language="en" />);
    expect(screen.getByText(/Dr\. Marie L\./i)).toBeInTheDocument();
    expect(screen.getByText(/Thomas B\./i)).toBeInTheDocument();
    expect(screen.getByText(/Léa K\./i)).toBeInTheDocument();
  });

  it("displays a 'Démo' badge when DEV", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("PROD", false);
    render(<Testimonials language="fr" />);
    expect(screen.getByTestId("testimonials-demo-badge")).toBeInTheDocument();
    expect(screen.getByTestId("testimonials-demo-badge")).toHaveTextContent(
      /démo/i,
    );
  });

  it("returns null when PROD and all entries are placeholder", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
    const { container } = render(<Testimonials language="fr" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders avatar initials from author name", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("PROD", false);
    render(<Testimonials language="fr" />);
    // "Dr. Marie L." -> "ML" (initials of first non-honorific words)
    expect(
      screen.getByLabelText(/avatar de Dr\. Marie L\./i),
    ).toBeInTheDocument();
  });
});
