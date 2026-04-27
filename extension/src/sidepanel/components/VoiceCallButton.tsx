// extension/src/sidepanel/components/VoiceCallButton.tsx
//
// Composant React natif "Appel rapide" — placement à côté du bouton
// Analyser cette vidéo, même proéminence visuelle (taille / radius / font),
// gradient violet/rose pour différencier visuellement.
//
// Click → chrome.runtime.sendMessage({ type: "OPEN_VOICE_CALL", … }) au
// service worker, qui ouvre le side panel et stocke le contexte vidéo.
//
// Affichage conditionnel :
//   - Pas de videoId → null (le bouton n'a pas de sens hors d'une page vidéo)
//   - free + !trialUsed → badge "1 essai gratuit"
//   - free + trialUsed  → bouton désactivé "Essai utilisé"
//   - pro               → CTA upgrade (Pro n'a pas voice call dans le mix A+D)
//   - expert            → "X min restantes" (sur 30 min/mois)
import React from "react";
import Browser from "../../utils/browser-polyfill";
import { useTranslation } from "../../i18n/useTranslation";

const EXPERT_MONTHLY_MIN = 30;

export interface VoiceCallButtonProps {
  plan: "free" | "pro" | "expert";
  trialUsed?: boolean;
  monthlyMinutesUsed?: number;
  videoId?: string;
  videoTitle?: string;
}

export const VoiceCallButton: React.FC<VoiceCallButtonProps> = ({
  plan,
  trialUsed,
  monthlyMinutesUsed,
  videoId,
  videoTitle,
}) => {
  const { t } = useTranslation();
  if (!videoId) return null;

  const isDisabled = plan === "free" && trialUsed === true;

  // [N5] Math.max protège contre overflow si backend renvoie used > quota
  // (race condition consume_voice_minutes ; mieux afficher 0 que -5).
  const remainingMinutes = Math.max(
    0,
    EXPERT_MONTHLY_MIN - (monthlyMinutesUsed ?? 0),
  );

  let badge: string | null = null;
  if (plan === "free" && !trialUsed) badge = t.voiceCall.trialBadge;
  else if (plan === "free" && trialUsed) badge = t.voiceCall.trialUsed;
  else if (plan === "expert") {
    badge = t.voiceCall.minutesRemaining.replace(
      "{count}",
      String(remainingMinutes),
    );
  } else if (plan === "pro") badge = t.voiceCall.upgradeBadge;

  const handleClick = (): void => {
    if (isDisabled) return;
    Browser.runtime
      .sendMessage({
        type: "OPEN_VOICE_CALL",
        videoId,
        videoTitle,
        plan, // [N3] propagation pour PostHog voice_call_started.
      })
      .catch(() => {
        // Service worker peut ne pas répondre — silencieux côté UI.
      });
  };

  return (
    <button
      type="button"
      className={
        isDisabled ? "voice-call-btn voice-call-btn-disabled" : "voice-call-btn"
      }
      disabled={isDisabled}
      onClick={handleClick}
      title={isDisabled ? t.voiceCall.trialUsedTitle : undefined}
      aria-label={t.voiceCall.buttonAriaLabel}
      data-testid="voice-call-btn"
    >
      <span className="voice-call-btn-label">
        <span aria-hidden>🎙️</span>
        <span>{t.voiceCall.buttonLabel}</span>
      </span>
      {badge && <span className="voice-call-btn-badge">{badge}</span>}
    </button>
  );
};
