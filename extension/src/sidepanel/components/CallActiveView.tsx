// extension/src/sidepanel/components/CallActiveView.tsx
//
// Vue affichée pendant un voice call actif. Montre :
//   - Chevron retour ‹ (header gauche) → onBack : raccroche + revient au pré-call
//   - Avatar agent (cercle initial + halo pulsant si agent speaking)
//   - Indicateur live + temps écoulé MM:SS
//   - Bouton ⚙ (header droit) → ouvre le drawer de réglages voix (live + hard staged)
//   - Waveform LIVE (32 bars animées via SDK getInputByteFrequencyData) avec
//     fallback statique si SDK pas dispo
//   - Liste des transcripts (chat-style)
//   - Input texte unifié → sendUserMessage(text) à l'agent ElevenLabs (V1.2)
//   - Bouton Mute (toggle micro côté navigateur) avec ICÔNE + COULEUR + ÉTAT
//   - Bouton Raccrocher (déclenche endSession + UpgradeCTA si trial)
//
// A11y (N2) : aria-label sur les boutons d'action + role="timer" sur
// elapsed pour que les lecteurs d'écran annoncent le temps écoulé.
// aria-pressed sur Mute pour annoncer l'état muté/actif.
import React, { useState } from "react";
import { useTranslation } from "../../i18n/useTranslation";
import { VoiceSettingsDrawer } from "../VoiceSettingsDrawer";
import { useVoiceSettings } from "../useVoiceSettings";
import type { VoicePreferencesShape } from "../voiceMessages";
import type { VoiceTranscript } from "../types";
import { VoiceTranscriptList } from "./VoiceTranscriptList";
import { VoiceWaveform } from "./VoiceWaveform";
import { AgentAvatar } from "./AgentAvatar";
import { DeepSightSpinner } from "../shared/DeepSightSpinner";
import type { ContextPhase } from "../hooks/useStreamingVideoContext";

interface Props {
  elapsedSec: number;
  onMute: () => void;
  onHangup: () => void;
  /**
   * V1.3 — État muté affiché dans le bouton micro. Sans cette prop le bouton
   * reste figé visuellement même quand le SDK setMicMuted() a accepté.
   */
  isMuted?: boolean;
  /**
   * V1.3 — Conversation active du SDK ElevenLabs. Permet à VoiceWaveform
   * d'appeler getInputByteFrequencyData() / getOutputByteFrequencyData() en RAF.
   * Permet aussi à AgentAvatar de détecter l'état "agent speaking" via le volume.
   */
  conversation?: {
    getInputByteFrequencyData?: () => Uint8Array | null;
    getOutputByteFrequencyData?: () => Uint8Array | null;
    getInputVolume?: () => number;
    getOutputVolume?: () => number;
  } | null;
  /**
   * V1.3 — Nom de la voix actuelle (pour l'avatar — affiche l'initiale).
   * Si vide, fallback sur emoji micro.
   */
  voiceName?: string;
  /**
   * V1.2 — Chevron retour : raccroche la session et revient au pré-call.
   * Le wiring (handleHangup + setState idle) se fait dans VoiceView.
   */
  onBack?: () => void;
  /**
   * V1.2 — Input texte unifié : appelé quand l'user soumet un message
   * texte. Le caller (VoiceView) doit appeler conversation.sendUserMessage(text)
   * + appendTranscript("user", text) pour que le message apparaisse dans
   * la timeline comme s'il avait été dit oralement.
   */
  onSendTextMessage?: (text: string) => void;
  /**
   * V1.2 — True si une session ElevenLabs est active (`conversation` non null).
   * L'input texte est désactivé sinon (pas de sendUserMessage possible).
   */
  canSendText?: boolean;
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
  /**
   * Phase du pipeline d'analyse côté backend (SSE). Tant que la phase n'est
   * pas "complete", un panneau central avec DeepSightSpinner XL + label
   * adaptatif est rendu sous le header. Le petit spinner du header reste
   * visible uniquement pendant la phase initiale "searching" pour redondance
   * — sans ça l'écran paraît figé pendant 5-30s.
   */
  analysisPhase?: ContextPhase;
  /** Chunks transcript reçus (pour le label "transcriptReceived"). */
  transcriptChunksReceived?: number;
  /** Total chunks transcript attendus (pour le label "transcriptReceived"). */
  transcriptChunksTotal?: number;
}

