import React, { useMemo } from "react";
import { escapeHtml, markdownToFullHtml } from "../../utils/sanitize";

interface Props {
  content: string;
}

/**
 * Replaces `[mm:ss]` or `[hh:mm:ss]` patterns with clickable timestamp spans
 * in an already-sanitized HTML string. Uses a safe post-processing pass:
 * we only match digit-only fragments already escaped by `escapeHtml`.
 */
function linkifyTimestamps(html: string): string {
  return html.replace(
    /\[((?:\d{1,2}:){1,2}\d{2})\]/g,
    (_match, ts: string) =>
      `<span class="v-timestamp" data-ts="${ts}" role="button" tabindex="0">${ts}</span>`,
  );
}

export const DetailedAnalysis: React.FC<Props> = ({ content }) => {
  const html = useMemo(() => {
    if (!content) return "";
    const escaped = escapeHtml(content);
    const base = markdownToFullHtml(escaped);
    return linkifyTimestamps(base);
  }, [content]);

  if (!html) return null;

  return (
    <section className="v-section">
      <h2 className="v-section-title">Analyse détaillée</h2>
      <div className="v-markdown" dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
};
