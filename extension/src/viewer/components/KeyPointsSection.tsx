import React from "react";
import type { KeyPoint } from "../../utils/sanitize";

interface Props {
  points: KeyPoint[];
}

function keyPointIcon(type: KeyPoint["type"]): string {
  switch (type) {
    case "solid":
      return "\u2705";
    case "weak":
      return "\u26A0\uFE0F";
    case "insight":
      return "\u{1F4A1}";
  }
}

function keyPointClass(type: KeyPoint["type"]): string {
  switch (type) {
    case "solid":
      return "v-kp v-kp-solid";
    case "weak":
      return "v-kp v-kp-weak";
    case "insight":
      return "v-kp v-kp-default";
  }
}

export const KeyPointsSection: React.FC<Props> = ({ points }) => {
  if (!points || points.length === 0) return null;

  return (
    <section className="v-section">
      <h2 className="v-section-title">Points clés</h2>
      <div className="v-kp-list">
        {points.map((kp, i) => (
          <div key={i} className={keyPointClass(kp.type)}>
            <span className="v-kp-icon" aria-hidden="true">
              {keyPointIcon(kp.type)}
            </span>
            <span className="v-kp-text">{kp.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
};
