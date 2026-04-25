/**
 * 📋 CopyMessageButton — Compact "copy message" button for chat bubbles.
 *
 * Reusable across every chat surface (Chat IA, Débat IA, Quick Chat,
 * Playlist Corpus Chat, Floating Chat). Stays UI-only: no business logic.
 *
 * Behavior:
 *   - Click → copies `text` to the clipboard
 *   - Visual feedback: icon + label flip to "Copié !" / "Copied!" for ~2s
 *   - Falls back to `document.execCommand('copy')` via a hidden <textarea>
 *     when `navigator.clipboard.writeText` is unavailable / blocked
 *   - Accessible: aria-label, focus-visible ring, keyboard friendly
 *
 * Style:
 *   - Tailwind, 200ms transition
 *   - Default neutral colors → align with parent surface (text-white/30 → /60)
 *   - Override via `className` prop when a chat needs custom palette
 */
import React, { useCallback, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyMessageButtonProps {
  /** The text to copy to the clipboard (raw markdown / plain text). */
  text: string;
  /** Extra Tailwind classes (color, padding, font-size). */
  className?: string;
  /** Override the visible label. Defaults: "Copier" / "Copié !". */
  label?: string;
  /** Override the success label. Defaults: "Copié !". */
  successLabel?: string;
  /** UI language (drives default labels). */
  language?: "fr" | "en";
  /** Hide the textual label and only show the icon. */
  iconOnly?: boolean;
  /** Override aria-label. Defaults to "Copier le message" / "Copy message". */
  ariaLabel?: string;
  /** Optional callback fired after a successful copy. */
  onCopied?: () => void;
}

const FALLBACK_TIMEOUT_MS = 2000;

/**
 * Fallback clipboard write using a hidden textarea + document.execCommand.
 * Returns true on success, false otherwise.
 */
function legacyCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export const CopyMessageButton: React.FC<CopyMessageButtonProps> = ({
  text,
  className = "",
  label,
  successLabel,
  language = "fr",
  iconOnly = false,
  ariaLabel,
  onCopied,
}) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const t =
    language === "fr"
      ? { copy: "Copier", copied: "Copié !", aria: "Copier le message" }
      : { copy: "Copy", copied: "Copied!", aria: "Copy message" };

  const finalLabel = label ?? t.copy;
  const finalSuccessLabel = successLabel ?? t.copied;
  const finalAria = ariaLabel ?? t.aria;

  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      // Prevent surrounding click handlers (e.g. drag handles, focus traps)
      e.stopPropagation();
      e.preventDefault();

      const value = text ?? "";
      if (!value) return;

      let ok = false;
      try {
        if (
          typeof navigator !== "undefined" &&
          navigator.clipboard &&
          typeof navigator.clipboard.writeText === "function"
        ) {
          await navigator.clipboard.writeText(value);
          ok = true;
        } else {
          ok = legacyCopy(value);
        }
      } catch {
        ok = legacyCopy(value);
      }

      if (!ok) return;

      setCopied(true);
      onCopied?.();

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setCopied(false);
        timerRef.current = null;
      }, FALLBACK_TIMEOUT_MS);
    },
    [text, onCopied],
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={finalAria}
      aria-live="polite"
      title={copied ? finalSuccessLabel : finalLabel}
      className={
        // Base layout: small inline flex with subtle hover transition
        // Default colors are dim and lift on hover. Parent components can
        // override entirely via the `className` prop.
        "inline-flex items-center gap-1 rounded text-[11px] leading-none " +
        "transition-colors duration-200 outline-none " +
        "focus-visible:ring-1 focus-visible:ring-cyan-400/50 " +
        (copied ? "text-emerald-400" : "text-white/30 hover:text-white/70") +
        (className ? ` ${className}` : "")
      }
    >
      {copied ? (
        <Check className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
      ) : (
        <Copy className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
      )}
      {!iconOnly && <span>{copied ? finalSuccessLabel : finalLabel}</span>}
    </button>
  );
};

export default CopyMessageButton;
