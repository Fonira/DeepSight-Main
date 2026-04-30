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
});
