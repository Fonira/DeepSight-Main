/**
 * VoicePTTButton — Push-to-Talk button for voice chat
 *
 * Hold to talk, release to let the agent respond.
 * Uses onPointerDown/onPointerUp for mouse + touch compatibility.
 * Displays a pulsing red circle while the user is holding the button.
 */

import React, { useCallback, useRef } from "react";

interface VoicePTTButtonProps {
  onStartTalking: () => void;
  onStopTalking: () => void;
  isTalking: boolean;
  disabled?: boolean;
  /** Real-time mic amplitude [0, 1] — drives halo when isTalking. */
  micLevel?: number;
}

export const VoicePTTButton: React.FC<VoicePTTButtonProps> = ({
  onStartTalking,
  onStopTalking,
  isTalking,
  disabled = false,
  micLevel = 0,
}) => {
  const isHoldingRef = useRef(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      // Capture pointer to receive pointerup even if cursor leaves button
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      isHoldingRef.current = true;
      onStartTalking();
    },
    [disabled, onStartTalking],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isHoldingRef.current) return;
      e.preventDefault();
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      isHoldingRef.current = false;
      onStopTalking();
    },
    [onStopTalking],
  );

  // Safety: also handle pointer cancel (e.g., phone call interruption)
  const handlePointerCancel = useCallback(() => {
    if (isHoldingRef.current) {
      isHoldingRef.current = false;
      onStopTalking();
    }
  }, [onStopTalking]);

  // Halo scale reflects live mic amplitude so the user sees their voice
  // being captured in real time (not just a decorative pulse).
  const clampedLevel = Math.min(1, Math.max(0, micLevel));
  const haloScale = 1 + clampedLevel * 0.55;
  const haloOpacity = 0.25 + clampedLevel * 0.55;

  return (
    <div className="relative flex items-center justify-center">
      {/* Amplitude-driven rings when talking */}
      {isTalking && (
        <>
          <span
            className="absolute w-20 h-20 rounded-full bg-red-500/30 transition-[transform,opacity] duration-75 ease-out"
            style={{
              transform: `scale(${haloScale})`,
              opacity: haloOpacity,
            }}
            aria-hidden="true"
          />
          <span
            className="absolute w-24 h-24 rounded-full bg-red-500/15 animate-ping"
            style={{ animationDuration: "1.8s" }}
            aria-hidden="true"
          />
          {clampedLevel < 0.05 && (
            <span
              className="absolute w-28 h-28 rounded-full border border-red-300/40 animate-pulse"
              aria-hidden="true"
            />
          )}
        </>
      )}

      {/* Main button */}
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        disabled={disabled}
        className={`
          relative z-10 w-[72px] h-[72px] rounded-full flex items-center justify-center
          select-none touch-none transition-all duration-150 focus:outline-none
          ${
            disabled
              ? "bg-gray-600 cursor-not-allowed opacity-50"
              : isTalking
                ? "bg-red-500 shadow-lg shadow-red-500/40 scale-110"
                : "bg-indigo-500 hover:bg-indigo-400 shadow-lg shadow-indigo-500/30"
          }
        `}
        aria-label={
          isTalking ? "Relâchez pour envoyer" : "Maintenez pour parler"
        }
      >
        {/* Microphone icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`w-8 h-8 text-white transition-transform ${isTalking ? "scale-110" : ""}`}
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      </button>

      {/* Label */}
      <span className="absolute -bottom-6 text-xs text-gray-400 whitespace-nowrap select-none">
        {isTalking
          ? clampedLevel < 0.05
            ? "Parlez, je vous écoute…"
            : "Relâchez pour envoyer"
          : "Maintenez pour parler"}
      </span>
    </div>
  );
};

export default VoicePTTButton;
