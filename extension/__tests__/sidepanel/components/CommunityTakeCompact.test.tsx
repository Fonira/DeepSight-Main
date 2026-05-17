/** @jest-environment jsdom */
//
// Tests — CommunityTakeCompact (extension/src/sidepanel/components/CommunityTakeCompact.tsx)
//
// Spec : docs/superpowers/specs/2026-05-17-comments-community-take.md §7.3
//
// Affiche le verdict communauté compact dans la sidepanel. Gate par plan :
//   - free   → CTA upgrade
//   - pro/expert → ligne expandable + CTA web

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommunityTakeCompact } from "../../../src/sidepanel/components/CommunityTakeCompact";
import Browser from "../../../src/utils/browser-polyfill";
import type { CommunityTake } from "../../../src/types";

// Le chrome mock global (chrome-api-mock.ts) gère storage.sync, etc.
// On spy juste sur tabs.create pour vérifier les redirections.
const tabsCreateSpy = jest.spyOn(Browser.tabs, "create");

const baseTake: CommunityTake = {
  agreement_signal: "agree",
  sentiment_distribution: { positive: 0.6, neutral: 0.3, negative: 0.1 },
  controversies: ["Le point X reste contesté", "Source Y douteuse"],
  community_summary:
    "Majoritairement positif. Les commentateurs soutiennent l'analyse du créateur.",
  top_voices: [],
  comments_analyzed: 142,
  model_used: "mistral-medium-2508",
};

describe("CommunityTakeCompact", () => {
  beforeEach(() => tabsCreateSpy.mockClear());

  it("affiche un CTA upgrade pour les users free", () => {
    render(
      <CommunityTakeCompact take={baseTake} summaryId={42} userPlanId="free" />,
    );
    expect(screen.getByTestId("community-take-compact-free")).toBeInTheDocument();
    expect(screen.queryByTestId("community-take-compact")).toBeNull();
  });

  it("CTA free → ouvre /upgrade dans un nouvel onglet", () => {
    render(
      <CommunityTakeCompact take={baseTake} summaryId={42} userPlanId="free" />,
    );
    fireEvent.click(screen.getByTestId("community-take-compact-free"));
    expect(tabsCreateSpy).toHaveBeenCalledWith({
      url: expect.stringContaining("/upgrade"),
    });
  });

  it("rend rien si take est null côté Pro", () => {
    const { container } = render(
      <CommunityTakeCompact take={null} summaryId={42} userPlanId="pro" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("affiche la version compacte pour Pro avec take valide", () => {
    render(
      <CommunityTakeCompact take={baseTake} summaryId={42} userPlanId="pro" />,
    );
    expect(screen.getByTestId("community-take-compact")).toBeInTheDocument();
    expect(
      screen.getByText(/Plutôt d'accord/),
    ).toBeInTheDocument();
    // Not expanded by default → summary should not be visible
    expect(
      screen.queryByText(baseTake.community_summary),
    ).toBeNull();
  });

  it("expand → affiche le summary + CTA web", () => {
    render(
      <CommunityTakeCompact take={baseTake} summaryId={42} userPlanId="pro" />,
    );
    fireEvent.click(screen.getByTestId("community-take-compact-toggle"));
    expect(screen.getByText(baseTake.community_summary)).toBeInTheDocument();
    expect(
      screen.getByTestId("community-take-compact-open-web"),
    ).toBeInTheDocument();
  });

  it("expand puis click 'lire complet' → ouvre /hub/analysis/{id}", () => {
    render(
      <CommunityTakeCompact take={baseTake} summaryId={777} userPlanId="pro" />,
    );
    fireEvent.click(screen.getByTestId("community-take-compact-toggle"));
    fireEvent.click(screen.getByTestId("community-take-compact-open-web"));
    expect(tabsCreateSpy).toHaveBeenCalledWith({
      url: expect.stringContaining("/hub/analysis/777"),
    });
  });

  it("affiche les controversies (max 2) quand expanded", () => {
    const takeWithMany: CommunityTake = {
      ...baseTake,
      controversies: ["A controversy", "B controversy", "C controversy"],
    };
    render(
      <CommunityTakeCompact take={takeWithMany} summaryId={42} userPlanId="pro" />,
    );
    fireEvent.click(screen.getByTestId("community-take-compact-toggle"));
    expect(screen.getByText("A controversy")).toBeInTheDocument();
    expect(screen.getByText("B controversy")).toBeInTheDocument();
    expect(screen.queryByText("C controversy")).toBeNull();
  });

  it("affiche l'empty state pour disabled = true", () => {
    const disabledTake: CommunityTake = {
      ...baseTake,
      disabled: true,
      community_summary: "",
      controversies: [],
      comments_analyzed: 0,
    };
    render(
      <CommunityTakeCompact
        take={disabledTake}
        summaryId={42}
        userPlanId="pro"
      />,
    );
    expect(
      screen.getByTestId("community-take-compact-empty"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/désactivés/i),
    ).toBeInTheDocument();
  });

  it("affiche l'empty state pour insufficient_data", () => {
    const sparseTake: CommunityTake = {
      ...baseTake,
      insufficient_data: true,
      comments_analyzed: 3,
    };
    render(
      <CommunityTakeCompact
        take={sparseTake}
        summaryId={42}
        userPlanId="pro"
      />,
    );
    expect(
      screen.getByTestId("community-take-compact-empty"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Trop peu/i)).toBeInTheDocument();
  });
});
