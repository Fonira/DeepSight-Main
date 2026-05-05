import React from "react";

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
 * SuggestionPills — compact action chips row.
 *
 * Renders up to 3 contextual action chips below the primary video card in
 * MainView.
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
        <div
          key={s.id}
          className="v3-card v3-suggestion-pill"
          role="button"
          tabIndex={0}
          aria-label={s.label}
          onClick={s.onTrigger}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              s.onTrigger();
            }
          }}
        >
          {s.icon && (
            <span className="v3-suggestion-pill-icon" aria-hidden="true">
              {s.icon}
            </span>
          )}
          <span className="v3-suggestion-pill-label">{s.label}</span>
        </div>
      ))}
    </div>
  );
};
