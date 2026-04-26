/**
 * Tests — PlanBadge component
 * Fichier source : src/sidepanel/components/PlanBadge.tsx
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlanBadge } from "../../../src/sidepanel/components/PlanBadge";

describe("PlanBadge", () => {
  it("renders plan label and credits", () => {
    render(<PlanBadge plan="pro" creditsLeft={42} onUpgrade={() => {}} />);
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText(/42 crédits/i)).toBeInTheDocument();
  });

  it("shows upgrade button for free plan and calls onUpgrade", () => {
    const onUpgrade = jest.fn();
    render(<PlanBadge plan="free" creditsLeft={3} onUpgrade={onUpgrade} />);
    fireEvent.click(screen.getByText(/upgrade/i));
    expect(onUpgrade).toHaveBeenCalled();
  });

  it("hides upgrade button for pro plan", () => {
    render(<PlanBadge plan="pro" creditsLeft={42} onUpgrade={() => {}} />);
    expect(screen.queryByText(/upgrade/i)).toBeNull();
  });

  it("shows upgrade button for etudiant plan", () => {
    render(<PlanBadge plan="etudiant" creditsLeft={10} onUpgrade={() => {}} />);
    expect(screen.getByText(/upgrade/i)).toBeInTheDocument();
  });
});
