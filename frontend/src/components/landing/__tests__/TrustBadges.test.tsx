import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TrustBadges from "../TrustBadges";

describe("TrustBadges", () => {
  it("renders 5 badges in French", () => {
    render(<TrustBadges language="fr" />);
    expect(screen.getByText(/IA 100\s*%\s*Française/i)).toBeInTheDocument();
    expect(screen.getByText(/archivées à vie/i)).toBeInTheDocument();
    expect(screen.getByText(/RGPD/i)).toBeInTheDocument();
    expect(screen.getByText(/14 jours/i)).toBeInTheDocument();
    expect(screen.getByText(/Stripe/i)).toBeInTheDocument();
  });

  it("renders 5 badges in English", () => {
    render(<TrustBadges language="en" />);
    expect(screen.getByText(/100\s*%\s*French/i)).toBeInTheDocument();
    expect(screen.getByText(/lifetime/i)).toBeInTheDocument();
    expect(screen.getByText(/GDPR/i)).toBeInTheDocument();
    expect(screen.getByText(/14[- ]day/i)).toBeInTheDocument();
    expect(screen.getByText(/Stripe/i)).toBeInTheDocument();
  });

  it("each badge has a role-list item with aria-label", () => {
    render(<TrustBadges language="fr" />);
    const list = screen.getByRole("list", { name: /trust badges|garanties/i });
    expect(list).toBeInTheDocument();
    expect(list.querySelectorAll("li")).toHaveLength(5);
  });
});
