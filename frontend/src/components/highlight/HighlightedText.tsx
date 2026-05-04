import React, { useEffect, useRef } from "react";
import { useSemanticHighlight } from "./useSemanticHighlight";
import type { WithinMatch } from "../../services/api";

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

    const tabMatches = ctx.matches.filter((m) => m.tab === tab);
    if (tabMatches.length === 0) return;

    // 2. Walk text nodes and wrap exact `text` occurrences
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const targets: { node: Text; match: WithinMatch }[] = [];
    let node: Node | null = walker.nextNode();
    while (node) {
      const txt = node.nodeValue ?? "";
      for (const m of tabMatches) {
        const idx = txt.indexOf(m.text);
        if (idx >= 0) {
          targets.push({ node: node as Text, match: m });
          break;
        }
      }
      node = walker.nextNode();
    }

    targets.forEach(({ node: textNode, match }) => {
      const txt = textNode.nodeValue ?? "";
      const idx = txt.indexOf(match.text);
      if (idx < 0) return;
      const before = txt.slice(0, idx);
      const after = txt.slice(idx + match.text.length);
      const parent = textNode.parentNode;
      if (!parent) return;
      const mark = document.createElement("mark");
      mark.className = "ds-highlight";
      mark.dataset.passageId = match.passage_id;
      mark.setAttribute(
        "aria-label",
        `Passage correspondant : ${match.text.slice(0, 60)}`,
      );
      mark.textContent = match.text;
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
  }, [ctx?.matches, ctx?.currentIndex, tab, onMarkClick, ctx]);

  return (
    <div ref={containerRef} data-highlight-tab={tab}>
      {children}
    </div>
  );
};
