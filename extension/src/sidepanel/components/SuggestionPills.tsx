import React from "react";
import { BeamCard } from "../shared/BeamCard";

export interface Suggestion {
  id: string;
  label: string;
  icon?: string; // emoji ou char ; rendered tel quel
  onTrigger: () => void;
}

interface Props {
  suggestions: Suggestion[];
}

const MAX_VISIBLE = 3;

/**
 * SuggestionPills — V3 cinematic chips row.
 *
 * Renders up to 3 contextual action chips below the primary video card in
 * MainView. Each chip uses the BeamCard pattern with a subtler beam intensity
 * for a compact appearance, preserving the V3 golden-beam visual signature
 * while staying visually quieter than the primary cards.
 *
 * Returns null when no suggestions are provided so MainView can render the
 * component unconditionally without producing empty markup.
 */
export const SuggestionPills: React.FC<Props> = ({ suggestions }) => {
  if (suggestions.length === 0) return null;

  const visible = suggestions.slice(0, MAX_VISIBLE);

  return (
    <div className="v3-suggestion-pills" role="group" aria-label="Suggestions">
      {visible.map((s) => (
        <BeamCard
          key={s.id}
          className="v3-suggestion-pill"
          onClick={s.onTrigger}
          ariaLabel={s.label}
          intensity={0.2}
          haloIntensity={0.15}
        >
          {s.icon && (
            <span className="v3-suggestion-pill-icon" aria-hidden="true">
              {s.icon}
            </span>
          )}
          <span className="v3-suggestion-pill-label">{s.label}</span>
        </BeamCard>
      ))}
    </div>
  );
};
