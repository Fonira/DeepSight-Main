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
import { useTranslation } from "../../i18n/useTranslation";

interface Props {
  reason: "trial_used" | "monthly_quota" | "pro_no_voice";
  onUpgrade: () => void;
  onDismiss: () => void;
}

export function UpgradeCTA({
  reason,
  onUpgrade,
  onDismiss,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const cta = t.voiceCall.upgradeCta;
  const headline =
    reason === "trial_used"
      ? cta.trialUsedHeadline
      : reason === "monthly_quota"
        ? cta.monthlyQuotaHeadline
        : cta.proNoVoiceHeadline;
  const subline =
    reason === "trial_used"
      ? cta.trialUsedBody
      : reason === "monthly_quota"
        ? cta.monthlyQuotaBody
        : cta.proNoVoiceBody;
  return (
    <div className="ds-upgrade-cta" data-testid="ds-upgrade-cta">
      <div className="ds-upgrade-cta__emoji" aria-hidden>
        ✨
      </div>
      <h2>
        {headline}
        <br />
        {cta.headlineSuffix}
      </h2>
      <p>{subline}</p>
      <div className="ds-upgrade-cta__plan">
        <div className="ds-upgrade-cta__plan-header">
          <span className="ds-upgrade-cta__plan-name">{cta.planName}</span>
          <span className="ds-upgrade-cta__plan-price">
            {cta.planPrice}
            <span>{cta.planPeriod}</span>
          </span>
        </div>
        <ul>
          <li>{cta.feature1}</li>
          <li>{cta.feature2}</li>
          <li>{cta.feature3}</li>
        </ul>
      </div>
      <button
        type="button"
        className="ds-upgrade-cta__primary"
        onClick={onUpgrade}
      >
        {cta.ctaPrimary}
      </button>
      <button
        type="button"
        className="ds-upgrade-cta__dismiss"
        onClick={onDismiss}
      >
        {cta.ctaDismiss}
      </button>
    </div>
  );
}
