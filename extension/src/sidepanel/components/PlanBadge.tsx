import React from "react";

interface Props {
  plan: "free" | "etudiant" | "starter" | "pro" | "equipe";
  creditsLeft: number;
  onUpgrade: () => void;
}

const PLAN_LABELS: Record<Props["plan"], string> = {
  free: "Découverte",
  etudiant: "Étudiant",
  starter: "Starter",
  pro: "Pro",
  equipe: "Équipe",
};

export function PlanBadge({ plan, creditsLeft, onUpgrade }: Props): JSX.Element {
  const showUpgrade = plan === "free" || plan === "etudiant";
  return (
    <div
      style={{
        padding: 12,
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
      }}
    >
      <span
        style={{
          background: "rgba(99,102,241,0.2)",
          color: "#818cf8",
          padding: "2px 8px",
          borderRadius: 12,
        }}
      >
        {PLAN_LABELS[plan]}
      </span>
      <span style={{ opacity: 0.6 }}>{creditsLeft} crédits restants</span>
      {showUpgrade && (
        <button
          onClick={onUpgrade}
          style={{
            background: "transparent",
            border: "none",
            color: "#818cf8",
            cursor: "pointer",
            marginLeft: "auto",
            fontSize: 12,
          }}
        >
          Upgrade →
        </button>
      )}
    </div>
  );
}
