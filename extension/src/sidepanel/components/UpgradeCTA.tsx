// extension/src/sidepanel/components/UpgradeCTA.tsx
//
// CTA d'upgrade post-call ou bloquant — pousse vers Expert (14.99€/mois)
// avec 30 min de voice call inclus.
//
// 3 reasons supportées :
//  - trial_used     → "Tu viens d'utiliser ton essai gratuit"
//  - monthly_quota  → "Tu as épuisé tes 30 min ce mois"
//  - pro_no_voice   → "Pro n'inclut pas le voice call"
import React from "react";

interface Props {
  reason: "trial_used" | "monthly_quota" | "pro_no_voice";
  onUpgrade: () => void;
  onDismiss: () => void;
}

const HEADLINE: Record<Props["reason"], string> = {
  trial_used: "Tu as adoré ?",
  monthly_quota: "Tu as épuisé ton quota",
  pro_no_voice: "Voice call exclusif Expert",
};

const SUBLINE: Record<Props["reason"], string> = {
  trial_used:
    "Tu viens d'utiliser ton essai gratuit. Upgrade vers Expert pour appeler n'importe quelle vidéo, autant que tu veux.",
  monthly_quota:
    "Tu as utilisé tes 30 min de voice call ce mois-ci. Patience jusqu'au mois prochain… ou upgrade pour plus.",
  pro_no_voice:
    "Le voice call est inclus uniquement dans le plan Expert (30 min/mois).",
};

export function UpgradeCTA({
  reason,
  onUpgrade,
  onDismiss,
}: Props): JSX.Element {
  return (
    <div className="ds-upgrade-cta" data-testid="ds-upgrade-cta">
      <div className="ds-upgrade-cta__emoji" aria-hidden>
        ✨
      </div>
      <h2>
        {HEADLINE[reason]}
        <br />
        Continue avec 30 min/mois
      </h2>
      <p>{SUBLINE[reason]}</p>
      <div className="ds-upgrade-cta__plan">
        <div className="ds-upgrade-cta__plan-header">
          <span className="ds-upgrade-cta__plan-name">Expert</span>
          <span className="ds-upgrade-cta__plan-price">
            14.99€<span>/mois</span>
          </span>
        </div>
        <ul>
          <li>✓ 30 min de voice call/mois</li>
          <li>✓ Analyses illimitées</li>
          <li>✓ Mind maps, web search, exports</li>
        </ul>
      </div>
      <button
        type="button"
        className="ds-upgrade-cta__primary"
        onClick={onUpgrade}
      >
        Passer en Expert →
      </button>
      <button
        type="button"
        className="ds-upgrade-cta__dismiss"
        onClick={onDismiss}
      >
        Continuer en Free (sans voice)
      </button>
    </div>
  );
}
