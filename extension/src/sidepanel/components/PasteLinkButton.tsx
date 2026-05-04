/**
 * PasteLinkButton (extension sidepanel) — read clipboard, normalize as
 * YouTube/TikTok URL, insert via onPaste, surface inline tooltip feedback.
 *
 * Manifest V3 needs `clipboardRead` permission (added in public/manifest.json).
 * navigator.clipboard.readText() works inside the side panel because it runs
 * in an extension page (chrome-extension://) with user gesture.
 */

import React, { useCallback, useState } from "react";
import { normalizeVideoUrl } from "../../utils/urlNormalizer";

const ClipboardIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="2" width="6" height="4" rx="1" />
    <path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3" />
  </svg>
);

const CheckIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

interface Labels {
  title: string;
  youtube: string;
  tiktok: string;
  raw: string;
  empty: string;
  denied: string;
}

const LABELS_FR: Labels = {
  title: "Coller le lien",
  youtube: "Lien YouTube détecté",
  tiktok: "Lien TikTok détecté",
  raw: "Pas un lien vidéo reconnu",
  empty: "Presse-papiers vide",
  denied: "Accès au presse-papiers refusé",
};

const LABELS_EN: Labels = {
  title: "Paste link",
  youtube: "YouTube link detected",
  tiktok: "TikTok link detected",
  raw: "Not a recognized video link",
  empty: "Clipboard is empty",
  denied: "Clipboard access denied",
};

export interface PasteLinkButtonProps {
  /** Called with text to insert (canonical URL when recognized, raw text otherwise). */
  onPaste: (text: string) => void;
  /** UI language. Default 'fr'. */
  language?: "fr" | "en";
  disabled?: boolean;
}

export const PasteLinkButton: React.FC<PasteLinkButtonProps> = ({
  onPaste,
  language = "fr",
  disabled = false,
}) => {
  const t = language === "en" ? LABELS_EN : LABELS_FR;
  const [flash, setFlash] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const flashTooltip = useCallback((msg: string, ok: boolean) => {
    setFlash(msg);
    setSuccess(ok);
    setTimeout(() => {
      setFlash(null);
      setSuccess(false);
    }, 1600);
  }, []);

  const handleClick = useCallback(async () => {
    if (disabled) return;
    let raw = "";
    try {
      raw = await navigator.clipboard.readText();
    } catch {
      flashTooltip(t.denied, false);
      return;
    }
    const trimmed = (raw || "").trim();
    if (!trimmed) {
      flashTooltip(t.empty, false);
      return;
    }
    const normalized = normalizeVideoUrl(trimmed);
    if (normalized) {
      onPaste(normalized.canonicalUrl);
      flashTooltip(
        normalized.platform === "youtube" ? t.youtube : t.tiktok,
        true,
      );
      return;
    }
    onPaste(trimmed);
    flashTooltip(t.raw, false);
  }, [disabled, onPaste, t, flashTooltip]);

  return (
    <div className="paste-link-wrap" style={{ position: "relative" }}>
      <button
        type="button"
        className={`chat-paste-btn ${success ? "chat-paste-success" : ""}`}
        onClick={handleClick}
        disabled={disabled}
        title={t.title}
        aria-label={t.title}
        data-testid="paste-link-btn"
      >
        {success ? <CheckIcon size={14} /> : <ClipboardIcon size={14} />}
      </button>
      {flash && (
        <span
          role="status"
          className="chat-paste-tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "4px 8px",
            borderRadius: 6,
            fontSize: 11,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            background: "var(--bg-elevated, #1a1a22)",
            color: "var(--text-primary, #f1f5f9)",
            border: "1px solid var(--border, rgba(255,255,255,.1))",
            boxShadow: "0 4px 12px rgba(0,0,0,.4)",
            pointerEvents: "none",
            zIndex: 50,
          }}
        >
          {flash}
        </span>
      )}
    </div>
  );
};

export default PasteLinkButton;
