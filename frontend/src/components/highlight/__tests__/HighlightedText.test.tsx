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

  it("falls back to query-word matching when current tab has no tab-specific match", () => {
    // mockMatch is on tab="synthesis"; when rendering tab="quiz", the
    // component no longer early-returns. Instead it uses the query-word
    // fallback so the search term is still highlighted on whichever tab the
    // user is currently viewing (see HighlightedText.tsx L112-119 rationale).
    const Wrapper = wrap([mockMatch]);
    const { container } = render(
      <Wrapper>
        <HighlightedText tab="quiz">
          <p>La transition énergétique.</p>
        </HighlightedText>
      </Wrapper>,
    );
    const mark = container.querySelector("mark.ds-highlight");
    expect(mark).not.toBeNull();
    // The matched term is the query word ("transition") regardless of tab.
    expect(mark?.textContent?.toLowerCase()).toContain("transition");
  });

  it("caps the number of marks rendered to 50 (hard cap)", () => {
    // Build 60 matches all targeting the same passage text — only 50 should be wrapped.
    const matches: WithinMatch[] = Array.from({ length: 60 }, (_, i) => ({
      ...mockMatch,
      passage_id: `cap-${i}`,
      text: `cap${i}`,
    }));
    const Wrapper = wrap(matches);
    const paragraphs = matches.map((m) => `<span>${m.text}</span>`).join(" ");
    const { container } = render(
      <Wrapper>
        <HighlightedText tab="synthesis">
          <p dangerouslySetInnerHTML={{ __html: paragraphs }} />
        </HighlightedText>
      </Wrapper>,
    );
    const marks = container.querySelectorAll("mark.ds-highlight");
    expect(marks.length).toBeLessThanOrEqual(50);
  });

  it("does not wrap text inside <code>, <pre> or <kbd>", () => {
    const Wrapper = wrap([mockMatch]);
    const { container } = render(
      <Wrapper>
        <HighlightedText tab="synthesis">
          <div>
            <p>La transition énergétique impose une refonte.</p>
            <pre>La transition énergétique appartient au pre.</pre>
            <code>La transition énergétique appartient au code.</code>
            <kbd>La transition énergétique appartient au kbd.</kbd>
          </div>
        </HighlightedText>
      </Wrapper>,
    );
    const marks = container.querySelectorAll("mark.ds-highlight");
    // Only the <p> match should be wrapped, not the pre/code/kbd ones.
    expect(marks.length).toBe(1);
    expect(marks[0].closest("pre")).toBeNull();
    expect(marks[0].closest("code")).toBeNull();
    expect(marks[0].closest("kbd")).toBeNull();
  });
});
