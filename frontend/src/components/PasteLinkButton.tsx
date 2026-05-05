/**
 * PasteLinkButton (web) — read clipboard, normalize as YouTube/TikTok URL,
 * insert raw or canonical text via onPaste, and surface a toast.
 *
 * Used by Hub InputBar, ChatPanel, ChatPopup, SmartInputBar.
 */

import React, { useCallback, useState } from "react";
import { Clipboard, Check } from "lucide-react";
import { normalizeVideoUrl } from "../utils/urlNormalizer";

export type PasteLinkFeedback =
  | { type: "youtube"; canonicalUrl: string }
  | { type: "tiktok"; canonicalUrl: string }
  | { type: "raw"; text: string }
  | { type: "empty" }
  | { type: "denied" };

export interface PasteLinkButtonProps {
  /** Called with the text inserted into the input (canonical URL when recognized, raw otherwise). */
  onPaste: (text: string) => void;
  /**
   * Optional toast callback — caller wires it to its own toast system.
   * If omitted, a 1.6s tooltip flash is shown next to the button.
   */
  showToast?: (
    message: string,
    type?: "success" | "error" | "info" | "warning",
  ) => void;
  /** Optional language for the default tooltip. Defaults to 'fr'. */
  language?: "fr" | "en";
  /** Compact: icon-only, 32×32. Default true (matches existing input bars). */
  compact?: boolean;
  /** Extra Tailwind classes for the button. */
  className?: string;
  disabled?: boolean;
}

const labels = {
  fr: {
    title: "Coller le lien",
    youtube: "Lien YouTube détecté",
    tiktok: "Lien TikTok détecté",
    raw: "Pas un lien vidéo reconnu",
    empty: "Presse-papiers vide",
    denied: "Accès au presse-papiers refusé",
  },
  en: {
    title: "Paste link",
    youtube: "YouTube link detected",
    tiktok: "TikTok link detected",
    raw: "Not a recognized video link",
    empty: "Clipboard is empty",
    denied: "Clipboard access denied",
  },
} as const;

export const PasteLinkButton: React.FC<PasteLinkButtonProps> = ({
  onPaste,
  showToast,
  language = "fr",
  compact = true,
  className = "",
  disabled = false,
}) => {
  const t = labels[language];
  const [flash, setFlash] = useState<string | null>(null);

  const flashTooltip = useCallback((msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 1600);
  }, []);

  const handleClick = useCallback(async () => {
    if (disabled) return;
    let raw = "";
    try {
      raw = await navigator.clipboard.readText();
    } catch {
      const msg = t.denied;
      if (showToast) showToast(msg, "error");
      else flashTooltip(msg);
      return;
    }
    const trimmed = (raw || "").trim();
    if (!trimmed) {
      const msg = t.empty;
      if (showToast) showToast(msg, "info");
      else flashTooltip(msg);
      return;
    }
    const normalized = normalizeVideoUrl(trimmed);
    if (normalized) {
      onPaste(normalized.canonicalUrl);
      const msg = normalized.platform === "youtube" ? t.youtube : t.tiktok;
      if (showToast) showToast(msg, "success");
      else flashTooltip(msg);
      return;
    }
    // Not a recognized video URL — still insert the raw text so user can edit.
    onPaste(trimmed);
    const msg = t.raw;
    if (showToast) showToast(msg, "warning");
    else flashTooltip(msg);
  }, [disabled, onPaste, showToast, t, flashTooltip]);

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={t.title}
        aria-label={t.title}
        className={
          compact
            ? `w-8 h-8 grid place-items-center rounded-full text-text-tertiary hover:text-text-secondary hover:bg-white/[0.06] transition-colors disabled:opacity-40 ${className}`
            : `inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-surface-secondary/60 hover:bg-surface-secondary border border-border-subtle text-text-tertiary hover:text-text-secondary transition-colors text-xs disabled:opacity-40 ${className}`
        }
        data-testid="paste-link-btn"
      >
        {flash ? (
          <Check className="w-4 h-4" />
        ) : (
          <Clipboard className="w-4 h-4" />
        )}
        {!compact && <span>{t.title}</span>}
      </button>
      {flash && !showToast && (
        <span
          role="status"
          className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 rounded-md bg-bg-elevated border border-white/10 text-[11px] text-text-primary shadow-lg z-50"
        >
          {flash}
        </span>
      )}
    </div>
  );
};

export default PasteLinkButton;
