import React from "react";
import type { LucideIcon } from "lucide-react";

export interface PersonaCardProps {
  icon: LucideIcon;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}

export const PersonaCard: React.FC<PersonaCardProps> = ({
  icon: Icon,
  label,
  description,
  selected,
  onSelect,
}) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex flex-col items-start gap-2 p-4 rounded-xl border backdrop-blur-xl transition-all text-left ${
        selected
          ? "bg-accent-primary/15 border-accent-primary/40"
          : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]"
      }`}
    >
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          selected ? "bg-accent-primary/25" : "bg-white/[0.05]"
        }`}
      >
        <Icon
          className={`w-5 h-5 ${selected ? "text-accent-primary" : "text-text-tertiary"}`}
        />
      </div>
      <span className="text-sm font-semibold text-text-primary">{label}</span>
      <span className="text-xs text-text-tertiary">{description}</span>
    </button>
  );
};

export default PersonaCard;
