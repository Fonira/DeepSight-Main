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
import type {
  VoiceCallState,
  VoicePanelContext,
  PendingVoiceCall,
} from "./types";
import { WEBAPP_URL } from "../utils/config";
import { track, hashVideoId } from "../utils/analytics";
import { useTranslation } from "../i18n/useTranslation";

interface VoiceViewProps {
  /** Legacy compat : ouverture du sidepanel via OPEN_VOICE_PANEL. */
  context?: VoicePanelContext | null;
  /**
   * Quick Voice Call (B4) — payload pré-extrait par App.tsx depuis
   * `chrome.storage.session.pendingVoiceCall`. App.tsx supprime déjà
   * la clé : VoiceView n'a plus besoin de toucher au session storage.
   */
  pendingCall?: PendingVoiceCall | null;
}

export const VoiceView: React.FC<VoiceViewProps> = ({ context, pendingCall }) => {
  const { t } = useTranslation();
  const [state, setState] = useState<VoiceCallState>({ phase: "idle" });
  const [elapsedSec, setElapsedSec] = useState(0);
  const startedRef = useRef(false);

  // Legacy compat : on passe un context au hook si fourni en prop. Le nouveau
  // flow utilise startSession() directement avec videoId du pendingVoiceCall.
  const voiceChat = useExtensionVoiceChat({ context: context ?? null });

  // ── Bootstrap : démarre la session quand pendingCall arrive ──
  // Centralisation B4 : c'est App.tsx qui lit + supprime
  // `pendingVoiceCall` du session storage et passe le payload en prop.
  // Ici on réagit simplement à la prop (initial OU late update via
  // chrome.storage.onChanged listener côté App.tsx — finding I6).
  useEffect(() => {
    if (startedRef.current) return;
    if (!pendingCall?.videoId) return;
    startedRef.current = true;

    let cancelled = false;
    const pending = pendingCall;

    setState({
      phase: "connecting",
      videoId: pending.videoId,
      videoTitle: pending.videoTitle ?? "",
    });

    void (async () => {
      // [N1] Hash videoId pour PostHog (privacy + groupage).
      const videoIdHash = await hashVideoId(pending.videoId);
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
          videoIdHash,
          plan: pending.plan ?? "unknown", // [N3]
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
            videoIdHash, // [N1]
            plan: pending.plan ?? "unknown",
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
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCall?.videoId]);

  // ── Connecting timeout (I2) ──
  // Si la phase reste `connecting` plus de 15 secondes, on bascule en
  // `error_generic` avec un message explicite. Évite que l'UX freeze
  // indéfiniment si le backend `/voice/session` est bloqué (réseau lent,
  // 504, SDK ElevenLabs qui ne répond pas). Cleanup automatique sur
  // transition vers une autre phase.
  useEffect(() => {
    if (state.phase !== "connecting") return;
    const timeoutMessage = t.voiceCall.errors.connectingTimeout;
    const timer = setTimeout(() => {
      setState((s) =>
        s.phase === "connecting"
          ? { phase: "error_generic", message: timeoutMessage }
          : s,
      );
    }, 15000);
    return () => clearTimeout(timer);
  }, [state.phase, t.voiceCall.errors.connectingTimeout]);

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
      const vid = state.videoId;
      // [N1] hash async-fire pour PostHog.
      void (async () => {
        const videoIdHash = await hashVideoId(vid);
        track("voice_call_context_complete_at_ms", {
          videoIdHash,
          ms: ctxCompleteMs,
        });
      })();
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
    // [N1] Hash en arrière-plan pour les events ; on déclenche en async-fire.
    const videoIdRaw =
      state.phase === "live_streaming" ||
      state.phase === "live_complete"
        ? state.videoId
        : undefined;
    void (async () => {
      const videoIdHash = videoIdRaw ? await hashVideoId(videoIdRaw) : "";
      // Track durée totale d'appel (live_streaming/live_complete only).
      if (state.phase === "live_streaming" || state.phase === "live_complete") {
        const durationSec = Math.floor((Date.now() - state.startedAt) / 1000);
        track("voice_call_duration_seconds", {
          videoIdHash,
          durationSec,
        });
      }
      const endedReason = voiceChat.lastSessionWasTrial
        ? "trial_used"
        : "user_hangup";
      track("voice_call_ended_reason", { reason: endedReason, videoIdHash });
      if (voiceChat.lastSessionWasTrial) {
        track("voice_call_upgrade_cta_shown", {
          reason: "trial_used",
          videoIdHash,
        });
      }
    })();
    if (voiceChat.lastSessionWasTrial) {
      setState({ phase: "ended_free_cta", reason: "trial_used" });
    } else {
      setState({ phase: "ended_expert" });
    }
  };

  const handleUpgrade = (): void => {
    const reason = state.phase === "error_quota" ? state.reason : "trial_used";
    track("voice_call_upgrade_cta_clicked", { reason });
    // ⚠️ URL doit pointer vers la route web /upgrade (pas /billing/checkout
    // qui n'existe pas — cf. frontend/src/App.tsx lazy routes). Le param
    // ?source=voice_call est lu par UpgradePage pour le tracking PostHog.
    const url = `${WEBAPP_URL}/upgrade?plan=expert&source=voice_call`;
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
        <p>{t.voiceCall.errors.micPermission}</p>
        <button type="button" onClick={() => location.reload()}>
          {t.common.retry}
        </button>
      </div>
    );
  }
  if (state.phase === "error_generic") {
    return (
      <div className="ds-error" role="alert">
        <p>
          {t.voiceCall.errors.genericPrefix} {state.message}
        </p>
        <button type="button" onClick={() => setState({ phase: "idle" })}>
          {t.voiceCall.errors.close}
        </button>
      </div>
    );
  }
  if (state.phase === "ended_expert") {
    return (
      <div className="ds-call-ended">
        <p>{t.voiceCall.errors.callEnded}</p>
      </div>
    );
  }
  return null;
};
