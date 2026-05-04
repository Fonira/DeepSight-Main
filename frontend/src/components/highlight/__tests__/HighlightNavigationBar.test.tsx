import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { HighlightNavigationBar } from "../HighlightNavigationBar";
import { SemanticHighlightContext } from "../SemanticHighlightContext";
import type { WithinMatch } from "../../../services/api";

afterEach(cleanup);

const mockMatch = (id: string): WithinMatch => ({
  source_type: "summary",
  source_id: 1,
  text: "x",
  text_html: "x",
  start_offset: 0,
  end_offset: 1,
  tab: "synthesis",
  score: 0.9,
  passage_id: id,
});

function withState(
  matches: WithinMatch[],
  idx = 0,
  fns: Partial<{ next: () => void; prev: () => void; close: () => void }> = {},
) {
  return ({ children }: { children: React.ReactNode }) => (
    <SemanticHighlightContext.Provider
      value={{
        query: "ai",
        loading: false,
        matches,
        currentIndex: idx,
        activeTab: "synthesis",
        setQuery: () => {},
        close: fns.close ?? (() => {}),
        next: fns.next ?? (() => {}),
        prev: fns.prev ?? (() => {}),
        focus: () => {},
      }}
    >
      {children}
    </SemanticHighlightContext.Provider>
  );
}

describe("HighlightNavigationBar", () => {
  it("returns null when no matches", () => {
    const Wrap = withState([]);
    const { container } = render(
      <Wrap>
        <HighlightNavigationBar />
      </Wrap>,
    );
    expect(container.querySelector("nav")).toBeNull();
  });

  it("displays counter '1/2'", () => {
    const Wrap = withState([mockMatch("a"), mockMatch("b")], 0);
    render(
      <Wrap>
        <HighlightNavigationBar />
      </Wrap>,
    );
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("calls next/prev/close when buttons clicked", async () => {
    const user = userEvent.setup();
    const next = vi.fn();
    const prev = vi.fn();
    const close = vi.fn();
    const Wrap = withState([mockMatch("a"), mockMatch("b")], 0, {
      next,
      prev,
      close,
    });
    render(
      <Wrap>
        <HighlightNavigationBar />
      </Wrap>,
    );
    await user.click(screen.getByLabelText(/match suivant/i));
    await user.click(screen.getByLabelText(/match précédent/i));
    await user.click(screen.getByLabelText(/fermer la recherche/i));
    expect(next).toHaveBeenCalled();
    expect(prev).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });
});
