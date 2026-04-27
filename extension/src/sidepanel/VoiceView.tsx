// extension/src/sidepanel/VoiceView.tsx
//
// Quick Voice Call (Task 16) — state machine pour le flow d'appel voix
// déclenché depuis le widget YouTube.
//
// Phases :
//   idle              → écran neutre (rare, App.tsx n'arrive ici qu'avec un pending call)
//   connecting        → ConnectingView (mic pulsant, ~1-2s)
//   live_streaming    → CallActiveView + ContextProgressBar (analyse en cours)
//   live_complete     → CallActiveView (analyse complète, agent a tout le contexte)
//   ended_free_cta    → UpgradeCTA reason=trial_used (post-call free)
//   ended_expert      → écran fermeture neutre
//   error_quota       → UpgradeCTA reason=… (Pro/free saturé)
//   error_mic_perm    → message + retry
//   error_generic     → message + close
//
// Compat backwards : accepte un `context?: VoicePanelContext | null` legacy
// (utilisé par l'ancien flow OPEN_VOICE_PANEL via App.tsx). Si pas de
// pendingVoiceCall NI de context vidéo, on retombe sur le UI legacy via
// `useExtensionVoiceChat({ context })`.
import React, { useEffect, useState, useRef } from "react";
import { ConnectingView } from "./components/ConnectingView";
import { CallActiveView } from "./components/CallActiveView";
import { ContextProgressBar } from "./components/ContextProgressBar";
import { UpgradeCTA } from "./components/UpgradeCTA";
import {
  useExtensionVoiceChat,
  VoiceQuotaError,
} from "./useExtensionVoiceChat";
import { useStreamingVideoContext } from "./hooks/useStreamingVideoContext";
import type { VoiceCallState, VoicePanelContext } from "./types";
import { WEBAPP_URL } from "../utils/config";
import { track } from "../utils/analytics";

interface VoiceViewProps {
  context?: VoicePanelContext | null;
}

interface PendingVoiceCall {
  videoId: string;
  videoTitle: string;
}

interface SessionStorageShape {
  get: (key: string) => Promise<Record<string, unknown>>;
  remove?: (key: string) => Promise<void>;
}

function getSessionStorage(): SessionStorageShape | null {
  const c = (
    chrome as unknown as {
      storage?: { session?: SessionStorageShape };
    }
  ).storage;
  if (!c?.session?.get) return null;
  return c.session;
}