export function CallActiveView({
  elapsedSec,
  onMute,
  onHangup,
  isMuted = false,
  conversation = null,
  voiceName,
  onBack,
  onSendTextMessage,
  canSendText = true,
  onApplyHardChanges,
  restarting = false,
  transcripts = [],
  analysisPhase,
  transcriptChunksReceived = 0,
  transcriptChunksTotal = 0,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [textInput, setTextInput] = useState("");
  const settings = useVoiceSettings();
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
  const ss = String(elapsedSec % 60).padStart(2, "0");

  // Avatar prend le voice_name depuis settings si pas fourni en prop.
  // Why : conversation tab passe voiceName explicite ; tests le laissent vide.
  const effectiveVoiceName =
    voiceName ?? settings.effectivePrefs?.voice_name ?? undefined;

  const handleSubmitText = (e?: React.FormEvent): void => {
    e?.preventDefault();
    const trimmed = textInput.trim();
    if (!trimmed) return;
    if (!canSendText) return;
    onSendTextMessage?.(trimmed);
    setTextInput("");
  };

  return (
    <div
      className={`ds-call-active${isMuted ? " is-muted" : ""}`}
      data-testid="ds-call-active"
    >
      <header className="ds-call-active__header">
        {onBack && (
          <button
            type="button"
            className="dsp-voice-settings-btn ds-call-active__back"
            onClick={onBack}
            aria-label={t.voiceCall.callActive.backAriaLabel ?? "Retour"}
            title={t.voiceCall.callActive.backAriaLabel ?? "Retour"}
            data-testid="voice-back-btn"
          >
            ‹
          </button>
        )}
        <AgentAvatar
          voiceName={effectiveVoiceName}
          conversation={conversation}
        />
        <div className="ds-call-active__meta">
          <span className="ds-call-active__label">
            <span className="ds-call-active__indicator" aria-hidden />
            {t.voiceCall.callActive.live}
          </span>
          <span
            className="ds-call-active__elapsed"
            role="timer"
            aria-live="off"
          >
            {mm}:{ss}
          </span>
          {analysisPhase === "searching" && (
            <span
              className="ds-call-active__searching"
              data-testid="voice-searching-spinner"
            >
              <DeepSightSpinner
                size="xs"
                speed="fast"
                label={
                  t.voiceCall.ctxBar.phaseSearching ??
                  "Recherche du transcript…"
                }
              />
            </span>
          )}
        </div>
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
      {analysisPhase && analysisPhase !== "complete" && (
        <div
          className="ds-call-active__loading-panel"
          data-testid="voice-loading-panel"
          role="status"
          aria-live="polite"
        >
          <DeepSightSpinner
            size="md"
            speed="fast"
            showLabel
            showLogos
            label={(() => {
              switch (analysisPhase) {
                case "searching":
                  return t.voiceCall.ctxBar.phaseSearching;
                case "transcriptReceived":
                  return t.voiceCall.ctxBar.phaseTranscriptReceived
                    .replace("{n}", String(transcriptChunksReceived))
                    .replace("{total}", String(transcriptChunksTotal));
                case "mistralAnalyzing":
                  return t.voiceCall.ctxBar.phaseMistralAnalyzing;
                default:
                  return t.voiceCall.ctxBar.phaseSearching;
              }
            })()}
          />
        </div>
      )}
      <VoiceWaveform conversation={conversation} isMuted={isMuted} />
      <VoiceTranscriptList transcripts={transcripts} />
      <form
        className="ds-voice-text-input"
        onSubmit={handleSubmitText}
        data-testid="voice-text-input-form"
      >
        <input
          type="text"
          className="ds-voice-text-input__field"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder={
            t.voiceCall.callActive.textInputPlaceholder ?? "Tape ou parle…"
          }
          aria-label={
            t.voiceCall.callActive.textInputAriaLabel ??
            "Envoyer un message texte à l'agent"
          }
          disabled={!canSendText}
          data-testid="voice-text-input"
          autoComplete="off"
        />
        <button
          type="submit"
          className="ds-voice-text-input__send"
          disabled={!canSendText || textInput.trim().length === 0}
          aria-label={
            t.voiceCall.callActive.textInputSendAriaLabel ?? "Envoyer"
          }
          title={t.voiceCall.callActive.textInputSendAriaLabel ?? "Envoyer"}
          data-testid="voice-text-input-send"
        >
          ➤
        </button>
      </form>
      <footer className="ds-call-active__footer">
        <button
          type="button"
          className={`ds-call-active__mute${isMuted ? " is-muted" : ""}`}
          onClick={onMute}
          aria-pressed={isMuted}
          aria-label={
            isMuted
              ? (t.voiceCall.callActive.unmuteAriaLabel ?? "Activer le micro")
              : (t.voiceCall.callActive.muteAriaLabel ?? "Couper le micro")
          }
          data-testid="voice-mute-btn"
        >
          <span className="ds-call-active__mute-icon" aria-hidden>
            {isMuted ? "🚫" : "🎙️"}
          </span>
          <span className="ds-call-active__mute-label">
            {isMuted
              ? (t.voiceCall.callActive.unmute ?? "Activer")
              : (t.voiceCall.callActive.mute ?? "Couper")}
          </span>
        </button>
        <button
          type="button"
          onClick={onHangup}
          className="ds-call-active__hangup ds-hangup"
          aria-label={t.voiceCall.callActive.hangupAriaLabel}
          data-testid="voice-hangup-btn"
        >
          <span className="ds-call-active__hangup-icon" aria-hidden>
            ☎
          </span>
          <span className="ds-call-active__hangup-label">
            {t.voiceCall.callActive.hangup}
          </span>
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
