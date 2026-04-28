/**
 * VoiceCallPage — Companion voice call as a first-class page.
 *
 * Standalone page for free-form voice conversations (no video context).
 * Differs from VoiceModal (analysis-bound) and VoiceOverlay (chat-page
 * floating panel). Plan-gated to Pro tier — free users see an upgrade CTA.
 */

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  AlertCircle,
  ArrowUpCircle,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { SEO } from "../components/SEO";
import { Sidebar } from "../components/layout/Sidebar";
import { useTranslation } from "../hooks/useTranslation";
import { useVoiceChat } from "../components/voice/useVoiceChat";
import { useVoiceEnabled } from "../components/voice/hooks/useVoiceEnabled";
import { useMicLevel } from "../components/voice/hooks/useMicLevel";
import { VoiceWaveform } from "../components/voice/VoiceWaveform";
import { VoiceTranscript } from "../components/voice/VoiceTranscript";
import { VoiceQuotaBadge } from "../components/voice/VoiceQuotaBadge";
import { VoicePTTButton } from "../components/voice/VoicePTTButton";
import { DeepSightSpinner } from "../components/ui/DeepSightSpinner";

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const VoiceCallPage: React.FC = () => {
  const { language } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { voiceEnabled } = useVoiceEnabled();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tr = useCallback(
    (fr: string, en: string) => (language === "fr" ? fr : en),
    [language],
  );

  // Dual-mode driven by URL: ?summary=<id>&autostart=1 switches the page from
  // free-form COMPANION to a video-bound EXPLORER session. The companion
  // agent's `transfer_to_video` tool produces this URL via onTransferRequest.
  const targetSummaryId = useMemo(() => {
    const raw = searchParams.get("summary");
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [searchParams]);

  const shouldAutoStart = searchParams.get("autostart") === "1";

  // Companion → Explorer transfer: navigate so the page re-mounts with the
  // ?summary= URL, which tears down the companion session and provisions a
  // fresh explorer session via the standard /api/voice/session flow.
  const handleTransferRequest = useCallback(
    (payload: { summary_id: number; video_title: string }) => {
      navigate(`/voice-call?summary=${payload.summary_id}&autostart=1`, {
        replace: false,
      });
    },
    [navigate],
  );

  const voice = useVoiceChat({
    agentType: targetSummaryId ? "explorer" : "companion",
    summaryId: targetSummaryId ?? undefined,
    language,
    onTransferRequest: targetSummaryId ? undefined : handleTransferRequest,
  });

  const isActive =
    voice.status === "listening" ||
    voice.status === "speaking" ||
    voice.status === "thinking";
  const hasActiveSession =
    isActive || voice.status === "connecting" || voice.status === "error";

  const micLevel = useMicLevel(voice.micStream, isActive);

  // Stop the call when leaving the page.
  useEffect(() => {
    return () => {
      void voice.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-start the explorer session when arriving via a transfer URL
  // (?summary=<id>&autostart=1). We only auto-start once per mount and
  // only when the call is idle to avoid double-starting after a reload.
  useEffect(() => {
    if (!voiceEnabled) return;
    if (!targetSummaryId || !shouldAutoStart) return;
    if (voice.status !== "idle") return;
    Promise.resolve(voice.start()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceEnabled, targetSummaryId, shouldAutoStart]);

  const safeStart = useCallback(() => {
    Promise.resolve(voice.start()).catch(() => {});
  }, [voice]);

  const safeStop = useCallback(() => {
    Promise.resolve(voice.stop()).catch(() => {});
  }, [voice]);

  // Quota math — VoiceQuotaBadge expects used / total minutes.
  const minutesUsed = voice.elapsedSeconds / 60;
  const minutesTotal = Math.max(
    minutesUsed,
    minutesUsed + voice.remainingMinutes,
  );

  // ── Status indicator (waveform + label) ──
  const renderStatus = () => {
    switch (voice.status) {
      case "idle":
        return (
          <p className="text-sm text-text-tertiary">
            {tr(
              "Prêt à démarrer une conversation.",
              "Ready to start a conversation.",
            )}
          </p>
        );
      case "connecting":
        return (
          <div className="flex items-center gap-3 text-text-secondary">
            <DeepSightSpinner size="sm" />
            <span className="text-sm">{tr("Connexion…", "Connecting…")}</span>
          </div>
        );
      case "listening":
        return (
          <div className="flex flex-col items-center gap-2">
            <VoiceWaveform
              mode="user"
              intensity={Math.max(0.15, micLevel)}
              color="indigo"
              size="md"
            />
            <p className="text-sm font-medium text-green-400">
              {voice.isTalking
                ? tr("Parlez maintenant…", "Speak now…")
                : tr("À l'écoute", "Listening")}
            </p>
          </div>
        );
      case "thinking":
        return (
          <div className="flex flex-col items-center gap-2">
            <DeepSightSpinner size="md" />
            <p className="text-sm text-indigo-300">
              {tr("Réflexion…", "Thinking…")}
            </p>
          </div>
        );
      case "speaking":
        return (
          <div className="flex flex-col items-center gap-2">
            <VoiceWaveform mode="ai" intensity={0.8} color="violet" size="md" />
            <p className="text-sm font-medium text-violet-300">
              {tr("DeepSight parle…", "DeepSight is speaking…")}
            </p>
          </div>
        );
      case "error":
        return (
          <div className="flex flex-col items-center gap-3 max-w-md text-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-red-300">
              {voice.error ||
                tr("Une erreur est survenue.", "An error occurred.")}
            </p>
            <button
              type="button"
              onClick={safeStart}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              {tr("Réessayer", "Retry")}
            </button>
          </div>
        );
      case "quota_exceeded":
        return (
          <div className="flex flex-col items-center gap-3 max-w-md text-center">
            <AlertCircle className="w-8 h-8 text-amber-400" />
            <p className="text-sm font-medium text-amber-300">
              {tr("Quota de minutes épuisé", "Voice minutes quota exceeded")}
            </p>
            <button
              type="button"
              onClick={() => navigate("/upgrade?source=voice_call")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-medium text-sm hover:shadow-lg hover:shadow-indigo-500/25 transition-shadow"
            >
              <ArrowUpCircle className="w-4 h-4" />
              {tr("Passer au plan supérieur", "Upgrade plan")}
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  // ── Plan-gated upgrade view ──
  if (!voiceEnabled) {
    return (
      <div className="min-h-screen bg-bg-primary relative">
        <SEO title={tr("Appel vocal", "Voice call")} path="/voice-call" />
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
        <main
          id="main-content"
          className={`transition-all duration-200 ease-out relative z-10 ${
            sidebarCollapsed ? "lg:ml-[60px]" : "lg:ml-[240px]"
          }`}
        >
          <div className="min-h-screen pt-14 lg:pt-0 p-4 sm:p-6 lg:p-8 pb-8 flex items-center justify-center">
            <div className="max-w-md w-full text-center space-y-6">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center">
                <Phone className="w-10 h-10 text-violet-300" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-text-primary">
                  {tr("Appel vocal", "Voice call")}
                </h1>
                <p className="text-text-secondary">
                  {tr(
                    "Discutez librement avec DeepSight via votre voix. Disponible sur le plan Pro.",
                    "Talk freely with DeepSight using your voice. Available on the Pro plan.",
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/upgrade?source=voice_call")}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-medium hover:shadow-lg hover:shadow-indigo-500/25 transition-shadow"
              >
                <Sparkles className="w-4 h-4" />
                {tr("Passer au Pro", "Upgrade to Pro")}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Main view ──
  return (
    <div className="min-h-screen bg-bg-primary relative">
      <SEO title={tr("Appel vocal", "Voice call")} path="/voice-call" />
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <main
        id="main-content"
        className={`transition-all duration-200 ease-out relative z-10 ${
          sidebarCollapsed ? "lg:ml-[60px]" : "lg:ml-[240px]"
        }`}
      >
        <div className="min-h-screen pt-14 lg:pt-0 p-4 sm:p-6 lg:p-8 pb-8">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <header className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-violet-300" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-semibold text-text-primary">
                    {targetSummaryId
                      ? tr("Appel sur ta vidéo", "Call on your video")
                      : tr("Appel vocal", "Voice call")}
                  </h1>
                  <p className="text-sm text-text-secondary">
                    {targetSummaryId
                      ? tr(
                          `Session vocale ciblée sur l'analyse #${targetSummaryId}`,
                          `Voice session focused on analysis #${targetSummaryId}`,
                        )
                      : tr(
                          "Compagnon de réflexion — discutez librement avec DeepSight",
                          "Reflection companion — talk freely with DeepSight",
                        )}
                  </p>
                </div>
              </div>
              <VoiceQuotaBadge
                minutesUsed={minutesUsed}
                minutesTotal={minutesTotal || 1}
              />
            </header>

            {/* Hero card */}
            <section className="card relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none opacity-30">
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(60% 60% at 50% 30%, rgba(139, 92, 246, 0.20), transparent 70%), radial-gradient(50% 50% at 80% 90%, rgba(6, 182, 212, 0.15), transparent 75%)",
                  }}
                />
              </div>
              <div className="relative z-10 panel-body flex flex-col items-center justify-center gap-6 py-12 min-h-[320px]">
                {/* Companion avatar */}
                <motion.div
                  className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500/30 via-violet-500/30 to-cyan-500/20 border border-white/10 flex items-center justify-center shadow-2xl shadow-violet-500/20"
                  animate={
                    voice.status === "speaking"
                      ? { scale: [1, 1.04, 1] }
                      : isActive
                        ? { scale: [1, 1.02, 1] }
                        : { scale: 1 }
                  }
                  transition={{
                    duration: voice.status === "speaking" ? 1.5 : 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <Sparkles className="w-10 h-10 text-violet-200" />
                </motion.div>

                {/* Status / waveform area */}
                <div className="min-h-[80px] flex items-center justify-center">
                  {renderStatus()}
                </div>

                {/* Idle CTA */}
                {voice.status === "idle" && (
                  <motion.button
                    type="button"
                    onClick={safeStart}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 text-white font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-shadow focus-visible:ring-2 focus-visible:ring-violet-400/60"
                    data-testid="voice-call-start"
                  >
                    <Phone className="w-5 h-5" />
                    {tr("Démarrer l'appel", "Start the call")}
                  </motion.button>
                )}
              </div>
            </section>

            {/* Live transcript */}
            <AnimatePresence>
              {voice.messages.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  className="card overflow-hidden"
                >
                  <div className="panel-header">
                    <h2 className="font-semibold text-text-primary text-sm">
                      {tr("Transcription", "Transcript")}
                    </h2>
                  </div>
                  <div className="panel-body p-0">
                    <VoiceTranscript
                      messages={voice.messages}
                      isLive={
                        voice.status === "thinking" ||
                        voice.status === "speaking"
                      }
                    />
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* Active session controls */}
            {isActive && (
              <motion.section
                className="card"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="panel-body flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-text-primary font-mono text-lg font-medium tabular-nums">
                      {formatTime(voice.elapsedSeconds)}
                    </span>
                    <span className="text-text-tertiary text-[10px] font-mono tabular-nums">
                      / {formatTime(voice.remainingMinutes * 60)}{" "}
                      {tr("restantes", "remaining")}
                    </span>
                  </div>

                  {voice.inputMode === "ptt" ? (
                    <VoicePTTButton
                      onStartTalking={voice.startTalking}
                      onStopTalking={voice.stopTalking}
                      isTalking={voice.isTalking}
                      disabled={voice.status === "thinking"}
                      micLevel={micLevel}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={voice.toggleMute}
                      aria-label={
                        voice.isMuted
                          ? tr("Réactiver le micro", "Unmute microphone")
                          : tr("Couper le micro", "Mute microphone")
                      }
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                        voice.isMuted
                          ? "bg-red-500/15 border border-red-500/30 text-red-400"
                          : "bg-white/5 border border-white/10 text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {voice.isMuted ? (
                        <MicOff className="w-5 h-5" />
                      ) : (
                        <Mic className="w-5 h-5" />
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={safeStop}
                    aria-label={tr(
                      "Terminer la conversation",
                      "End conversation",
                    )}
                    className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-red-400"
                    data-testid="voice-call-end"
                  >
                    <PhoneOff className="w-5 h-5" />
                  </button>
                </div>
              </motion.section>
            )}

            {/* Stop button when connecting / error (no active controls yet) */}
            {hasActiveSession && !isActive && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={safeStop}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all text-xs font-semibold"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  {tr("Arrêter", "Stop")}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default VoiceCallPage;
