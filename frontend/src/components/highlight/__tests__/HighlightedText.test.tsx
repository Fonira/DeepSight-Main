import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";
import { HighlightedText } from "../HighlightedText";
import { SemanticHighlightContext } from "../SemanticHighlightContext";
import type { WithinMatch } from "../../../services/api";

afterEach(cleanup);

const mockMatch: WithinMatch = {
  source_type: "summary",
  source_id: 1,
  text: "transition énergétique",
  text_html: "transition énergétique",
  start_offset: 0,
  end_offset: 22,
  tab: "synthesis",
  score: 0.91,
  passage_id: "p1",
};

const wrap =
  (matches: WithinMatch[], idx = 0) =>
  ({ children }: { children: React.ReactNode }) => (
    <SemanticHighlightContext.Provider
      value={{
        query: "transition",
        loading: false,
        matches,
        currentIndex: idx,
        activeTab: "synthesis",
        setQuery: () => {},
        close: () => {},
        next: () => {},
        prev: () => {},
        focus: () => {},
      }}
    >
      {children}
    </SemanticHighlightContext.Provider>
  );

describe("HighlightedText", () => {
  it("wraps a matching text span in <mark>", () => {
    const Wrapper = wrap([mockMatch]);
    const { container } = render(
      <Wrapper>
        <HighlightedText tab="synthesis">
          <p>La transition énergétique impose une refonte.</p>
        </HighlightedText>
      </Wrapper>,
    );
    const mark = container.querySelector("mark.ds-highlight");
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe("transition énergétique");
    expect(mark?.getAttribute("data-passage-id")).toBe("p1");
  });

  it("does not wrap when no matches", () => {
    const Wrapper = wrap([]);
    const { container } = render(
      <Wrapper>
        <HighlightedText tab="synthesis">
          <p>La transition énergétique.</p>
        </HighlightedText>
      </Wrapper>,
    );
    expect(container.querySelector("mark.ds-highlight")).toBeNull();
  });

  it("only wraps for matching tab", () => {
    const Wrapper = wrap([mockMatch]);
    const { container } = render(
      <Wrapper>
        <HighlightedText tab="quiz">
          <p>La transition énergétique.</p>
        </HighlightedText>
      </Wrapper>,
    );
    expect(container.querySelector("mark.ds-highlight")).toBeNull();
  });
});
