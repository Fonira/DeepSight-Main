// frontend/src/components/hub/HubHeader.tsx
import React from "react";
import { Link } from "react-router-dom";
import { Menu, Home } from "lucide-react";
import { DeepSightLogo } from "./DeepSightLogo";

interface Props {
  onMenuClick: () => void;
  /** When true, renders a "Tableau de bord" Link to /dashboard. */
  showDashboardLink?: boolean;
  title: string;
  subtitle?: string;
  /** Active conversation source — drives the inline platform icon in subtitle. */
  videoSource?: "youtube" | "tiktok" | null;
  pipSlot?: React.ReactNode;
}

const SOURCE_ICON: Record<"youtube" | "tiktok", { src: string; alt: string }> =
  {
    youtube: { src: "/platforms/youtube-icon-red.svg", alt: "YouTube" },
    tiktok: { src: "/platforms/tiktok-note-color.svg", alt: "TikTok" },
  };

export const HubHeader: React.FC<Props> = ({
  onMenuClick,
  showDashboardLink = true,
  title,
  subtitle,
  videoSource,
  pipSlot,
}) => {
  const sourceIcon =
    videoSource && SOURCE_ICON[videoSource] ? SOURCE_ICON[videoSource] : null;

  return (
    <header className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-white/10 bg-white/[0.02] backdrop-blur-xl sticky top-0 z-10">
      {showDashboardLink && (
        <Link
          to="/dashboard"
          aria-label="Retour au tableau de bord"
          className="h-9 px-3 flex items-center gap-2 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 hover:border-indigo-400/50 hover:text-indigo-200 transition-colors flex-shrink-0"
        >
          <Home className="w-4 h-4" />
          <span className="text-[13px] font-medium hidden sm:inline">
            Tableau de bord
          </span>
        </Link>
      )}
      <button
        type="button"
        aria-label="Conversations"
        onClick={onMenuClick}
        className="w-8 h-8 grid place-items-center rounded-lg text-white/65 hover:bg-white/[0.06] hover:text-white flex-shrink-0"
      >
        <Menu className="w-4 h-4" />
      </button>
      <DeepSightLogo size={36} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{title}</p>
        {subtitle && (
          <p className="font-mono text-[11px] text-white/45 truncate mt-0.5 flex items-center gap-1.5">
            {sourceIcon && (
              <img
                src={sourceIcon.src}
                alt={sourceIcon.alt}
                width={12}
                height={12}
                className="opacity-90 shrink-0"
              />
            )}
            <span className="truncate">{subtitle}</span>
          </p>
        )}
      </div>
      {pipSlot}
    </header>
  );
};
