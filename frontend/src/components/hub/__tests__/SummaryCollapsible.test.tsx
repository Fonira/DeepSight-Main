// frontend/src/components/hub/__tests__/SummaryCollapsible.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SummaryCollapsible } from "../SummaryCollapsible";

const ctx = {
  summary_id: 1,
  video_title: "Lex Fridman",
  video_channel: "Lex",
  video_duration_secs: 1112,
  video_source: "youtube" as const,
  video_thumbnail_url: null,
  short_summary: "3 niveaux de conscience",
  citations: [
    { ts: 134, label: "phénoménale" },
    { ts: 468, label: "fonctionnelle" },
  ],
};

describe("SummaryCollapsible", () => {
  it("renders short summary when collapsed", () => {
    render(<SummaryCollapsible context={ctx} />);
    expect(screen.getByText(/3 niveaux de conscience/i)).toBeInTheDocument();
  });

  it("expands citations on toggle click", () => {
    render(<SummaryCollapsible context={ctx} />);
    const toggle = screen.getByRole("button", { name: /résumé/i });
    fireEvent.click(toggle);
    expect(screen.getByText("02:14")).toBeInTheDocument();
    expect(screen.getByText("07:48")).toBeInTheDocument();
  });

  it("calls onCitationClick with the citation timestamp", () => {
    const onCitationClick = vi.fn();
    render(<SummaryCollapsible context={ctx} onCitationClick={onCitationClick} />);
    fireEvent.click(screen.getByRole("button", { name: /résumé/i }));
    fireEvent.click(screen.getByText("02:14"));
    expect(onCitationClick).toHaveBeenCalledWith(134);
  });
});
