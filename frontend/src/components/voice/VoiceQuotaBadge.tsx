/**
 * VoiceQuotaBadge — Compact quota indicator for voice chat modal.
 * Displays minutes used / total with color-coded warning levels.
 */

import React from "react";

interface VoiceQuotaBadgeProps {
  minutesUsed: number;
  minutesTotal: number;
  /** Warning threshold reached */
  warningLevel?: 50 | 80 | 95 | 100 | null;
}

const formatTime = (minutes: number): string => {
  const mins = Math.floor(minutes);
  const secs = Math.round((minutes - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const getColorClass = (level: VoiceQuotaBadgeProps["warningLevel"]): string => {
  switch (level) {
    case 100:
      return "text-red-400 animate-pulse";
    case 95:
      return "text-orange-400";
    case 80:
      return "text-yellow-400";
    default:
      return "text-white/60";
  }
};

export const VoiceQuotaBadge: React.FC<VoiceQuotaBadgeProps> = React.memo(
  ({ minutesUsed, minutesTotal, warningLevel = null }) => {
    const colorClass = getColorClass(warningLevel);

    return (
      <div
        className={`inline-flex items-center gap-1.5 bg-white/5 rounded-full px-3 py-1 ${colorClass}`}
      >
        {/* Clock icon */}
        <svg
          className="w-3 h-3 flex-shrink-0"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle
            cx="8"
            cy="8"
            r="6.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M8 4.5V8L10.5 9.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-xs font-mono tabular-nums">
          {formatTime(minutesUsed)} / {formatTime(minutesTotal)}
        </span>
      </div>
    );
  },
);

VoiceQuotaBadge.displayName = "VoiceQuotaBadge";

export default VoiceQuotaBadge;
