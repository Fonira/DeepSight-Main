import React from "react";

interface Props {
  facts: string[];
}

export const FactCheckSection: React.FC<Props> = ({ facts }) => {
  if (!facts || facts.length === 0) return null;

  return (
    <section className="v-section">
      <h2 className="v-section-title">Faits à vérifier</h2>
      <div className="v-facts">
        {facts.map((fact, i) => (
          <div key={i} className="v-fact">
            <span className="v-fact-icon" aria-hidden="true">
              {"\uD83D\uDD0D"}
            </span>
            <span className="v-fact-text">{fact}</span>
          </div>
        ))}
      </div>
    </section>
  );
};
