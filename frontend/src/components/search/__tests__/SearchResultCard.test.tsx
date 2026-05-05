import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchResultCard } from "../SearchResultCard";
import type { GlobalSearchResult } from "../../../services/api";

afterEach(cleanup);

const mockResult: GlobalSearchResult = {
  source_type: "summary",
  source_id: 42,
  summary_id: 42,
  score: 0.91,
  text_preview:
    "La transition énergétique impose une refonte du mix électrique européen.",
  source_metadata: {
    summary_title: "Crise énergétique EU",
    channel: "Le Monde",
    summary_thumbnail: "https://img.example/thumb.jpg",
    tab: "synthesis",
  },
};

describe("SearchResultCard", () => {
  it("renders title, channel and score", () => {
    render(<SearchResultCard result={mockResult} query="" onOpen={() => {}} />);
    expect(screen.getByText("Crise énergétique EU")).toBeInTheDocument();
    expect(screen.getByText("Le Monde")).toBeInTheDocument();
    expect(screen.getByText(/score 91%/)).toBeInTheDocument();
  });

  it("renders the type badge", () => {
    render(<SearchResultCard result={mockResult} query="" onOpen={() => {}} />);
    expect(screen.getByText("Synthèse")).toBeInTheDocument();
  });

  it("calls onOpen when clicked", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <SearchResultCard result={mockResult} query="énergie" onOpen={onOpen} />,
    );
    await user.click(screen.getByTestId("search-result-card"));
    expect(onOpen).toHaveBeenCalledWith(mockResult);
  });

  it("highlights the query term in preview", () => {
    render(
      <SearchResultCard
        result={mockResult}
        query="transition"
        onOpen={() => {}}
      />,
    );
    const marks = document.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThan(0);
  });
});
