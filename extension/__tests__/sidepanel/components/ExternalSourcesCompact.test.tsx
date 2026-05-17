/** @jest-environment jsdom */
//
// Tests — ExternalSourcesCompact (extension/src/sidepanel/components/ExternalSourcesCompact.tsx)
//
// Spec : docs/superpowers/specs/2026-05-17-pages-externes-citees.md §9.4
//
// Affiche les sources externes citées dans la description vidéo. Gate par plan :
//   - free   → CTA upgrade
//   - pro/expert → chips host + CTA web si > 3 pages

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExternalSourcesCompact } from "../../../src/sidepanel/components/ExternalSourcesCompact";
import Browser from "../../../src/utils/browser-polyfill";
import type {
  ExternalPagesData,
  ExternalPageCitation,
} from "../../../src/types";

const tabsCreateSpy = jest.spyOn(Browser.tabs, "create");

const okPage = (
  overrides: Partial<ExternalPageCitation> = {},
): ExternalPageCitation => ({
  url: "https://www.example.com/article",
  final_url: "https://www.example.com/article",
  title: "Example article",
  summary: "Mini-résumé Mistral de la page.",
  key_claims: ["Claim 1"],
  status: "ok",
  fetched_via_proxy: false,
  bytes_fetched: 12345,
  ...overrides,
});

const baseStats = {
  candidates_found: 0,
  after_dedup: 0,
  after_blacklist: 0,
  after_cap: 0,
  successful: 0,
  paywalled: 0,
  errored: 0,
};

const baseData = (pages: ExternalPageCitation[]): ExternalPagesData => ({
  extracted_at: "2026-05-17T12:00:00Z",
  schema_version: 1,
  stats: { ...baseStats, candidates_found: pages.length, successful: pages.filter((p) => p.status === "ok").length },
  pages,
});

describe("ExternalSourcesCompact", () => {
  beforeEach(() => tabsCreateSpy.mockClear());

  it("affiche un CTA upgrade pour les users free", () => {
    const data = baseData([okPage()]);
    render(
      <ExternalSourcesCompact data={data} summaryId={42} userPlanId="free" />,
    );
    expect(
      screen.getByTestId("external-sources-compact-free"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("external-sources-compact")).toBeNull();
  });

  it("CTA free → ouvre /upgrade dans un nouvel onglet", () => {
    const data = baseData([okPage()]);
    render(
      <ExternalSourcesCompact data={data} summaryId={42} userPlanId="free" />,
    );
    fireEvent.click(screen.getByTestId("external-sources-compact-free"));
    expect(tabsCreateSpy).toHaveBeenCalledWith({
      url: expect.stringContaining("/upgrade"),
    });
  });

  it("rend rien si data est null côté Pro", () => {
    const { container } = render(
      <ExternalSourcesCompact data={null} summaryId={42} userPlanId="pro" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("rend rien si pages est vide côté Pro", () => {
    const { container } = render(
      <ExternalSourcesCompact
        data={baseData([])}
        summaryId={42}
        userPlanId="pro"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("rend rien si aucune page n'a le status 'ok' côté Pro", () => {
    const data = baseData([
      okPage({ status: "paywall" }),
      okPage({ status: "http_error" }),
    ]);
    const { container } = render(
      <ExternalSourcesCompact data={data} summaryId={42} userPlanId="pro" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("affiche un chip avec le host extrait (www. retiré) côté Pro", () => {
    const data = baseData([
      okPage({
        final_url: "https://www.example.com/article",
        title: "An article",
      }),
    ]);
    render(
      <ExternalSourcesCompact data={data} summaryId={42} userPlanId="pro" />,
    );
    expect(
      screen.getByTestId("external-sources-compact"),
    ).toBeInTheDocument();
    const chip = screen.getByTestId("external-sources-compact-chip");
    expect(chip).toHaveTextContent("example.com");
    expect(chip).toHaveAttribute(
      "href",
      "https://www.example.com/article",
    );
    expect(chip).toHaveAttribute("target", "_blank");
    expect(chip).toHaveAttribute("rel", "noopener noreferrer nofollow");
  });

  it("affiche max 3 chips même si plus de pages 'ok'", () => {
    const data = baseData([
      okPage({ final_url: "https://a.com/x" }),
      okPage({ final_url: "https://b.com/x" }),
      okPage({ final_url: "https://c.com/x" }),
      okPage({ final_url: "https://d.com/x" }),
      okPage({ final_url: "https://e.com/x" }),
    ]);
    render(
      <ExternalSourcesCompact data={data} summaryId={42} userPlanId="pro" />,
    );
    expect(
      screen.getAllByTestId("external-sources-compact-chip"),
    ).toHaveLength(3);
  });

  it("affiche CTA 'view all' si data.pages.length > 3", () => {
    const data = baseData([
      okPage({ final_url: "https://a.com/x" }),
      okPage({ final_url: "https://b.com/x" }),
      okPage({ final_url: "https://c.com/x" }),
      okPage({ final_url: "https://d.com/x" }),
    ]);
    render(
      <ExternalSourcesCompact data={data} summaryId={777} userPlanId="pro" />,
    );
    const cta = screen.getByTestId("external-sources-compact-open-web");
    expect(cta).toBeInTheDocument();
    fireEvent.click(cta);
    expect(tabsCreateSpy).toHaveBeenCalledWith({
      url: expect.stringContaining("/hub/analysis/777"),
    });
  });

  it("n'affiche pas le CTA web si pages.length <= 3", () => {
    const data = baseData([
      okPage({ final_url: "https://a.com/x" }),
      okPage({ final_url: "https://b.com/x" }),
    ]);
    render(
      <ExternalSourcesCompact data={data} summaryId={42} userPlanId="pro" />,
    );
    expect(
      screen.queryByTestId("external-sources-compact-open-web"),
    ).toBeNull();
  });

  it("expert plan affiche les chips comme pro", () => {
    const data = baseData([okPage({ final_url: "https://expertcase.io/x" })]);
    render(
      <ExternalSourcesCompact data={data} summaryId={42} userPlanId="expert" />,
    );
    expect(
      screen.getByTestId("external-sources-compact"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("external-sources-compact-chip"),
    ).toHaveTextContent("expertcase.io");
  });

  it("ignore les pages avec URL invalide sans crasher", () => {
    const data = baseData([
      okPage({ final_url: "not-a-valid-url", url: "not-a-valid-url" }),
      okPage({ final_url: "https://valid.com/x" }),
    ]);
    render(
      <ExternalSourcesCompact data={data} summaryId={42} userPlanId="pro" />,
    );
    // Une chip seulement — l'URL invalide est silencieusement ignorée.
    expect(
      screen.getAllByTestId("external-sources-compact-chip"),
    ).toHaveLength(1);
  });

  it("filtre uniquement les pages 'ok' (paywall/error/etc. exclues)", () => {
    const data = baseData([
      okPage({ final_url: "https://ok1.com/x", status: "ok" }),
      okPage({ final_url: "https://paywall.com/x", status: "paywall" }),
      okPage({ final_url: "https://timeout.com/x", status: "timeout" }),
      okPage({ final_url: "https://ok2.com/x", status: "ok" }),
    ]);
    render(
      <ExternalSourcesCompact data={data} summaryId={42} userPlanId="pro" />,
    );
    const chips = screen.getAllByTestId("external-sources-compact-chip");
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveTextContent("ok1.com");
    expect(chips[1]).toHaveTextContent("ok2.com");
  });
});
