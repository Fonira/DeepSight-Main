// frontend/src/components/hub/HubHeader.tsx
import React from "react";
import { Menu } from "lucide-react";
import { DeepSightLogo } from "./DeepSightLogo";

interface Props {
  onMenuClick: () => void;
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
  title,
  subtitle,
  videoSource,
  pipSlot,
}) => {
  const sourceIcon =
    videoSource && SOURCE_ICON[videoSource] ? SOURCE_ICON[videoSource] : null;

  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.02] backdrop-blur-xl sticky top-0 z-10">
      <button
        type="button"
        aria-label="Conversations"
        onClick={onMenuClick}
        className="w-8 h-8 grid place-items-center rounded-lg text-white/65 hover:bg-white/[0.06] hover:text-white"
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
