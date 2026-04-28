// extension/src/sidepanel/components/CallActiveView.tsx
//
// Vue affichée pendant un voice call actif. Montre :
//   - Indicateur live + temps écoulé MM:SS
//   - Bouton ⚙ (header) → ouvre le drawer de réglages voix (live + hard staged)
//   - Pseudo-waveform (cosmétique)
//   - Bouton Mute (toggle micro côté navigateur)
//   - Bouton Raccrocher (déclenche endSession + UpgradeCTA si trial)
//
// A11y (N2) : aria-label sur les boutons d'action + role="timer" sur
// elapsed pour que les lecteurs d'écran annoncent le temps écoulé.
import React, { useState } from "react";
import { useTranslation } from "../../i18n/useTranslation";
import { VoiceSettingsDrawer } from "../VoiceSettingsDrawer";
import { useVoiceSettings } from "../useVoiceSettings";
import type { VoicePreferencesShape } from "../voiceMessages";
import type { VoiceTranscript } from "../types";
import { VoiceTranscriptList } from "./VoiceTranscriptList";

interface Props {
  elapsedSec: number;
  onMute: () => void;
  onHangup: () => void;
  /**
   * Optionnel : appelé après Apply quand un ou plusieurs HARD fields
   * (voix, modèle, stability…) ont changé. Le caller (VoiceView) doit
   * alors restart la session ElevenLabs pour que les nouveaux paramètres
   * prennent effet — restart silencieux qui préserve transcripts/timer.
   */
  onApplyHardChanges?: (changed: Partial<VoicePreferencesShape>) => void;
  /** True si un restart est en cours (affiche un indicateur pulse). */
  restarting?: boolean;
  /**
   * Transcripts collectés via le callback `onMessage` du SDK ElevenLabs.
   * Affichés en chat-style (bulles user/agent) entre la waveform et le
   * footer Mute/Raccrocher. Optionnel — défaut [] pour rétrocompat tests.
   */
  transcripts?: VoiceTranscript[];
}

export function CallActiveView({
  elapsedSec,
  onMute,
  onHangup,
  onApplyHardChanges,
  restarting = false,
  transcripts = [],
}: Props): JSX.Element {
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const settings = useVoiceSettings();
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
  const ss = String(elapsedSec % 60).padStart(2, "0");
  return (
    <div className="ds-call-active" data-testid="ds-call-active">
      <header className="ds-call-active__header">
        <div className="ds-call-active__indicator" aria-hidden />
        <span className="ds-call-active__label">
          {t.voiceCall.callActive.live}
        </span>
        <span className="ds-call-active__elapsed" role="timer" aria-live="off">
          · {mm}:{ss}
        </span>
        {restarting && (
          <span
            className="dsp-vs-restart-indicator"
            data-testid="voice-restarting"
            style={{ marginLeft: 8 }}
          >
            {t.voiceCall.callActive.applyingSettings ??
              "Réapplication des réglages…"}
          </span>
        )}
        <button
          type="button"
          className="dsp-voice-settings-btn"
          onClick={() => setDrawerOpen(true)}
          aria-label={
            t.voiceCall.callActive.settingsAriaLabel ?? "Réglages voix"
          }
          title={t.voiceCall.callActive.settingsAriaLabel ?? "Réglages voix"}
          data-testid="voice-settings-btn"
          style={{ marginLeft: "auto" }}
        >
          ⚙
        </button>
      </header>
      <div className="ds-call-active__waveform" aria-hidden>
        {[30, 80, 50, 90, 40, 70, 55].map((h, i) => (
          <span key={i} style={{ height: `${h}%` }} />
        ))}
      </div>
      <VoiceTranscriptList transcripts={transcripts} />
      <footer className="ds-call-active__footer">
        <button
          type="button"
          className="ds-call-active__mute"
          onClick={onMute}
          aria-label={t.voiceCall.callActive.muteAriaLabel}
        >
          {t.voiceCall.callActive.mute}
        </button>
        <button
          type="button"
          onClick={onHangup}
          className="ds-call-active__hangup ds-hangup"
          aria-label={t.voiceCall.callActive.hangupAriaLabel}
        >
          {t.voiceCall.callActive.hangup}
        </button>
      </footer>

      <VoiceSettingsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onApplyHardChanges={onApplyHardChanges}
        settings={settings}
      />
    </div>
  );
}
