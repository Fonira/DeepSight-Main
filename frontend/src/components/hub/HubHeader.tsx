// frontend/src/components/hub/HubHeader.tsx
import React from "react";
import { Menu } from "lucide-react";

interface Props {
  onMenuClick: () => void;
  title: string;
  subtitle?: string;
  pipSlot?: React.ReactNode;
}

export const HubHeader: React.FC<Props> = ({
  onMenuClick,
  title,
  subtitle,
  pipSlot,
}) => {
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
      <div className="flex items-center gap-2">
        <img
          src="/deepsight-logo-cosmic.png"
          alt=""
          className="w-7 h-7 rounded-full opacity-80"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{title}</p>
        {subtitle && (
          <p className="font-mono text-[11px] text-white/45 truncate mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {pipSlot}
    </header>
  );
};
