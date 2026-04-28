/**
 * VoiceModal — Main voice conversation interface
 * Full-screen modal with live transcript, status indicators, and controls
 */

import React, {
  useEffect,
  useRef,
  useId,
  useCallback,
  useState,
  lazy,
  Suspense,
} from "react";
import { createPortal } from "react-dom";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  AlertCircle,
  ArrowUpCircle,
  RotateCcw,
  Settings2,
  Video,
} from "lucide-react";
import { DeepSightSpinner } from "../ui/DeepSightSpinner";
import { VoiceToolIndicator } from "./VoiceToolIndicator";
import { VoiceWaveform } from "./VoiceWaveform";
import { VoiceTranscript } from "./VoiceTranscript";
import { useTranslation } from "../../hooks/useTranslation";
import { VoicePTTButton } from "./VoicePTTButton";
import DoodleBackground from "../DoodleBackground";
import { voiceApi, type VoiceThumbnailResponse } from "../../services/api";
import { ThumbnailImage } from "./utils/ThumbnailImage";

// Lazy-load VoiceSettings to avoid circular imports + reduce initial bundle
const VoiceSettings = lazy(() => import("./VoiceSettings"));

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoTitle: string;
  channelName?: string;
  /**
   * ID de l'analyse (Summary) associée. Si fourni, le modal fetche la
   * thumbnail HD via `/api/voice/session/{summaryId}/thumbnail` pour obtenir
   * l'image haute définition + fallback image générée. Laisser undefined pour
   * les contextes sans summary (ex: débat IA) — dans ce cas on retombe sur
   * `videoThumbnailUrl`.
   */
  summaryId?: number | string | null;
  /** URL de la miniature vidéo (affichée en grand au centre du modal) */
  videoThumbnailUrl?: string | null;
  /** Status de la conversation voice */
  voiceStatus:
    | "idle"
    | "connecting"
    | "listening"
    | "thinking"
    | "speaking"
    | "error"
    | "quota_exceeded";
  /** L'IA est en train de parler */
  isSpeaking: boolean;
  /** Messages de la conversation (transcript live) */
  messages: Array<{ text: string; source: "user" | "ai" }>;
  /** Timer en secondes */
  elapsedSeconds: number;
  /** Minutes restantes dans le quota */
  remainingMinutes: number;
  /** Callbacks */
  onStart: () => void | Promise<void>;
  onStop: () => void | Promise<void>;
  onMuteToggle: () => void;
  isMuted: boolean;
  /** PTT props */
  inputMode?: "ptt" | "vad";
  isTalking?: boolean;
  onStartTalking?: () => void;
  onStopTalking?: () => void;
  /** Touche clavier pour PTT (depuis preferences user). Defaut: Space. */
  pttKey?: string;
  /** Tool en cours d'exécution */
  activeTool?: string | null;
  /** Erreur eventuelle */
  error?: string;
  /** Playback rate actif (badge vitesse) */
  playbackRate?: number;
  /** Avatar dynamique de l'agent (URL) — e.g. avatar débat généré via pipeline images */
  avatarUrl?: string | null;
  /** Statut de génération de l'avatar : "ready" | "generating" | "unavailable" */
  avatarStatus?: "ready" | "generating" | "unavailable";
  /** Initiales de fallback (2 caractères max) affichées si avatar absent */
  avatarFallback?: string;
  /** Niveau micro temps réel [0,1] — drive waveform + halo PTT. */
  micLevel?: number;
}

/** Format seconds to MM:SS */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Animated thinking dots */
const ThinkingDots: React.FC = () => (
  <div className="flex items-center gap-1.5">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className="w-2.5 h-2.5 rounded-full bg-indigo-400"
        animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
        transition={{
          duration: 0.8,
          repeat: Infinity,
          delay: i * 0.15,
          ease: "easeInOut",
        }}
      />
    ))}
  </div>
);

