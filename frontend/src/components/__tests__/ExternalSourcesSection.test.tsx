/**
 * Tests ExternalSourcesSection — pages externes citées (spec PR3.5 web)
 * Spec : docs/superpowers/specs/2026-05-17-pages-externes-citees.md §9
 */

import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../__tests__/test-utils";
import { ExternalSourcesSection } from "../ExternalSourcesSection";
import type {
  ExternalPagesData,
  ExternalPageCitation,
} from "../../services/api";

const okPage = (over: Partial<ExternalPageCitation> = {}): ExternalPageCitation => ({
  url: "https://example.com/article",
  final_url: "https://example.com/article",
  title: "Un article exemple",
  summary:
    "Résumé Mistral de la page externe en 2-3 phrases pertinentes pour le viewer.",
  key_claims: ["Claim 1", "Claim 2"],
  status: "ok",
  fetched_via_proxy: false,
  bytes_fetched: 12_345,
  ...over,
});

const baseData: ExternalPagesData = {
  extracted_at: "2026-05-17T20:00:00Z",
  schema_version: 1,
  stats: {
    candidates_found: 3,
    after_dedup: 3,
    after_blacklist: 3,
    after_cap: 3,
    successful: 2,
    paywalled: 1,
    errored: 0,
  },
  pages: [
    okPage(),
    okPage({
      url: "https://example.org/paper",
      final_url: "https://example.org/paper",
      title: "Paper référencé",
    }),
    okPage({
      url: "https://nytimes.com/locked",
      final_url: "https://nytimes.com/locked",
      title: "Article payant",
      status: "paywall",
      summary: "",
      key_claims: [],
    }),
  ],
};

describe("ExternalSourcesSection", () => {
  it("affiche un CTA upgrade pour les users free", () => {
    renderWithProviders(
      <ExternalSourcesSection
        data={baseData}
        userPlan="free"
        language="fr"
      />,
    );
    expect(
      screen.getByTestId("external-sources-upgrade-cta"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("external-sources-section")).toBeNull();
  });

  it("ne rend rien si data est null côté Pro", () => {
    const { container } = renderWithProviders(
      <ExternalSourcesSection data={null} userPlan="pro" language="fr" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("ne rend rien si data.pages est vide côté Pro", () => {
    const empty: ExternalPagesData = { ...baseData, pages: [] };
    const { container } = renderWithProviders(
      <ExternalSourcesSection data={empty} userPlan="pro" language="fr" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("affiche la section complète pour un user Pro avec des pages valides", () => {
    renderWithProviders(
      <ExternalSourcesSection
        data={baseData}
        userPlan="pro"
        language="fr"
      />,
    );
    expect(
      screen.getByTestId("external-sources-section"),
    ).toBeInTheDocument();
    expect(screen.getByText("Sources externes citées")).toBeInTheDocument();
    expect(screen.getByText("2/3 pages traitées")).toBeInTheDocument();
    expect(screen.getAllByTestId("external-source-card")).toHaveLength(3);
  });

  it("rend la même chose pour Expert (cap géré côté backend, le payload arrive déjà capé)", () => {
    renderWithProviders(
      <ExternalSourcesSection
        data={baseData}
        userPlan="expert"
        language="fr"
      />,
    );
    expect(
      screen.getByTestId("external-sources-section"),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("external-source-card")).toHaveLength(3);
  });

  it("affiche le notice 'Article payant' pour status=paywall", () => {
    renderWithProviders(
      <ExternalSourcesSection
        data={baseData}
        userPlan="pro"
        language="fr"
      />,
    );
    expect(
      screen.getByText(/Article payant non accessible/i),
    ).toBeInTheDocument();
  });

  it("affiche le notice 'Page introuvable' pour status=http_error", () => {
    const data: ExternalPagesData = {
      ...baseData,
      pages: [okPage({ status: "http_error", summary: "", key_claims: [] })],
    };
    renderWithProviders(
      <ExternalSourcesSection data={data} userPlan="pro" language="fr" />,
    );
    expect(screen.getByText("Page introuvable")).toBeInTheDocument();
  });

  it("affiche le notice 'Contenu non extractible' pour status=timeout", () => {
    const data: ExternalPagesData = {
      ...baseData,
      pages: [okPage({ status: "timeout", summary: "", key_claims: [] })],
    };
    renderWithProviders(
      <ExternalSourcesSection data={data} userPlan="pro" language="fr" />,
    );
    expect(screen.getByText("Contenu non extractible")).toBeInTheDocument();
  });

  it("rend les labels anglais quand language=en", () => {
    renderWithProviders(
      <ExternalSourcesSection
        data={baseData}
        userPlan="pro"
        language="en"
      />,
    );
    expect(screen.getByText("External sources cited")).toBeInTheDocument();
    expect(screen.getByText("2/3 pages processed")).toBeInTheDocument();
    expect(screen.getAllByText("Open")).toHaveLength(3);
  });

  it("limite key_claims à 2 par card même si plus dans le payload", () => {
    const data: ExternalPagesData = {
      ...baseData,
      pages: [
        okPage({
          key_claims: ["A", "B", "C", "D", "E"],
        }),
      ],
    };
    renderWithProviders(
      <ExternalSourcesSection data={data} userPlan="pro" language="fr" />,
    );
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.queryByText("C")).toBeNull();
  });

  it("appelle onUpgradeClick quand le user free clique sur la CTA", async () => {
    const onUpgradeClick = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    renderWithProviders(
      <ExternalSourcesSection
        data={baseData}
        userPlan="free"
        language="fr"
        onUpgradeClick={onUpgradeClick}
      />,
    );
    await user.click(screen.getByTestId("external-sources-upgrade-cta"));
    expect(onUpgradeClick).toHaveBeenCalledTimes(1);
  });

  it("liens 'Ouvrir' ont target=_blank et rel=noopener noreferrer nofollow", () => {
    renderWithProviders(
      <ExternalSourcesSection
        data={baseData}
        userPlan="pro"
        language="fr"
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
      expect(link.getAttribute("rel")).toContain("noreferrer");
      expect(link.getAttribute("rel")).toContain("nofollow");
    });
  });
});
