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
    render(
      <SummaryCollapsible context={ctx} onCitationClick={onCitationClick} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /résumé/i }));
    fireEvent.click(screen.getByText("02:14"));
    expect(onCitationClick).toHaveBeenCalledWith(134);
  });

  it("renders the citations panel already open when defaultOpen is true", () => {
    render(<SummaryCollapsible context={ctx} defaultOpen />);
    // Citations are only rendered while the panel is expanded — finding them
    // proves the panel mounted in the open state.
    expect(screen.getByText("02:14")).toBeInTheDocument();
    expect(screen.getByText("07:48")).toBeInTheDocument();
  });

  it("calls scrollIntoView at mount when defaultOpen is true", () => {
    const scrollSpy = vi.fn();
    // jsdom does not implement scrollIntoView; install a stub before render.
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      value: scrollSpy,
      configurable: true,
      writable: true,
    });
    render(<SummaryCollapsible context={ctx} defaultOpen />);
    expect(scrollSpy).toHaveBeenCalledWith({
      block: "center",
      behavior: "smooth",
    });
  });

  it("does not call scrollIntoView when defaultOpen is false", () => {
    const scrollSpy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      value: scrollSpy,
      configurable: true,
      writable: true,
    });
    render(<SummaryCollapsible context={ctx} />);
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // v2 visual additions: thumbnail + meta + markdown content
  // ─────────────────────────────────────────────────────────────────────────

  it("renders thumbnail image when video_thumbnail_url is provided", () => {
    const ctxWithThumb = {
      ...ctx,
      video_thumbnail_url: "https://example.com/thumb.jpg",
    };
    render(<SummaryCollapsible context={ctxWithThumb} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/thumb.jpg");
    expect(img).toHaveAttribute("alt", expect.stringMatching(/lex fridman/i));
  });

  it("renders fallback gradient when video_thumbnail_url is null", () => {
    render(<SummaryCollapsible context={ctx} />);
    // No <img> in the collapsed header, just the gradient placeholder div.
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders channel and formatted duration in collapsed meta", () => {
    // 1112 secs = 18:32
    render(<SummaryCollapsible context={ctx} />);
    expect(
      screen.getByText((content) => /lex.*18:32/i.test(content)),
    ).toBeInTheDocument();
  });

  it("formats duration over 1 hour as HH:MM:SS", () => {
    const longCtx = { ...ctx, video_duration_secs: 8580 }; // 2:23:00
    render(<SummaryCollapsible context={longCtx} />);
    expect(
      screen.getByText((content) => /2:23:00/.test(content)),
    ).toBeInTheDocument();
  });

  it("renders markdown content when expanded with markdown short_summary", () => {
    const mdCtx = {
      ...ctx,
      short_summary:
        "## Section\n\nContenu **important** ici. [02:14](#) suivi.",
      citations: [],
    };
    render(<SummaryCollapsible context={mdCtx} />);
    fireEvent.click(screen.getByRole("button", { name: /résumé/i }));
    expect(
      screen.getByRole("heading", { level: 2, name: /section/i }),
    ).toBeInTheDocument();
    // "important" apparaît à la fois dans le texte normal et dans le bold ;
    // on cible précisément l'élément STRONG via une fonction de matcher.
    const strong = screen.getByText(
      (_, el) => el?.tagName === "STRONG" && /important/i.test(el.textContent ?? ""),
    );
    expect(strong.tagName).toBe("STRONG");
  });

  it("renders timestamp markdown links as clickable citation pills", () => {
    const onCitationClick = vi.fn();
    const mdCtx = {
      ...ctx,
      short_summary: "Voir [02:14](#) pour le détail.",
      citations: [],
    };
    render(
      <SummaryCollapsible context={mdCtx} onCitationClick={onCitationClick} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /résumé/i }));
    const pill = screen.getByRole("button", { name: /02:14/ });
    fireEvent.click(pill);
    expect(onCitationClick).toHaveBeenCalledWith(134);
  });

  it("shows a loading placeholder when short_summary is empty", () => {
    const emptyCtx = { ...ctx, short_summary: "", citations: [] };
    render(<SummaryCollapsible context={emptyCtx} defaultOpen />);
    expect(
      screen.getByText(/résumé en cours de chargement/i),
    ).toBeInTheDocument();
  });
});
