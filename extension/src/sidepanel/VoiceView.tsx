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

export const VoiceView: React.FC<VoiceViewProps> = ({
  context,
  pendingCall,
}) => {
  const { t } = useTranslation();
  const [state, setState] = useState<VoiceCallState>({ phase: "idle" });
  const [elapsedSec, setElapsedSec] = useState(0);
  // [B6] retryKey re-déclenche le bootstrap useEffect sans toucher au pendingCall.
  // Utilisé par le bouton "Autoriser le micro" — chaque clic = user gesture
  // frais → getUserMedia peut afficher le prompt natif Chrome.
  const [retryKey, setRetryKey] = useState(0);
  // [B7] Track Chrome microphone permission state. Si "denied", getUserMedia
  // rejette IMMÉDIATEMENT sans afficher de prompt — le user doit débloquer
  // manuellement via chrome://settings. On détecte ça pour lui afficher
  // des instructions claires + un bouton qui ouvre la bonne page.
  const [micPermState, setMicPermState] = useState<
    "unknown" | "prompt" | "granted" | "denied"
  >("unknown");
  const startedRef = useRef(false);

  // ── [B7] Surveille la permission micro Chrome ──
  // navigator.permissions.query est dispo dans extension pages (Chrome 64+).
  // L'event onchange permet de reagir si le user débloque manuellement.
  useEffect(() => {
    if (!navigator.permissions?.query) return;
    let cancelled = false;
    void (async () => {
      try {
        const status = await navigator.permissions.query({
          name: "microphone" as PermissionName,
        });
        if (cancelled) return;
        setMicPermState(status.state as "prompt" | "granted" | "denied");
        status.onchange = () => {
          setMicPermState(status.state as "prompt" | "granted" | "denied");
        };
      } catch {
        // Browser sans support → on laisse "unknown", le code fallback gère.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── [B9] Écoute le broadcast quand la popup mic-permission a granted ──
  // Le popup window envoie MIC_PERMISSION_GRANTED → background broadcast
  // MIC_PERMISSION_GRANTED_BROADCAST → on re-trigger le bootstrap.
  useEffect(() => {
    const listener = (msg: { action?: string }): void => {
      if (msg?.action === "MIC_PERMISSION_GRANTED_BROADCAST") {
        console.log("[VoiceView] mic permission granted via popup, restart");
        startedRef.current = false;
        setState({ phase: "idle" });
        setRetryKey((k) => k + 1);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

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
      // ── [B8] Preflight micro via OFFSCREEN DOCUMENT ──
      // Bug Chrome MV3 connu : getUserMedia depuis un sidepanel ne
      // déclenche pas le prompt natif de façon fiable (chromium #41497129).
      // Solution officielle : passer par un offscreen document
      // (reasons:["USER_MEDIA"]) où getUserMedia se comporte comme dans
      // une page web normale. Le background gère la création du document
      // et le round-trip — ici on envoie juste un message.
      console.log("[VoiceView] requesting mic via offscreen…");
      let micGranted = false;
      try {
        const resp = (await chrome.runtime.sendMessage({
          action: "REQUEST_MIC_PERMISSION",
        })) as
          | {
              success?: boolean;
              result?: { granted?: boolean; errorName?: string };
              error?: string;
            }
          | undefined;
        console.log("[VoiceView] offscreen mic response:", resp);
        micGranted = Boolean(resp?.result?.granted);
        if (!micGranted) {
          if (cancelled) return;
          const errName = resp?.result?.errorName;
          if (
            errName === "NotAllowedError" ||
            errName === "PermissionDeniedError"
          ) {
            setState({ phase: "error_mic_permission" });
          } else {
            setState({
              phase: "error_generic",
              message: errName ?? resp?.error ?? "Mic unavailable",
            });
          }
          return;
        }
      } catch (e) {
        if (cancelled) return;
        console.error("[VoiceView] offscreen mic request failed:", e);
        setState({
          phase: "error_generic",
          message: String((e as Error).message ?? e),
        });
        return;
      }

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
  }, [pendingCall?.videoId, retryKey]);

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
      state.phase === "live_streaming" || state.phase === "live_complete"
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
    const url = `${WEBAPP_URL}/upgrade?plan=pro&source=voice_call`;
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
    // [B7] Si Chrome a mémorisé "Bloquer", getUserMedia rejette
    // IMMÉDIATEMENT sans aucun prompt — impossible à débloquer en JS.
    // La seule issue : ouvrir chrome://settings/content/siteDetails pour
    // l'extension, le user clique "Autoriser" pour Microphone, puis revient.
    const isDenied = micPermState === "denied";
    const handleOpenChromeSettings = (): void => {
      const extensionId = chrome.runtime.id;
      const settingsUrl = `chrome://settings/content/siteDetails?site=chrome-extension://${extensionId}`;
      void chrome.tabs.create({ url: settingsUrl });
    };
    // [B9] Click handler → ouvre un popup window dédié pour la demande mic.
    // C'est la solution la plus fiable : le sidepanel a un bug Chrome connu
    // qui empêche getUserMedia de déclencher le prompt natif. Une nouvelle
    // window se comporte comme un onglet web normal.
    // Le popup envoie MIC_PERMISSION_GRANTED → background broadcast →
    // sidepanel listener (useEffect ci-dessous) re-bootstrap.
    const handleEnableMic = (): void => {
      void (async () => {
        try {
          const resp = (await chrome.runtime.sendMessage({
            action: "OPEN_MIC_PERMISSION_POPUP",
          })) as { success?: boolean; error?: string } | undefined;
          console.log("[VoiceView] open popup:", resp);
          if (!resp?.success) {
            console.error("[VoiceView] popup open failed:", resp?.error);
          }
        } catch (err) {
          console.error("[VoiceView] open popup error:", err);
        }
      })();
    };
    return (
      <div className="ds-error" role="alert">
        {isDenied ? (
          <>
            <p>
              Le micro est bloqué dans Chrome pour cette extension. Ouvre les
              paramètres Chrome, choisis « Autoriser » pour Microphone, puis
              recharge le side panel.
            </p>
            <button type="button" onClick={handleOpenChromeSettings}>
              ⚙️ Ouvrir les paramètres Chrome
            </button>
          </>
        ) : (
          <>
            <p>{t.voiceCall.errors.micPermission}</p>
            <button type="button" onClick={handleEnableMic}>
              {t.voiceCall.errors.enableMic}
            </button>
          </>
        )}
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
