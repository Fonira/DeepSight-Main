/**
 * Tests PaperCard — badges sources (Scholar + Crossref ajoutés 2026-05-18)
 * Spec : docs/superpowers/specs/2026-05-17-google-scholar-deep-crawl.md §13.1
 */

import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../__tests__/test-utils";
import { PaperCard } from "../PaperCard";
import type { AcademicPaper } from "../../../services/api";

const basePaper: AcademicPaper = {
  id: "p-1",
  doi: "10.1000/test",
  title: "A test paper about epistemology",
  authors: [{ name: "Doe, J." }],
  year: 2024,
  venue: "Journal of Tests",
  abstract: "An abstract of the test paper.",
  citation_count: 42,
  url: "https://example.com/p-1",
  pdf_url: undefined,
  source: "semantic_scholar",
  relevance_score: 0.95,
  is_open_access: false,
  keywords: ["test"],
};

describe("PaperCard — source badges", () => {
  it("affiche le badge 'Semantic Scholar' pour source=semantic_scholar", () => {
    renderWithProviders(<PaperCard paper={basePaper} />);
    expect(screen.getByText("Semantic Scholar")).toBeInTheDocument();
  });

  it("affiche le badge 'OpenAlex' pour source=openalex", () => {
    renderWithProviders(
      <PaperCard paper={{ ...basePaper, source: "openalex" }} />,
    );
    expect(screen.getByText("OpenAlex")).toBeInTheDocument();
  });

  it("affiche le badge 'arXiv' pour source=arxiv", () => {
    renderWithProviders(
      <PaperCard paper={{ ...basePaper, source: "arxiv" }} />,
    );
    expect(screen.getByText("arXiv")).toBeInTheDocument();
  });

  it("affiche le badge 'Crossref' pour source=crossref", () => {
    renderWithProviders(
      <PaperCard paper={{ ...basePaper, source: "crossref" }} />,
    );
    expect(screen.getByText("Crossref")).toBeInTheDocument();
  });

  it("affiche le badge 'via Scholar' pour source=scholar", () => {
    renderWithProviders(
      <PaperCard paper={{ ...basePaper, source: "scholar" }} />,
    );
    expect(screen.getByText("via Scholar")).toBeInTheDocument();
  });
});
