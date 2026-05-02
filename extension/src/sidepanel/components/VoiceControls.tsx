// extension/src/sidepanel/components/VoiceControls.tsx
//
// Zone voice rendue UNIQUEMENT quand voiceMode != 'off'. Trois variantes :
//
//   voiceMode='live' :
//     [◉ MM:SS]   [🔇 Mute]   [⏹ End]
//
//   voiceMode='ended' :
//     ✅ Appel termine · X:XX
//     (rendu en parallèle par EndedToast — VoiceControls peut être null
//      pendant ce transitoire si on veut)
//
//   voiceMode='quota_exceeded' :
//     ⚠ Quota voice epuise — [Acheter des minutes]
//
// Le pattern matche §3 du spec (mobile mirror) : 2 boutons en mode live,
// confirm dialog côté Input pour le passage chat→call.

import React from "react";
import { WEBAPP_URL } from "../../utils/config";
import Browser from "../../utils/browser-polyfill";
import { useTranslation } from "../../i18n/useTranslation";

interface VoiceControlsProps {
  voiceMode: "off" | "live" | "ended" | "quota_exceeded";
  elapsedSec: number;
  isMuted: boolean;
  /** True quand le SDK ElevenLabs est connecté. Mute désactivé sinon. */
  conversationActive: boolean;
  onToggleMute: () => void;
  onHangup: () => void | Promise<void>;
}

function formatMMSS(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  voiceMode,
  elapsedSec,
  isMuted,
  conversationActive,
  onToggleMute,
  onHangup,
}) => {
  const { t } = useTranslation();

  if (voiceMode === "off" || voiceMode === "ended") return null;

  if (voiceMode === "quota_exceeded") {
    const handleUpgrade = (): void => {
      Browser.tabs.create({
        url: `${WEBAPP_URL}/upgrade?source=voice_call`,
      });
    };
    return (
      <div
        className="ds-voice-controls ds-voice-controls-quota"
        role="alert"
        data-testid="voice-controls-quota"
      >
        <span className="ds-voice-controls-label">
          {"⚠"} {t.voiceCall?.errors?.callEnded ?? "Quota voice atteint"}
        </span>
        <button
          type="button"
          className="v3-button-primary"
          onClick={handleUpgrade}
        >
          {t.common?.viewPlans ?? "Acheter des minutes"}
        </button>
      </div>
    );
  }

  // voiceMode === "live"
  return (
    <div
      className="ds-voice-controls ds-voice-controls-live"
      data-testid="voice-controls-live"
    >
      <div className="ds-voice-controls-status">
        <span className="ds-voice-controls-dot" aria-hidden="true" />
        <span
          className="ds-voice-controls-elapsed"
          role="timer"
          aria-label={`Duree d'appel ${formatMMSS(elapsedSec)}`}
        >
          {formatMMSS(elapsedSec)}
        </span>
      </div>
      <div className="ds-voice-controls-buttons">
        <button
          type="button"
          className={`ds-voice-controls-btn ds-voice-mute ${isMuted ? "is-muted" : ""}`}
          onClick={onToggleMute}
          disabled={!conversationActive}
          aria-pressed={isMuted}
          aria-label={isMuted ? "Activer le micro" : "Couper le micro"}
          data-testid="voice-controls-mute"
        >
          {isMuted ? "🔇" : "🔊"}
          <span className="ds-voice-controls-btn-label">
            {isMuted ? "Unmute" : "Mute"}
          </span>
        </button>
        <button
          type="button"
          className="ds-voice-controls-btn ds-voice-hangup"
          onClick={() => {
            void onHangup();
          }}
          aria-label="Raccrocher"
          data-testid="voice-controls-hangup"
        >
          {"⏹"}
          <span className="ds-voice-controls-btn-label">End</span>
        </button>
      </div>
    </div>
  );
};