export const VoiceView: React.FC<VoiceViewProps> = ({ context }) => {
  const [state, setState] = useState<VoiceCallState>({ phase: "idle" });
  const [elapsedSec, setElapsedSec] = useState(0);
  const startedRef = useRef(false);

  // Legacy compat : on passe un context au hook si fourni en prop. Le nouveau
  // flow utilise startSession() directement avec videoId du pendingVoiceCall.
  const voiceChat = useExtensionVoiceChat({ context: context ?? null });

  // ── Bootstrap : lit pendingVoiceCall + démarre la session ──
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const session = getSessionStorage();
    if (!session) {
      // Pas d'API session storage (Firefox/Safari) — reste en idle.
      return;
    }

    let cancelled = false;
    void session
      .get("pendingVoiceCall")
      .then(async (data) => {
        const pending = data?.pendingVoiceCall as PendingVoiceCall | undefined;
        if (!pending?.videoId) {
          // Aucun pending call — soit on a un context legacy, soit on stay idle.
          return;
        }
        if (cancelled) return;

        setState({
          phase: "connecting",
          videoId: pending.videoId,
          videoTitle: pending.videoTitle,
        });
        try {
          await session.remove?.("pendingVoiceCall");
        } catch {
          /* best-effort */
        }

        try {
          const created = await voiceChat.startSession({
            videoId: pending.videoId,
            videoTitle: pending.videoTitle,
            agentType: "explorer_streaming",
            isStreaming: true,
          });
          if (cancelled) return;
          chrome.runtime.sendMessage({ type: "VOICE_CALL_STARTED" });
          track("voice_call_started", {
            videoId: pending.videoId,
            agent_type: "explorer_streaming",
            is_trial: Boolean(created.is_trial),
            max_minutes: created.max_minutes ?? null,
          });
          setState({
            phase: "live_streaming",
            videoId: pending.videoId,
            sessionId: created.session_id,
            startedAt: Date.now(),
          });
        } catch (e) {
          if (cancelled) return;
          // Detect quota errors via instanceof OR duck-typed `status: 402`
          // (les tests injectent un `Error` augmenté avec `.status/.detail`).
          const errAny = e as Error & {
            status?: number;
            detail?: { reason?: string };
          };
          const isQuota = e instanceof VoiceQuotaError || errAny.status === 402;
          if (isQuota) {
            const detailReason = errAny.detail?.reason as
              | "trial_used"
              | "pro_no_voice"
              | "monthly_quota"
              | undefined;
            const reason = detailReason ?? "trial_used";
            setState({ phase: "error_quota", reason });
            track("voice_call_upgrade_cta_shown", {
              reason,
              videoId: pending.videoId,
            });
          } else if (errAny.name === "NotAllowedError") {
            setState({ phase: "error_mic_permission" });
          } else {
            setState({
              phase: "error_generic",
              message: String(errAny?.message ?? e),
            });
          }
        }
      })
      .catch(() => {
        // Lecture session storage échouée — reste en idle.
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Elapsed timer ──
  useEffect(() => {
    if (state.phase !== "live_streaming" && state.phase !== "live_complete") {
      return;
    }
    const startedAt = state.startedAt;
    const t = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [state]);

  const sessionId =
    state.phase === "live_streaming" || state.phase === "live_complete"
      ? state.sessionId
      : null;
  const { contextProgress, contextComplete } = useStreamingVideoContext(
    sessionId,
    voiceChat.conversation,
  );

  // Promote live_streaming → live_complete quand le SSE annonce ctx_complete.
  useEffect(() => {
    if (contextComplete && state.phase === "live_streaming") {
      const ctxCompleteMs = Date.now() - state.startedAt;
      track("voice_call_context_complete_at_ms", {
        videoId: state.videoId,
        ms: ctxCompleteMs,
      });
      setState((s) =>
        s.phase === "live_streaming"
          ? {
              phase: "live_complete",
              videoId: s.videoId,
              sessionId: s.sessionId,
              startedAt: s.startedAt,
            }
          : s,
      );
    }
  }, [contextComplete, state.phase]);

  const handleHangup = (): void => {
    void voiceChat.endSession();
    chrome.runtime.sendMessage({ type: "VOICE_CALL_ENDED" });
    // Track durée totale d'appel (live_streaming/live_complete only).
    if (state.phase === "live_streaming" || state.phase === "live_complete") {
      const durationSec = Math.floor((Date.now() - state.startedAt) / 1000);
      track("voice_call_duration_seconds", {
        videoId: state.videoId,
        durationSec,
      });
    }
    const endedReason = voiceChat.lastSessionWasTrial
      ? "trial_used"
      : "user_hangup";
    track("voice_call_ended_reason", { reason: endedReason });
    if (voiceChat.lastSessionWasTrial) {
      setState({ phase: "ended_free_cta", reason: "trial_used" });
      track("voice_call_upgrade_cta_shown", { reason: "trial_used" });
    } else {
      setState({ phase: "ended_expert" });
    }
  };

  const handleUpgrade = (): void => {
    const reason = state.phase === "error_quota" ? state.reason : "trial_used";
    track("voice_call_upgrade_cta_clicked", { reason });
    const url = `${WEBAPP_URL}/billing/checkout?plan=expert&source=voice_call`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // ── Rendering ──
  if (state.phase === "connecting") return <ConnectingView />;
  if (state.phase === "live_streaming" || state.phase === "live_complete") {
    return (
      <>
        <CallActiveView
          elapsedSec={elapsedSec}
          onMute={voiceChat.toggleMute}
          onHangup={handleHangup}
        />
        <ContextProgressBar
          progress={contextProgress}
          complete={contextComplete}
        />
      </>
    );
  }
  if (state.phase === "ended_free_cta" || state.phase === "error_quota") {
    const reason = state.phase === "error_quota" ? state.reason : "trial_used";
    return (
      <UpgradeCTA
        reason={reason}
        onUpgrade={handleUpgrade}
        onDismiss={() => setState({ phase: "idle" })}
      />
    );
  }
  if (state.phase === "error_mic_permission") {
    return (
      <div className="ds-error" role="alert">
        <p>Permission micro requise.</p>
        <button type="button" onClick={() => location.reload()}>
          Réessayer
        </button>
      </div>
    );
  }
  if (state.phase === "error_generic") {
    return (
      <div className="ds-error" role="alert">
        <p>Erreur : {state.message}</p>
        <button type="button" onClick={() => setState({ phase: "idle" })}>
          Fermer
        </button>
      </div>
    );
  }
  if (state.phase === "ended_expert") {
    return (
      <div className="ds-call-ended">
        <p>Appel terminé.</p>
      </div>
    );
  }
  return null;
};
