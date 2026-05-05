import React, { useEffect, useRef } from "react";
import { useSemanticHighlight } from "./useSemanticHighlight";
import type { WithinMatch } from "../../services/api";

/**
 * Hard cap on the number of <mark> nodes rendered. Beyond this, performance
 * degrades quickly (DOM mutations + scroll-into-view) and the UX becomes noisy
 * — the user can refine the query instead.
 */
const MAX_MARKS = 50;

/**
 * Tags whose text content must NEVER be wrapped (preserves code blocks,
 * keyboard hints and pre-formatted text exactly as the author wrote them).
 */
const SKIP_PARENT_TAGS = new Set(["CODE", "PRE", "KBD"]);

/**
 * Stopwords ignored when falling back to query-word highlighting.
 * Short connectives that would either match noise or already be in
 * SKIP_PARENT_TAGS adjacency.
 */
const QUERY_STOPWORDS = new Set([
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "du",
  "de",
  "et",
  "ou",
  "est",
  "sont",
  "dans",
  "sur",
  "avec",
  "pour",
  "par",
  "que",
  "qui",
  "ce",
  "ces",
  "the",
  "and",
  "or",
  "of",
  "in",
  "on",
  "to",
  "for",
  "with",
  "is",
  "are",
  "this",
  "that",
  "these",
  "those",
]);

/** Extract significant query words (≥3 chars, not stopwords). */
function significantQueryWords(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[\s,;:!?'"().]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !QUERY_STOPWORDS.has(w));
}

interface Props {
  /** Tab identity — only matches for this tab are rendered */
  tab: WithinMatch["tab"];
  /** Click handler (passage_id) — typically opens ExplainTooltip */
  onMarkClick?: (passageId: string, passage: WithinMatch) => void;
  children: React.ReactNode;
}

/**
 * Wrapper that traverses children DOM after render and wraps text spans
 * matching `match.text` with <mark className="ds-highlight">.
 * Idempotent: clears previous marks on every effect run.
 */
export const HighlightedText: React.FC<Props> = ({
  tab,
  onMarkClick,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const ctx = useSemanticHighlight();

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    // 1. Strip previous marks (unwrap)
    root.querySelectorAll("mark.ds-highlight").forEach((m) => {
      const parent = m.parentNode;
      if (!parent) return;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      parent.normalize();
    });

    if (!ctx || ctx.matches.length === 0) return;

    // Hard cap — only consider the top-N matches. Backend already orders by
    // score, so this preserves the most relevant passages.
    const tabMatches = ctx.matches
      .filter((m) => m.tab === tab)
      .slice(0, MAX_MARKS);
    if (tabMatches.length === 0) return;

    // 2. Walk text nodes and wrap exact `text` occurrences. Skip nodes whose
    //    closest parent is a <code>, <pre>, or <kbd> — we never alter inline
    //    code blocks or keyboard hints.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        let parent: Node | null = n.parentNode;
        while (parent && parent !== root) {
          if (
            parent.nodeType === Node.ELEMENT_NODE &&
            SKIP_PARENT_TAGS.has((parent as Element).tagName)
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          parent = parent.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    // Significant query words are used as a fallback when the full passage
    // text isn't found as a contiguous text node (which is the common case
    // — markdown render fragments paragraphs into <strong>/<em>/<a> spans
    // so `indexOf(match.text)` rarely matches a full sentence).
    const queryWords = significantQueryWords(ctx.query);

    type Target = { node: Text; match: WithinMatch; term: string };
    const targets: Target[] = [];
    let node: Node | null = walker.nextNode();
    while (node && targets.length < MAX_MARKS) {
      const txt = node.nodeValue ?? "";
      const txtLower = txt.toLowerCase();
      let matched = false;

      // 1) Try exact passage text first (ideal case — single text node)
      for (const m of tabMatches) {
        if (txt.indexOf(m.text) >= 0) {
          targets.push({ node: node as Text, match: m, term: m.text });
          matched = true;
          break;
        }
      }

      // 2) Fallback : look for any significant query word in this node.
      //    Each occurrence becomes a separate <mark> associated with the
      //    first match whose passage text contains the same word (so the
      //    explain tooltip routes to a sensible passage).
      if (!matched && queryWords.length > 0) {
        for (const word of queryWords) {
          const idx = txtLower.indexOf(word);
          if (idx >= 0) {
            const term = txt.slice(idx, idx + word.length);
            const associatedMatch =
              tabMatches.find((m) => m.text.toLowerCase().includes(word)) ??
              tabMatches[0];
            targets.push({ node: node as Text, match: associatedMatch, term });
            break; // one mark per text node max in fallback mode
          }
        }
      }

      node = walker.nextNode();
    }

    targets.forEach(({ node: textNode, match, term }) => {
      const txt = textNode.nodeValue ?? "";
      // Use lowercased index lookup so the fallback (query word) is
      // case-insensitive but we preserve the original casing in the mark.
      const idx = txt.toLowerCase().indexOf(term.toLowerCase());
      if (idx < 0) return;
      const actualTerm = txt.slice(idx, idx + term.length);
      const before = txt.slice(0, idx);
      const after = txt.slice(idx + term.length);
      const parent = textNode.parentNode;
      if (!parent) return;
      const mark = document.createElement("mark");
      mark.className = "ds-highlight";
      mark.dataset.passageId = match.passage_id;
      mark.setAttribute(
        "aria-label",
        `Passage correspondant : ${match.text.slice(0, 60)}`,
      );
      mark.textContent = actualTerm;
      if (ctx.matches[ctx.currentIndex]?.passage_id === match.passage_id) {
        mark.classList.add("flash");
      }
      const fragment = document.createDocumentFragment();
      if (before) fragment.appendChild(document.createTextNode(before));
      fragment.appendChild(mark);
      if (after) fragment.appendChild(document.createTextNode(after));
      parent.replaceChild(fragment, textNode);
    });

    // 3. Auto-scroll to current
    if (
      ctx.currentIndex >= 0 &&
      tabMatches.includes(ctx.matches[ctx.currentIndex])
    ) {
      const target = root.querySelector<HTMLElement>(
        `mark.ds-highlight[data-passage-id="${ctx.matches[ctx.currentIndex].passage_id}"]`,
      );
      if (target && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }

    // 4. Wire click handlers
    if (onMarkClick) {
      const handler = (e: Event) => {
        const target = (e.target as HTMLElement).closest<HTMLElement>(
          "mark.ds-highlight",
        );
        if (!target) return;
        const id = target.dataset.passageId;
        if (!id) return;
        const match = ctx.matches.find((m) => m.passage_id === id);
        if (match) onMarkClick(id, match);
      };
      root.addEventListener("click", handler);
      return () => root.removeEventListener("click", handler);
    }
  }, [ctx?.matches, ctx?.currentIndex, ctx?.query, tab, onMarkClick, ctx]);

  return (
    <div ref={containerRef} data-highlight-tab={tab}>
      {children}
    </div>
  );
};
