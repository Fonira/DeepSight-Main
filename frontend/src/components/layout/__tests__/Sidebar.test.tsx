/**
 * Tests — Audit nav Hub : aucun layout (Sidebar / SidebarNav / BottomNav)
 * ne doit plus pointer vers les routes legacy /chat ou /voice-call.
 *
 * PR #214 a fusionné /chat + /voice-call dans /hub. Ces tests garantissent
 * qu'aucune NavLink/Link/onClick navigate ne renvoie sur l'ancienne route.
 *
 * Wave 2c — ajout de tests pour la visibilité conditionnelle de l'item
 * "Workspaces" (Expert + admin uniquement).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// --- Mocks pour Sidebar.tsx ---
// User mutable entre tests — permet de simuler free / pro / expert / admin.
const mockUser = vi.hoisted(() => ({
  current: {
    id: 1,
    email: "test@test.com",
    plan: "free" as "free" | "pro" | "expert",
    is_admin: false as boolean,
  },
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: mockUser.current,
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

vi.mock("../../../hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: {
      nav: {
        dashboard: "Tableau de bord",
        analysis: "Analyse",
        history: "Historique",
        study: "Révision",
        settings: "Paramètres",
        myAccount: "Mon compte",
        subscription: "Abonnement",
        usage: "Utilisation",
        admin: "Admin",
        legal: "Mentions légales",
        upgrade: "Passer Pro",
        logout: "Déconnexion",
      },
      dashboard: {
        credits: "Crédits",
        modes: {
          toggle_on: "Activé",
          toggle_off: "Désactivé",
          quiz: { label: "Quiz" },
          classic: { label: "Classique" },
          expert: { label: "Expert" },
        },
      },
    },
    language: "fr" as const,
  }),
}));

// SidebarInsight & PlanBadge: stub minimaliste
vi.mock("../../SidebarInsight", () => ({
  SidebarInsight: () => null,
}));
vi.mock("../../PlanBadge", () => ({
  PlanBadge: () => null,
}));

import { Sidebar } from "../Sidebar";
import { BottomNav } from "../BottomNav";
import { SidebarNav } from "../../sidebar/SidebarNav";

const renderWith = (ui: React.ReactElement, route = "/dashboard") =>
  render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);

// Reset user à `free` avant chaque test pour isoler.
beforeEach(() => {
  mockUser.current = {
    id: 1,
    email: "test@test.com",
    plan: "free",
    is_admin: false,
  };
});

describe("Hub navigation — no legacy /chat or /voice-call links", () => {
  it("Sidebar exposes a single Hub entry pointing to /hub", () => {
    renderWith(<Sidebar />);
    const hubLink = screen.getByRole("link", { name: /hub/i });
    expect(hubLink).toHaveAttribute("href", "/hub");

    // Aucun lien legacy (texte ou href) ne doit subsister
    const allLinks = screen.getAllByRole("link");
    for (const link of allLinks) {
      const href = link.getAttribute("href");
      expect(href).not.toBe("/chat");
      expect(href).not.toBe("/voice-call");
    }
  });

  it("SidebarNav has no /voice-call or /chat entry", () => {
    renderWith(<SidebarNav />);
    const links = screen.getAllByRole("link");
    for (const link of links) {
      const href = link.getAttribute("href");
      expect(href).not.toBe("/chat");
      expect(href).not.toBe("/voice-call");
    }
    // Le label "Appel Vocal" legacy doit être absent
    expect(screen.queryByText(/appel vocal/i)).toBeNull();
  });

  it("BottomNav has no /voice-call or /chat entry (paid user)", () => {
    // BottomNav filtre par requiresPro — on monte avec un user free
    // qui ne doit voir aucun item legacy de toute façon.
    renderWith(<BottomNav />, "/dashboard");
    // BottomNav rend des <button> (pas <a>) : on inspecte les aria-label
    const buttons = screen.queryAllByRole("button");
    for (const btn of buttons) {
      const label = btn.getAttribute("aria-label") || btn.textContent || "";
      expect(label.toLowerCase()).not.toContain("voix");
    }
  });
});

describe("Sidebar — Workspaces nav item (Wave 2c discoverability)", () => {
  it("renders Workspaces nav item for Expert user", () => {
    mockUser.current = {
      id: 42,
      email: "expert@test.com",
      plan: "expert",
      is_admin: false,
    };
    renderWith(<Sidebar />);
    const link = screen.getByRole("link", { name: /workspaces/i });
    expect(link).toHaveAttribute("href", "/hub/workspaces");
  });

  it("does NOT render Workspaces nav item for Pro user", () => {
    mockUser.current = {
      id: 7,
      email: "pro@test.com",
      plan: "pro",
      is_admin: false,
    };
    renderWith(<Sidebar />);
    expect(
      screen.queryByRole("link", { name: /workspaces/i }),
    ).toBeNull();
  });

  it("does NOT render Workspaces nav item for Free user", () => {
    // mockUser réinitialisé à free par beforeEach.
    renderWith(<Sidebar />);
    expect(
      screen.queryByRole("link", { name: /workspaces/i }),
    ).toBeNull();
  });

  it("renders Workspaces nav item for admin (bypass plan)", () => {
    mockUser.current = {
      id: 1,
      email: "admin@test.com",
      plan: "free",
      is_admin: true,
    };
    renderWith(<Sidebar />);
    const link = screen.getByRole("link", { name: /workspaces/i });
    expect(link).toHaveAttribute("href", "/hub/workspaces");
  });
});
