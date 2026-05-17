/**
 * Tests CommunityTakeSection — verdict communauté (spec PR2 web)
 * Spec : docs/superpowers/specs/2026-05-17-comments-community-take.md §7.1
 */

import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../__tests__/test-utils";
import { CommunityTakeSection } from "../CommunityTakeSection";
import type { CommunityTake } from "../../services/api";

const baseTake: CommunityTake = {
  agreement_signal: "agree",
  sentiment_distribution: { positive: 0.6, neutral: 0.3, negative: 0.1 },
  controversies: ["Le sujet X reste contesté", "Source Y questionnée"],
  community_summary:
    "Majoritairement positif. Les commentateurs soutiennent l'analyse du créateur sur les points 1 et 3.",
  top_voices: [
    {
      author: "Un commentateur populaire",
      excerpt: "Très bonne analyse, je partage cet avis depuis longtemps.",
      stance: "agree",
      like_count: 8400,
    },
    {
      author: "Un autre commentateur",
      excerpt: "Nuance importante : il manque le contexte historique.",
      stance: "neutral",
      like_count: 320,
    },
  ],
  comments_analyzed: 142,
  model_used: "mistral-medium-2508",
};

describe("CommunityTakeSection", () => {
  it("affiche un CTA upgrade pour les users free", () => {
    renderWithProviders(
      <CommunityTakeSection
        take={baseTake}
        userPlan="free"
        language="fr"
      />,
    );
    expect(
      screen.getByTestId("community-take-upgrade-cta"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("community-take-section")).toBeNull();
  });

  it("ne rend rien si take est null/undefined côté Pro", () => {
    const { container } = renderWithProviders(
      <CommunityTakeSection
        take={null}
        userPlan="pro"
        language="fr"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("affiche la section complète pour un user Pro avec un take valide", () => {
    renderWithProviders(
      <CommunityTakeSection
        take={baseTake}
        userPlan="pro"
        language="fr"
      />,
    );
    expect(screen.getByTestId("community-take-section")).toBeInTheDocument();
    expect(screen.getByText("Verdict communauté")).toBeInTheDocument();
    expect(
      screen.getByText("Analyse de 142 commentaires"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("community-signal-badge")).toHaveTextContent(
      "Plutôt d'accord",
    );
    expect(screen.getByText(baseTake.community_summary)).toBeInTheDocument();
  });

  it("affiche la SentimentBar uniquement pour Expert", () => {
    const { rerender } = renderWithProviders(
      <CommunityTakeSection
        take={baseTake}
        userPlan="pro"
        language="fr"
      />,
    );
    expect(screen.queryByTestId("community-sentiment-bar")).toBeNull();

    rerender(
      <CommunityTakeSection
        take={baseTake}
        userPlan="expert"
        language="fr"
      />,
    );
    expect(
      screen.getByTestId("community-sentiment-bar"),
    ).toBeInTheDocument();
  });

  it("limite à 3 voix pour Pro et 5 pour Expert", () => {
    const manyVoices: CommunityTake = {
      ...baseTake,
      top_voices: Array.from({ length: 6 }, (_, i) => ({
        author: `User-${i}`,
        excerpt: `Avis numéro ${i}`,
        stance: "agree" as const,
        like_count: 100 - i,
      })),
    };

    const { rerender } = renderWithProviders(
      <CommunityTakeSection
        take={manyVoices}
        userPlan="pro"
        language="fr"
      />,
    );
    expect(screen.getAllByTestId("community-top-voice")).toHaveLength(3);

    rerender(
      <CommunityTakeSection
        take={manyVoices}
        userPlan="expert"
        language="fr"
      />,
    );
    expect(screen.getAllByTestId("community-top-voice")).toHaveLength(5);
  });

  it("affiche l'Empty state quand take.disabled = true", () => {
    const disabledTake: CommunityTake = {
      ...baseTake,
      disabled: true,
      community_summary: "",
      top_voices: [],
      controversies: [],
      comments_analyzed: 0,
    };
    renderWithProviders(
      <CommunityTakeSection
        take={disabledTake}
        userPlan="pro"
        language="fr"
      />,
    );
    expect(screen.getByTestId("community-take-empty")).toBeInTheDocument();
    expect(
      screen.getByText(/commentaires sont désactivés/i),
    ).toBeInTheDocument();
  });

  it("affiche l'Empty state quand take.insufficient_data = true", () => {
    const sparseTake: CommunityTake = {
      ...baseTake,
      insufficient_data: true,
      top_voices: [],
      controversies: [],
      comments_analyzed: 4,
    };
    renderWithProviders(
      <CommunityTakeSection
        take={sparseTake}
        userPlan="pro"
        language="fr"
      />,
    );
    expect(screen.getByTestId("community-take-empty")).toBeInTheDocument();
    expect(screen.getByText(/Trop peu/i)).toBeInTheDocument();
  });

  it("affiche les controversies (3 pour Pro, plus pour Expert)", () => {
    const takeWithControversies: CommunityTake = {
      ...baseTake,
      controversies: ["A", "B", "C", "D", "E"],
    };
    const { rerender } = renderWithProviders(
      <CommunityTakeSection
        take={takeWithControversies}
        userPlan="pro"
        language="fr"
      />,
    );
    expect(screen.getByText("Points de désaccord")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
    expect(screen.queryByText("D")).toBeNull();

    rerender(
      <CommunityTakeSection
        take={takeWithControversies}
        userPlan="expert"
        language="fr"
      />,
    );
    expect(screen.getByText("D")).toBeInTheDocument();
    expect(screen.getByText("E")).toBeInTheDocument();
  });

  it("affiche le badge truncated quand is_truncated = true", () => {
    const truncated: CommunityTake = { ...baseTake, is_truncated: true };
    renderWithProviders(
      <CommunityTakeSection
        take={truncated}
        userPlan="pro"
        language="fr"
      />,
    );
    expect(screen.getByText("Échantillon partiel")).toBeInTheDocument();
  });

  it("affiche les labels anglais quand language=en", () => {
    renderWithProviders(
      <CommunityTakeSection
        take={baseTake}
        userPlan="pro"
        language="en"
      />,
    );
    expect(screen.getByText("Community verdict")).toBeInTheDocument();
    expect(screen.getByTestId("community-signal-badge")).toHaveTextContent(
      "Mostly agree",
    );
    expect(screen.getByText(/Analysis of 142 comments/)).toBeInTheDocument();
  });

  it("appelle onUpgradeClick quand le user free clique sur la CTA", async () => {
    const onUpgradeClick = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    renderWithProviders(
      <CommunityTakeSection
        take={baseTake}
        userPlan="free"
        language="fr"
        onUpgradeClick={onUpgradeClick}
      />,
    );
    await user.click(screen.getByTestId("community-take-upgrade-cta"));
    expect(onUpgradeClick).toHaveBeenCalledTimes(1);
  });
});
