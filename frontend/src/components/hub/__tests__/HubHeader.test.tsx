// frontend/src/components/hub/__tests__/HubHeader.test.tsx
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HubHeader } from "../HubHeader";

// Mock useAuthContext — surchargeable par test via mockUser.
let mockUser: { plan?: string; is_admin?: boolean } | null = null;
vi.mock("../../../contexts/AuthContext", () => ({
  useAuthContext: () => ({ user: mockUser }),
}));

function renderHeader(props: React.ComponentProps<typeof HubHeader>) {
  return render(
    <MemoryRouter>
      <HubHeader {...props} />
    </MemoryRouter>,
  );
}

describe("HubHeader", () => {
  beforeEach(() => {
    mockUser = null;
  });

  it("calls onMenuClick when hamburger pressed", () => {
    const onMenuClick = vi.fn();
    renderHeader({
      onMenuClick,
      title: "Conv title",
      subtitle: "YouTube · 18:32",
    });
    fireEvent.click(screen.getByRole("button", { name: /conversations/i }));
    expect(onMenuClick).toHaveBeenCalled();
  });

  it("renders title + subtitle", () => {
    renderHeader({
      onMenuClick: () => {},
      title: "Conv title",
      subtitle: "YouTube · 18:32",
    });
    expect(screen.getByText("Conv title")).toBeInTheDocument();
    expect(screen.getByText(/YouTube/i)).toBeInTheDocument();
  });

  it("renders pipSlot child if provided", () => {
    renderHeader({
      onMenuClick: () => {},
      title: "t",
      pipSlot: <div data-testid="pip-mock">PIP</div>,
    });
    expect(screen.getByTestId("pip-mock")).toBeInTheDocument();
  });

  it("renders only the logo as home — no labelled 'Accueil' pill (F2)", () => {
    renderHeader({
      onMenuClick: () => {},
      onHomeClick: () => {},
      title: "Test",
    });
    expect(screen.queryByText("Accueil")).not.toBeInTheDocument();
    const homeButtons = screen.getAllByRole("button", {
      name: "Retour à l'accueil",
    });
    expect(homeButtons).toHaveLength(1);
  });

  it("applies line-clamp-1 to long titles (F9)", () => {
    const longTitle = "A".repeat(200);
    const { container } = renderHeader({
      onMenuClick: () => {},
      title: longTitle,
    });
    const titleEl = container.querySelector("p.line-clamp-1");
    expect(titleEl).toBeInTheDocument();
    expect(titleEl?.textContent).toBe(longTitle);
  });

  // ─── Wave 2c — Workspaces gating Expert/admin ─────────────────────────────
  it("shows Workspaces link when user.plan = expert", () => {
    mockUser = { plan: "expert", is_admin: false };
    renderHeader({ onMenuClick: () => {}, title: "Test" });
    const link = screen.getByTestId("hub-header-workspaces-link");
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe("/hub/workspaces");
  });

  it("shows Workspaces link when user.is_admin = true", () => {
    mockUser = { plan: "free", is_admin: true };
    renderHeader({ onMenuClick: () => {}, title: "Test" });
    expect(
      screen.getByTestId("hub-header-workspaces-link"),
    ).toBeInTheDocument();
  });

  it("hides Workspaces link for Pro users (non-Expert / non-admin)", () => {
    mockUser = { plan: "pro", is_admin: false };
    renderHeader({ onMenuClick: () => {}, title: "Test" });
    expect(
      screen.queryByTestId("hub-header-workspaces-link"),
    ).not.toBeInTheDocument();
  });
});
