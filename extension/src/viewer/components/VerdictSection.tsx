import React from "react";

interface Props {
  verdict: string;
}

export const VerdictSection: React.FC<Props> = ({ verdict }) => {
  if (!verdict) return null;

  return (
    <section className="v-section v-section-verdict">
      <h2 className="v-section-title">Verdict</h2>
      <div className="v-verdict">{verdict}</div>
    </section>
  );
};
