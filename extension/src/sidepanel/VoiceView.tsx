import React, { useCallback, useEffect, useRef, useState } from "react";
import { useExtensionVoiceChat } from "./useExtensionVoiceChat";
import { useVoiceSettings } from "./useVoiceSettings";
import { VoiceSettingsDrawer } from "./VoiceSettingsDrawer";
import { pickAgentType, type VoicePanelContext } from "./types";
import type { VoicePreferencesShape } from "./voiceMessages";

interface VoiceViewProps {
  context: VoicePanelContext | null;
}

const STATUS_LABELS: Record<string, string> = {
  idle: "Prêt à appeler",
  requesting: "Création de la session…",
  connecting: "Connexion à l'agent…",
  listening: "Conversation en cours",
  ending: "Fin de l'appel…",
  ended: "Appel terminé",
  error: "Erreur",
};

export const VoiceView: React.FC<VoiceViewProps> = ({ context }) => {
  const { status, error, transcripts, isActive, start, stop, restart } =
    useExtensionVoiceChat({ context });

  const settings = useVoiceSettings();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const transcriptsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = transcriptsRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcripts]);

  const agentType = pickAgentType(context);
  const title = context?.videoTitle || "DeepSight Voice";
  const subtitle = context?.summaryId
    ? `Analyse #${context.summaryId} · ${context.videoId ?? ""}`.trim()
    : "Mode compagnon — sans contexte vidéo";

  const onClickMic = (): void => {
    if (isActive || status === "requesting") {
      void stop();
    } else {
      void start();
    }
  };

  // Apply hard changes pendant l'appel = restart silencieux ElevenLabs.
  // Hors appel, le PUT est suffisant (la prochaine session prendra les nouveaux params).
  const handleApplyHardChanges = useCallback(
    async (changed: Partial<VoicePreferencesShape>): Promise<void> => {
      if (!isActive) return;
      setRestarting(true);
      try {
        await restart();
      } finally {
        // Petit délai visuel — la session se reconnecte généralement < 1s
        setTimeout(() => setRestarting(false), 800);
      }
      // Référencé uniquement pour éviter unused param warning si linter strict
      void changed;
    },
    [isActive, restart],
  );

  return (
    <div className="dsp-app">
      <div className="dsp-header">
        <span className="dsp-title">DeepSight Voice</span>
        <span className="dsp-badge">ElevenLabs</span>
        <button
          type="button"
          className="dsp-voice-settings-btn"
          onClick={() => setDrawerOpen(true)}
          aria-label="Réglages voix"
          title="Réglages voix"
          style={{ marginLeft: "auto" }}
          data-testid="voice-settings-btn"
        >
          ⚙
        </button>
      </div>

      <div className="dsp-card" data-testid="voice-context-card">
        <p className="dsp-card-title">{title}</p>
        <p className="dsp-card-meta">{subtitle}</p>
        <span className="dsp-mode" data-testid="agent-type">
          <span className="dsp-mode-dot" />
          Agent : {agentType}
        </span>
      </div>

      <div className="dsp-voice-zone">
        <button
          type="button"
          className="dsp-mic-btn"
          data-testid="voice-toggle-btn"
          data-active={isActive ? "true" : "false"}
          onClick={onClickMic}
          disabled={status === "requesting" || status === "ending"}
          aria-label={isActive ? "Terminer l'appel" : "Démarrer l'appel"}
        >
          {isActive ? "■" : "🎙"}
        </button>
        <p className="dsp-status" data-testid="voice-status">
          {STATUS_LABELS[status] ?? status}
        </p>
        {restarting && (
          <span
            className="dsp-vs-restart-indicator"
            data-testid="voice-restarting"
          >
            Réapplication des réglages…
          </span>
        )}
        {error && (
          <p className="dsp-error" role="alert" data-testid="voice-error">
            {error}
          </p>
        )}
      </div>

      <div className="dsp-transcripts" ref={transcriptsRef}>
        {transcripts.length === 0 ? (
          <p className="dsp-empty">
            Les transcripts apparaîtront ici en temps réel.
          </p>
        ) : (
          transcripts.map((t, i) => (
            <div
              key={`${t.ts}-${i}`}
              className="dsp-transcript"
              data-speaker={t.speaker}
            >
              {t.content}
            </div>
          ))
        )}
      </div>

      <p className="dsp-footer">
        Conversation chiffrée · Tokens stockés dans le service worker.
      </p>

      <VoiceSettingsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onApplyHardChanges={handleApplyHardChanges}
        settings={settings}
      />
    </div>
  );
};
