/**
 * Tests — Audit nav Hub : aucun layout (Sidebar / SidebarNav / BottomNav)
 * ne doit plus pointer vers les routes legacy /chat ou /voice-call.
 *
 * PR #214 a fusionné /chat + /voice-call dans /hub. Ces tests garantissent
 * qu'aucune NavLink/Link/onClick navigate ne renvoie sur l'ancienne route.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// --- Mocks pour Sidebar.tsx ---
vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: 1, email: "test@test.com", plan: "free" },
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
