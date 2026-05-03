// frontend/src/components/hub/__tests__/HubHeader.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HubHeader } from "../HubHeader";

describe("HubHeader", () => {
  it("calls onMenuClick when hamburger pressed", () => {
    const onMenuClick = vi.fn();
    render(
      <HubHeader
        onMenuClick={onMenuClick}
        title="Conv title"
        subtitle="YouTube · 18:32"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /conversations/i }));
    expect(onMenuClick).toHaveBeenCalled();
  });

  it("renders title + subtitle", () => {
    render(
      <HubHeader
        onMenuClick={() => {}}
        title="Conv title"
        subtitle="YouTube · 18:32"
      />,
    );
    expect(screen.getByText("Conv title")).toBeInTheDocument();
    expect(screen.getByText(/YouTube/i)).toBeInTheDocument();
  });

  it("renders pipSlot child if provided", () => {
    render(
      <HubHeader
        onMenuClick={() => {}}
        title="t"
        pipSlot={<div data-testid="pip-mock">PIP</div>}
      />,
    );
    expect(screen.getByTestId("pip-mock")).toBeInTheDocument();
  });

  it("renders only the logo as home — no labelled 'Accueil' pill (F2)", () => {
    render(
      <HubHeader onMenuClick={() => {}} onHomeClick={() => {}} title="Test" />,
    );
    expect(screen.queryByText("Accueil")).not.toBeInTheDocument();
    const homeButtons = screen.getAllByRole("button", {
      name: "Retour à l'accueil",
    });
    expect(homeButtons).toHaveLength(1);
  });

  it("applies line-clamp-1 to long titles (F9)", () => {
    const longTitle = "A".repeat(200);
    const { container } = render(
      <HubHeader onMenuClick={() => {}} title={longTitle} />,
    );
    const titleEl = container.querySelector("p.line-clamp-1");
    expect(titleEl).toBeInTheDocument();
    expect(titleEl?.textContent).toBe(longTitle);
  });
});
