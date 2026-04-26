/**
 * VoiceCallButton — Header-variant "Appeler / Raccrocher" call toggle.
 *
 * Rendered in the ChatPage header (and reusable elsewhere). The "header"
 * variant is the prominent call button: bigger sizing (h-12, px-5), a
 * violet → blue gradient background, semibold base text and the
 * ElevenLabs logo on the left of the label.
 *
 * Visual identity: voice features use the violet accent across the app
 * (cf. VoiceOverlay header pill, voice transcript bubbles), so the call
 * button leans into that gradient as the strongest entry point.
 *
 * Accessibility:
 *  - role="button" via native <button>
 *  - aria-pressed reflects active call state
 *  - aria-label switches between "Appeler" and "Raccrocher"
 */

import React from "react";
import { Mic, PhoneOff } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// ElevenLabs logo — official "11" mark (two vertical bars).
// ═══════════════════════════════════════════════════════════════════════════════

interface ElevenLabsLogoProps {
  className?: string;
}

export const ElevenLabsLogo: React.FC<ElevenLabsLogoProps> = ({
  className,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="ElevenLabs"
    role="img"
  >
    <rect x="6" y="4" width="3" height="16" rx="1.5" />
    <rect x="15" y="4" width="3" height="16" rx="1.5" />
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// VoiceCallButton
// ═══════════════════════════════════════════════════════════════════════════════

export type VoiceCallButtonVariant = "header";

export interface VoiceCallButtonProps {
  /** Visual variant — currently only "header" but reserved for future use. */
  variant: VoiceCallButtonVariant;
  /** Whether a call is currently in progress (toggles label + style). */
  active: boolean;
  /** Click handler — toggles open/close of the voice overlay. */
  onClick: () => void;
  /** i18n: idle label, e.g. "Appeler" / "Call". */
  label: string;
  /** i18n: active label, e.g. "Raccrocher" / "Hang up". */
  endLabel: string;
  /** Disable interactions (e.g. plan-locked or quota-exhausted). */
  disabled?: boolean;
  /** Optional data-testid for test selectors. */
  testId?: string;
}

export const VoiceCallButton: React.FC<VoiceCallButtonProps> = ({
  variant,
  active,
  onClick,
  label,
  endLabel,
  disabled = false,
  testId,
}) => {
  // Currently only "header" — future variants would branch here.
  void variant;

  const ariaLabel = active ? endLabel : label;

  // Idle: violet → blue gradient (voice identity = violet, modulated to blue
  // for an inviting, calm-but-energetic call-to-action).
  // Active: red-tinted to communicate "press to end" affordance.
  const visualClasses = active
    ? "bg-gradient-to-r from-red-500/20 to-rose-500/20 border-red-400/40 text-red-100 hover:from-red-500/30 hover:to-rose-500/30"
    : "bg-gradient-to-r from-violet-500 to-blue-500 border-violet-400/50 text-white shadow-lg shadow-violet-500/20 hover:from-violet-400 hover:to-blue-400";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={ariaLabel}
      data-testid={testId ?? "voice-call-button"}
      className={`
        flex-shrink-0 inline-flex items-center gap-2.5
        h-12 px-5 rounded-xl
        text-base font-semibold
        border transition-all duration-200
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60
        disabled:opacity-50 disabled:cursor-not-allowed
        ${visualClasses}
      `}
    >
      {active ? (
        <>
          <PhoneOff className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">{endLabel}</span>
        </>
      ) : (
        <>
          <ElevenLabsLogo className="w-4 h-4" />
          <Mic className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">{label}</span>
        </>
      )}
    </button>
  );
};

export default VoiceCallButton;