/**
 * VideoStage — Hero visuel de l'appel : miniature vidéo en grand
 * avec halo lumineux indigo/violet/cyan qui pulse selon l'état vocal.
 *
 * Thumbnail source (priorité) :
 *  1. `voiceThumb.thumbnail_url` si fourni par le backend (HD garanti YouTube)
 *  2. `thumbnailUrl` en fallback (prop existante venant du Summary)
 *  3. Gradient DeepSight + icône Video si rien n'est dispo.
 */
interface VideoStageProps {
  thumbnailUrl?: string | null;
  isActive: boolean;
  isSpeaking: boolean;
  videoTitle: string;
  voiceThumb?: VoiceThumbnailResponse | null;
}
const VideoStage: React.FC<VideoStageProps> = ({
  thumbnailUrl,
  isActive,
  isSpeaking,
  videoTitle,
  voiceThumb,
}) => {
  const resolvedThumbnailUrl =
    voiceThumb?.thumbnail_url ?? thumbnailUrl ?? null;
  const resolvedAlt = voiceThumb?.alt_text ?? videoTitle;
  return (
    <div className="relative flex items-center justify-center w-full">
      {/* Halo externe — intensifie quand l'IA parle */}
      <motion.div
        aria-hidden="true"
        className="absolute pointer-events-none rounded-[28px]"
        style={{
          width: "min(92%, 460px)",
          aspectRatio: "16 / 9",
          background:
            "radial-gradient(60% 60% at 50% 50%, rgba(139, 92, 246, 0.35), rgba(99, 102, 241, 0.18) 55%, transparent 80%)",
          filter: "blur(40px)",
        }}
        animate={
          isSpeaking
            ? { opacity: [0.55, 0.95, 0.55], scale: [1, 1.04, 1] }
            : isActive
              ? { opacity: [0.45, 0.7, 0.45], scale: [1, 1.02, 1] }
              : { opacity: [0.3, 0.5, 0.3], scale: [1, 1.01, 1] }
        }
        transition={{
          duration: isSpeaking ? 1.6 : 3.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      {/* Halo cyan secondaire */}
      <motion.div
        aria-hidden="true"
        className="absolute pointer-events-none rounded-[28px]"
        style={{
          width: "min(82%, 400px)",
          aspectRatio: "16 / 9",
          background:
            "radial-gradient(50% 50% at 30% 70%, rgba(6, 182, 212, 0.22), transparent 75%)",
          filter: "blur(32px)",
        }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Thumbnail card */}
      <motion.div
        className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-indigo-500/20 bg-white/5 backdrop-blur-xl"
        style={{
          width: "min(80%, 380px)",
          aspectRatio: "16 / 9",
        }}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <ThumbnailImage
          src={resolvedThumbnailUrl}
          alt={resolvedAlt}
          className="w-full h-full object-cover"
          fallback={
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500/30 via-violet-500/25 to-cyan-500/25">
              <Video className="w-14 h-14 text-text-secondary" strokeWidth={1.5} />
            </div>
          }
        />

        {/* Scanline sheen when speaking — subtle light animation */}
        {isSpeaking && (
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.10) 50%, transparent 70%)",
            }}
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
          />
        )}

        {/* Gradient border glow at edges */}
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            boxShadow:
              "inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 30px rgba(139,92,246,0.10)",
          }}
        />
      </motion.div>
    </div>
  );
};

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  videoTitle,
  channelName,
  summaryId,
  videoThumbnailUrl,
  voiceStatus,
  isSpeaking,
  messages,
  elapsedSeconds,
  remainingMinutes,
  onStart,
  onStop,
  onMuteToggle,
  isMuted,
  inputMode = "ptt",
  isTalking = false,
  onStartTalking,
  onStopTalking,
  pttKey = " ",
  activeTool,
  error,
  playbackRate,
  avatarUrl,
  avatarStatus = "unavailable",
  avatarFallback,
  micLevel = 0,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const { language } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);

  // 🖼️ Thumbnail HD backend (fetch asynchrone, fallback silencieux sur videoThumbnailUrl).
  // Le backend garantit l'URL HD YouTube (maxresdefault) ou une image générée
  // pour les plateformes sans thumbnail native.
  const [voiceThumb, setVoiceThumb] = useState<VoiceThumbnailResponse | null>(
    null,
  );

  useEffect(() => {
    // Pas de summaryId (ex: DebatePage) ou modal fermé → on skippe le fetch
    // et on laisse le VideoStage retomber sur `videoThumbnailUrl`.
    if (
      !isOpen ||
      summaryId === undefined ||
      summaryId === null ||
      summaryId === 0
    ) {
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchThumb = async (allowRetry: boolean) => {
      try {
        const data = await voiceApi.getSessionThumbnail(summaryId);
        if (cancelled) return;
        setVoiceThumb(data);
        // Image en cours de génération côté backend → re-fetch UNE fois après 5s.
        if (allowRetry && data.source === "generating") {
          retryTimer = setTimeout(() => {
            if (!cancelled) {
              void fetchThumb(false);
            }
          }, 5000);
        }
      } catch {
        // Fallback silencieux : UI continue avec la prop videoThumbnailUrl
        // (aucun loader bloquant, aucun toast — non critique).
      }
    };

    void fetchThumb(true);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [isOpen, summaryId]);

  // Reset voiceThumb à la fermeture pour éviter de garder l'image d'une
  // session précédente si le modal est rouvert sur un autre summary.
  useEffect(() => {
    if (!isOpen) {
      setVoiceThumb(null);
    }
  }, [isOpen]);

  const tr = useCallback(
    (fr: string, en: string) => (language === "fr" ? fr : en),
    [language],
  );

  // Wrap async callbacks to prevent unhandled promise rejections
  const safeStart = useCallback(() => {
    try {
      Promise.resolve(onStart()).catch(() => {});
    } catch {
      /* handled internally */
    }
  }, [onStart]);

  const safeStop = useCallback(() => {
    try {
      Promise.resolve(onStop()).catch(() => {});
    } catch {
      /* handled internally */
    }
  }, [onStop]);

  const isActive =
    voiceStatus === "listening" ||
    voiceStatus === "thinking" ||
    voiceStatus === "speaking";
  // "Session existe" = user a démarré quelque chose qu'il peut vouloir
  // interrompre, y compris pendant connecting et en cas d'error post-démarrage.
  // quota_exceeded et idle : pas de bouton stop (rien à arrêter).
  const hasActiveSession =
    isActive || voiceStatus === "connecting" || voiceStatus === "error";
  const remainingFormatted = formatTime(remainingMinutes * 60);

  // Body scroll lock + focus management
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => {
        modalRef.current?.focus();
      });
    } else {
      document.body.style.overflow = "unset";
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Escape key + focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  // PTT keyboard shortcut --- hold configured key to talk
  useEffect(() => {
    if (!isOpen || inputMode !== "ptt" || !onStartTalking || !onStopTalking)
      return;
    const target = pttKey || " ";
    const isHoldingRef = { current: false };
    const matches = (e: KeyboardEvent): boolean => {
      if (target === " ") return e.code === "Space" || e.key === " ";
      return e.key === target || e.key.toLowerCase() === target.toLowerCase();
    };
    const onDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement)?.isContentEditable
      )
        return;
      if (!matches(e)) return;
      if (e.repeat || isHoldingRef.current) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      isHoldingRef.current = true;
      onStartTalking();
    };
    const onUp = (e: KeyboardEvent) => {
      if (!matches(e) || !isHoldingRef.current) return;
      e.preventDefault();
      isHoldingRef.current = false;
      onStopTalking();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      if (isHoldingRef.current) {
        isHoldingRef.current = false;
        onStopTalking();
      }
    };
  }, [isOpen, inputMode, pttKey, onStartTalking, onStopTalking]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  const renderCenterContent = () => {
    switch (voiceStatus) {
      case "idle":
        return (
          <motion.button
            onClick={safeStart}
            className="px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold text-lg shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-shadow focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5" />
              {tr("Demarrer la conversation", "Start conversation")}
            </div>
          </motion.button>
        );

      case "connecting":
        return (
          <div className="flex flex-col items-center gap-4">
            <DeepSightSpinner size="lg" />
            <p className="text-text-secondary text-sm">
              {tr("Connexion en cours...", "Connecting...")}
            </p>
          </div>
        );

      case "listening":
        return (
          <div className="flex flex-col items-center gap-4">
            {inputMode === "ptt" && !isTalking ? (
              <>
                <div className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                  <Mic className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-green-400/70 text-sm">
                  {tr(
                    "Maintenez le bouton pour parler",
                    "Hold the button to talk",
                  )}
                </p>
              </>
            ) : (
              <>
                {/* Live waveform driven by real mic RMS amplitude — the user
                    sees the mic is open and capturing their voice. */}
                <VoiceWaveform
                  mode="user"
                  intensity={Math.max(0.15, micLevel)}
                  color="indigo"
                  size="md"
                />
                <p className="text-green-400 text-sm font-medium">
                  {isTalking
                    ? micLevel < 0.05
                      ? tr("Parlez, je vous écoute…", "Speak, I'm listening…")
                      : tr("Parlez maintenant…", "Speak now…")
                    : tr("À l'écoute…", "Listening…")}
                </p>
              </>
            )}
          </div>
        );

      case "thinking":
        return (
          <div className="flex flex-col items-center gap-4">
            <ThinkingDots />
            <p className="text-indigo-300 text-sm">
              {tr("Reflexion...", "Thinking...")}
            </p>
          </div>
        );

      case "speaking":
        return (
          <div className="flex flex-col items-center gap-4">
            {/* AI speaking — fluid sine-driven waveform (violet) */}
            <VoiceWaveform mode="ai" intensity={0.8} color="violet" size="md" />
            <p className="text-violet-300 text-sm font-medium">
              {tr("DeepSight parle…", "DeepSight is speaking…")}
            </p>
          </div>
        );

      case "error":
        return (
          <div className="flex flex-col items-center gap-4 max-w-sm text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-red-300 text-sm">
              {error || tr("Une erreur est survenue", "An error occurred")}
            </p>
            <button
              onClick={safeStart}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-text-primary hover:bg-white/10 transition-colors text-sm focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <RotateCcw className="w-4 h-4" />
              {tr("Reessayer", "Retry")}
            </button>
          </div>
        );

      case "quota_exceeded":
        return (
          <div className="flex flex-col items-center gap-4 max-w-sm text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-amber-400" />
            </div>
            <p className="text-amber-300 text-sm font-medium">
              {tr("Quota de minutes epuise", "Voice minutes quota exceeded")}
            </p>
            <p className="text-text-muted text-xs">
              {tr(
                "Passez au plan superieur pour continuer vos conversations vocales.",
                "Upgrade your plan to continue voice conversations.",
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-medium text-sm hover:shadow-lg hover:shadow-indigo-500/25 transition-shadow focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <ArrowUpCircle className="w-4 h-4" />
                {tr("Passer au plan superieur", "Upgrade plan")}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          role="presentation"
        >
          {/* Override page <title> while the call is active so the browser
              tab reflects "Appel vocal" instead of the underlying page
              (e.g. "Historique"). Reverts on close. */}
          <Helmet>
            <title>
              {tr("Appel vocal | DeepSight", "Voice call | DeepSight")}
            </title>
          </Helmet>
          {/* Backdrop — DeepSight dark theme + doodle pattern + brand glow */}
          <motion.div
            className="absolute inset-0 bg-[#0a0a0f]/95 backdrop-blur-xl overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            aria-hidden="true"
          >
            {/* Doodles arrière-plan (DeepSight signature pattern, desktop only) */}
            <DoodleBackground variant="tech" />
            {/* Halo radial brand (indigo / violet / cyan) — subtle, non-aurora */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(60% 50% at 50% 35%, rgba(99,102,241,0.10), transparent 60%), radial-gradient(40% 40% at 75% 85%, rgba(6,182,212,0.08), transparent 70%), radial-gradient(40% 40% at 25% 85%, rgba(139,92,246,0.08), transparent 70%)",
              }}
            />
          </motion.div>

          {/* Dialog */}
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            tabIndex={-1}
            className="relative z-10 w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-[760px] sm:mx-4 sm:rounded-2xl bg-[#12121a]/80 backdrop-blur-2xl border-0 sm:border sm:border-white/10 shadow-[0_20px_60px_-20px_rgba(99,102,241,0.35)] flex flex-col focus:outline-none overflow-hidden"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <p id={descId} className="sr-only">
              {tr(
                "Conversation vocale avec DeepSight",
                "Voice conversation with DeepSight",
              )}
            </p>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
              <div className="flex-1 min-w-0 pr-4 flex items-center gap-3">
                {/* Avatar dynamique de l'agent */}
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500/30 to-fuchsia-500/30 border border-white/10 flex items-center justify-center">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={tr("Avatar de l'agent", "Agent avatar")}
                        className="w-full h-full object-cover"
                        loading="eager"
                      />
                    ) : avatarStatus === "generating" ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-text-secondary uppercase">
                        {(avatarFallback || "AI").slice(0, 2)}
                      </span>
                    )}
                  </div>
                  {voiceStatus === "speaking" && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[#0b0b14] animate-pulse" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2
                    id={titleId}
                    className="text-sm sm:text-base font-semibold text-white truncate"
                    title={videoTitle}
                  >
                    {videoTitle}
                  </h2>
                  {channelName && (
                    <p className="text-xs text-text-muted mt-0.5 truncate">
                      {channelName}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {playbackRate && playbackRate > 1.0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                    {playbackRate}x
                  </span>
                )}
                {/* Always-visible Stop button whenever a session exists
                    (connecting / active / error). User can always abort. */}
                {hasActiveSession && (
                  <button
                    type="button"
                    onClick={safeStop}
                    className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all focus-visible:ring-2 focus-visible:ring-red-400"
                    title={tr("Arrêter l'appel", "Stop call")}
                    aria-label={tr("Arrêter l'appel", "Stop call")}
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span className="text-xs font-semibold hidden sm:inline">
                      {tr("Arrêter", "Stop")}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-text-tertiary hover:text-text-secondary hover:bg-white/10 transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-indigo-400"
                  title={tr("Paramètres voix", "Voice settings")}
                  aria-label={tr(
                    "Ouvrir les paramètres voix",
                    "Open voice settings",
                  )}
                >
                  <Settings2 className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-text-muted hover:text-white hover:bg-white/10 transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-indigo-400"
                  aria-label={tr("Fermer", "Close")}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Center — Thumbnail hero + status zone */}
            <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-8 min-h-[200px]">
              {/* Large video thumbnail with glow aura (visual anchor for the call) */}
              <VideoStage
                thumbnailUrl={videoThumbnailUrl}
                isActive={isActive}
                isSpeaking={isSpeaking}
                videoTitle={videoTitle}
                voiceThumb={voiceThumb}
              />

              <VoiceToolIndicator
                toolName={activeTool ?? null}
                isActive={!!activeTool}
              />
              {renderCenterContent()}
            </div>

            {/* Transcript zone — live bubbles with blinking cursor on the
                currently-spoken AI message. Persists after stop so the user
                can review before closing. */}
            {messages.length > 0 && (
              <div
                ref={transcriptRef}
                className="mx-4 mb-3 max-h-[220px] overflow-y-auto rounded-xl bg-white/[0.03] border border-white/5 scroll-smooth"
                aria-label={tr(
                  "Transcription de la conversation",
                  "Conversation transcript",
                )}
                role="log"
                aria-live="polite"
              >
                <VoiceTranscript
                  messages={messages}
                  isLive={
                    voiceStatus === "thinking" || voiceStatus === "speaking"
                  }
                />
              </div>
            )}

            {/* Footer — controls */}
            {isActive && (
              <motion.div
                className="flex items-center justify-between px-5 py-4 border-t border-white/5 flex-shrink-0"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {inputMode === "ptt" && onStartTalking && onStopTalking ? (
                  <>
                    {/* Timer (left) */}
                    <div className="flex flex-col items-center min-w-[60px]">
                      <span className="text-white font-mono text-lg font-medium tabular-nums">
                        {formatTime(elapsedSeconds)}
                      </span>
                      <span className="text-text-tertiary text-[10px] font-mono tabular-nums">
                        / {remainingFormatted} {tr("restantes", "remaining")}
                      </span>
                    </div>

                    {/* PTT Button (center) — halo scales with real mic level */}
                    <VoicePTTButton
                      onStartTalking={onStartTalking}
                      onStopTalking={onStopTalking}
                      isTalking={isTalking}
                      disabled={voiceStatus === "thinking"}
                      micLevel={micLevel}
                    />

                    {/* End call (right) */}
                    <button
                      onClick={safeStop}
                      className="w-11 h-11 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-red-400"
                      aria-label={tr(
                        "Terminer la conversation",
                        "End conversation",
                      )}
                    >
                      <PhoneOff className="w-4.5 h-4.5" />
                    </button>
                  </>
                ) : (
                  <>
                    {/* VAD mode: original layout */}
                    {/* Mute toggle */}
                    <button
                      onClick={onMuteToggle}
                      className={`w-11 h-11 rounded-full flex items-center justify-center transition-all focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                        isMuted
                          ? "bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25"
                          : "bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                      }`}
                      aria-label={
                        isMuted
                          ? tr("Reactiver le micro", "Unmute microphone")
                          : tr("Couper le micro", "Mute microphone")
                      }
                    >
                      {isMuted ? (
                        <MicOff className="w-4.5 h-4.5" />
                      ) : (
                        <Mic className="w-4.5 h-4.5" />
                      )}
                    </button>

                    {/* Timer */}
                    <div className="flex flex-col items-center">
                      <span className="text-white font-mono text-lg font-medium tabular-nums">
                        {formatTime(elapsedSeconds)}
                      </span>
                      <span className="text-text-tertiary text-[10px] font-mono tabular-nums">
                        / {remainingFormatted} {tr("restantes", "remaining")}
                      </span>
                    </div>

                    {/* End call */}
                    <button
                      onClick={safeStop}
                      className="w-11 h-11 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-red-400"
                      aria-label={tr(
                        "Terminer la conversation",
                        "End conversation",
                      )}
                    >
                      <PhoneOff className="w-4.5 h-4.5" />
                    </button>
                  </>
                )}
              </motion.div>
            )}
            {/* ── Settings panel overlay (in-modal) ───────────────────── */}
            {/* Non-destructive overlay: the active call keeps running behind.
                Staged changes are applied via the global StagedPrefsToolbar
                which triggers the restart through the voice prefs bus — we
                never kill the ElevenLabs session to reconfigure mid-call. */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  key="voice-settings-panel"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="absolute inset-0 z-20 bg-[#0a0a0f]/96 backdrop-blur-xl flex flex-col"
                >
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
                    <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-indigo-300" />
                      {tr("Paramètres vocaux", "Voice settings")}
                    </h3>
                    <div className="flex items-center gap-1.5">
                      {/* Stop button also reachable from settings view */}
                      {hasActiveSession && (
                        <button
                          type="button"
                          onClick={safeStop}
                          className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all focus-visible:ring-2 focus-visible:ring-red-400"
                          title={tr("Arrêter l'appel", "Stop call")}
                          aria-label={tr("Arrêter l'appel", "Stop call")}
                        >
                          <PhoneOff className="w-4 h-4" />
                          <span className="text-xs font-semibold hidden sm:inline">
                            {tr("Arrêter", "Stop")}
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowSettings(false)}
                        className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-text-muted hover:text-white hover:bg-white/10 transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-indigo-400"
                        aria-label={tr(
                          "Fermer les paramètres",
                          "Close settings",
                        )}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-3">
                    <Suspense
                      fallback={
                        <div className="flex items-center justify-center h-40">
                          <DeepSightSpinner size="md" />
                        </div>
                      }
                    >
                      <VoiceSettings
                        compact
                        onClose={() => setShowSettings(false)}
                      />
                    </Suspense>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default VoiceModal;
