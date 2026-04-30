import React from "react";

interface Props {
  plan: "free" | "etudiant" | "starter" | "pro" | "expert" | "equipe";
  creditsLeft: number;
  onUpgrade: () => void;
}

const PLAN_LABELS: Record<Props["plan"], string> = {
  free: "Gratuit",
  etudiant: "Pro",
  starter: "Pro",
  pro: "Pro",
  expert: "Expert",
  equipe: "Expert",
};

const PLAN_COLORS: Record<Props["plan"], { bg: string; fg: string }> = {
  free: { bg: "rgba(255,255,255,0.08)", fg: "rgba(255,255,255,0.7)" },
  etudiant: { bg: "rgba(59,130,246,0.18)", fg: "#60a5fa" },
  starter: { bg: "rgba(59,130,246,0.18)", fg: "#60a5fa" },
  pro: { bg: "rgba(59,130,246,0.18)", fg: "#60a5fa" },
  expert: { bg: "rgba(200,144,58,0.20)", fg: "#D4A054" },
  equipe: { bg: "rgba(200,144,58,0.20)", fg: "#D4A054" },
};

export function PlanBadge({
  plan,
  creditsLeft,
  onUpgrade,
}: Props): JSX.Element {
  const showUpgrade =
    plan === "free" || plan === "etudiant" || plan === "starter";
  const { bg, fg } = PLAN_COLORS[plan];

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
          background: bg,
          color: fg,
          padding: "2px 10px",
          borderRadius: 999,
          fontWeight: 600,
          letterSpacing: "0.02em",
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
            color: "#D4A054",
            cursor: "pointer",
            marginLeft: "auto",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Upgrade →
        </button>
      )}
    </div>
  );
}
