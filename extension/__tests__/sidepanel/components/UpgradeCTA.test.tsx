/** @jest-environment jsdom */
//
// Tests — UpgradeCTA (extension/src/sidepanel/components/UpgradeCTA.tsx)
//
// Composant final post-call (essai gratuit consommé) ou bloquant (Pro
// sans voice). Pousse vers Expert (19,99€/mois, 30 min voice).
import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import { UpgradeCTA } from "../../../src/sidepanel/components/UpgradeCTA";

describe("UpgradeCTA", () => {
  it("renders Expert plan card with 19,99€ and 30 min/mois", () => {
    render(
      <UpgradeCTA
        reason="trial_used"
        onUpgrade={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );
    expect(screen.getByText(/19,99€/)).toBeInTheDocument();
    // "30 min" apparaît plusieurs fois (headline + bullet) — getAllByText.
    expect(screen.getAllByText(/30 min/).length).toBeGreaterThan(0);
  });

  it("clicking 'Passer en Expert' calls onUpgrade", () => {
    const onUpgrade = jest.fn();
    render(
      <UpgradeCTA
        reason="trial_used"
        onUpgrade={onUpgrade}
        onDismiss={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/Passer en Expert/));
    expect(onUpgrade).toHaveBeenCalled();
  });

  it("clicking 'Continuer en Free' calls onDismiss", () => {
    const onDismiss = jest.fn();
    render(
      <UpgradeCTA
        reason="trial_used"
        onUpgrade={jest.fn()}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByText(/Continuer en Free/));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("supports pro_no_voice reason without crashing", () => {
    render(
      <UpgradeCTA
        reason="pro_no_voice"
        onUpgrade={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );
    expect(screen.getByText(/Passer en Expert/)).toBeInTheDocument();
  });
});
