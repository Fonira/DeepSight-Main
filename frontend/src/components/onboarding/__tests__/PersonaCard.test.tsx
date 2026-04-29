import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GraduationCap } from "lucide-react";
import { renderWithProviders } from "../../../__tests__/test-utils";
import { PersonaCard } from "../PersonaCard";

describe("PersonaCard", () => {
  it("renders label, description, icon", () => {
    renderWithProviders(
      <PersonaCard
        icon={GraduationCap}
        label="Étudiant"
        description="Cours, révisions"
        selected={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("Étudiant")).toBeInTheDocument();
    expect(screen.getByText("Cours, révisions")).toBeInTheDocument();
  });

  it("calls onSelect when clicked", async () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <PersonaCard
        icon={GraduationCap}
        label="Étudiant"
        description="Cours"
        selected={false}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /étudiant/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("applies selected styles when selected=true", () => {
    renderWithProviders(
      <PersonaCard
        icon={GraduationCap}
        label="Étudiant"
        description="Cours"
        selected={true}
        onSelect={() => {}}
      />,
    );
    const button = screen.getByRole("button", { name: /étudiant/i });
    expect(button).toHaveAttribute("aria-pressed", "true");
  });
});
