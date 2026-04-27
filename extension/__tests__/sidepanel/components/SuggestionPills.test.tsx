/**
 * Tests — SuggestionPills component
 * Fichier source : src/sidepanel/components/SuggestionPills.tsx
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  SuggestionPills,
  type Suggestion,
} from "../../../src/sidepanel/components/SuggestionPills";

describe("SuggestionPills", () => {
  it("renders nothing when suggestions array is empty", () => {
    const { container } = render(<SuggestionPills suggestions={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one chip per suggestion (up to 3 visible)", () => {
    const suggestions: Suggestion[] = [
      { id: "a", label: "Alpha", icon: "A", onTrigger: () => {} },
      { id: "b", label: "Beta", icon: "B", onTrigger: () => {} },
      { id: "c", label: "Gamma", icon: "C", onTrigger: () => {} },
    ];
    render(<SuggestionPills suggestions={suggestions} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("calls onTrigger when a pill is clicked", () => {
    const onTrigger = jest.fn();
    const suggestions: Suggestion[] = [
      { id: "x", label: "Click me", icon: "X", onTrigger },
    ];
    render(<SuggestionPills suggestions={suggestions} />);
    fireEvent.click(screen.getByText("Click me"));
    expect(onTrigger).toHaveBeenCalled();
  });

  it("caps display at 3 pills even if more suggestions are passed", () => {
    const suggestions: Suggestion[] = [
      { id: "1", label: "One", icon: "1", onTrigger: () => {} },
      { id: "2", label: "Two", icon: "2", onTrigger: () => {} },
      { id: "3", label: "Three", icon: "3", onTrigger: () => {} },
      { id: "4", label: "Four", icon: "4", onTrigger: () => {} },
    ];
    render(<SuggestionPills suggestions={suggestions} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Two")).toBeInTheDocument();
    expect(screen.getByText("Three")).toBeInTheDocument();
    expect(screen.queryByText("Four")).toBeNull();
  });
});
