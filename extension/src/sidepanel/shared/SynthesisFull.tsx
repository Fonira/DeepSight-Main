import React from "react";
import type { Summary } from "../../types";
import { escapeHtml, markdownToFullHtml } from "../../utils/sanitize";
import Browser from "../../utils/browser-polyfill";
import { WEBAPP_URL } from "../../utils/config";
import { BackIcon, ChatIcon, ExternalLinkIcon } from "./Icons";
import { useTranslation } from "../../i18n/useTranslation";

interface Props {
  summary: Summary;
  summaryId: number;
  onBack: () => void;
  onOpenChat: () => void;
}

/**
 * Full-screen digest view: sticky header (back + truncated title + chat
 * shortcut) over a scrollable markdown body that fills the side panel.
 * Padding uses `clamp(16px, 3vw, 32px)` so the text breathes as the user
 * resizes the panel — same component pattern as the DigestRoute on the
 * router refactor branch but here it's driven by a parent state flag in
 * MainView instead of a router push.
 */
export const SynthesisFull: React.FC<Props> = ({
  summary,
  summaryId,
  onBack,
  onOpenChat,
}) => {
  const { t } = useTranslation();
  const detailedHtml = markdownToFullHtml(
    escapeHtml(summary.summary_content),
  );

  const truncatedTitle =
    summary.video_title.length > 60
      ? summary.video_title.slice(0, 58) + "…"
      : summary.video_title;

  return (
    <div className="digest-view">
      <header className="digest-header">
        <button
          className="digest-back"
          onClick={onBack}
          aria-label="Retour"
          title="Retour"
        >
          <BackIcon size={16} />
        </button>
        <span className="digest-title" title={summary.video_title}>
          {truncatedTitle}
        </span>
        <button
          className="digest-chat-btn"
          onClick={onOpenChat}
          aria-label={t.synthesis.chat}
          title={t.synthesis.chat}
        >
          <ChatIcon size={16} />
        </button>
      </header>

      <div
        className="digest-body"
        dangerouslySetInnerHTML={{ __html: detailedHtml }}
      />

      <a
        href={`${WEBAPP_URL}/summary/${summaryId}`}
        target="_blank"
        rel="noreferrer"
        className="digest-web-cta"
        onClick={(e) => {
          e.preventDefault();
          Browser.tabs.create({ url: `${WEBAPP_URL}/summary/${summaryId}` });
        }}
      >
        <ExternalLinkIcon size={14} />
        <span>{t.synthesis.fullAnalysis}</span>
      </a>
    </div>
  );
};
