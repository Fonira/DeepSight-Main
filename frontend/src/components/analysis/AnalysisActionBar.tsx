/**
 * DEEP SIGHT — AnalysisActionBar v1.0
 * Barre d'actions unifiée pour toutes les vues d'analyse
 *
 * Hero CTA : Voice Agent (ElevenLabs) — plus gros, gradient accent, pulse
 * Actions : Copier, Partager, Exporter, Étude, Audio, Citation
 *
 * Sticky horizontal bar, glassmorphism, responsive
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  Copy,
  Check,
  Share2,
  Download,
  Brain,
  GraduationCap,
  FileText,
  FileCode,
  AlignLeft,
  ChevronDown,
  Lock,
  Sparkles,
} from "lucide-react";
import {
  DeepSightSpinner,
  DeepSightSpinnerSmall,
} from "../ui/DeepSightSpinner";
import { useAuth } from "../../hooks/useAuth";
import { PLAN_LIMITS, normalizePlanId } from "../../config/planPrivileges";
import { videoApi, shareApi } from "../../services/api";
import { useToast } from "../Toast";
import { AudioSummaryButton } from "../AudioSummaryButton";
import { sanitizeTitle } from "../../utils/sanitize";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface AnalysisActionBarProps {
  summary: {
    id: number;
    video_id: string;
    video_title: string;
    video_channel?: string;
    summary_content?: string;
  };
  language: "fr" | "en";
  onOpenVoice?: () => void;
  onOpenStudyTools?: () => void;
  onOpenCitation?: () => void;
  onAudioReady?: (url: string) => void;
  showStudyTools?: boolean;
  showCitation?: boolean;
  sticky?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Voice Agent Icon (stylized mic + sound waves)
// ═══════════════════════════════════════════════════════════════════════════════

const VoiceAgentIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <path d="M20 5c1.5 2 2 4 2 7s-.5 5-2 7" opacity="0.6" />
    <path d="M4 5c-1.5 2-2 4-2 7s.5 5 2 7" opacity="0.6" />
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Hero glow animation
// ═══════════════════════════════════════════════════════════════════════════════

const heroGlow = {
  idle: {
    boxShadow: [
      "0 0 0 0 rgba(99, 102, 241, 0)",
      "0 0 24px 6px rgba(99, 102, 241, 0.25)",
      "0 0 0 0 rgba(99, 102, 241, 0)",
    ],
    transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" as const },
  },
  locked: { boxShadow: "0 0 0 0 rgba(99, 102, 241, 0)" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ActionButton — Bouton d'action individuel redesigné (plus gros)
// ═══════════════════════════════════════════════════════════════════════════════

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  showChevron?: boolean;
}

const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    {
      icon,
      label,
      onClick,
      disabled = false,
      active = false,
      showChevron = false,
    },
    ref,
  ) => (
    <motion.button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      className={`
        flex items-center gap-2
        px-3 py-2 sm:px-4 sm:py-2.5
        rounded-lg
        text-[13px] font-medium
        transition-all duration-200
        outline-none
        focus-visible:ring-2 focus-visible:ring-indigo-500/40
        disabled:opacity-40 disabled:cursor-not-allowed
        ${
          active
            ? "bg-white/[0.1] text-white border border-white/15"
            : "bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white/90 border border-white/[0.06] hover:border-white/[0.12]"
        }
        flex-shrink-0
      `}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="hidden sm:inline whitespace-nowrap">{label}</span>
      {showChevron && (
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform hidden sm:block ${active ? "rotate-180" : ""}`}
        />
      )}
    </motion.button>
  ),
);

ActionButton.displayName = "ActionButton";

// ═══════════════════════════════════════════════════════════════════════════════
// ExportOption — Ligne dans le menu dropdown
// ═══════════════════════════════════════════════════════════════════════════════

interface ExportOptionProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  loading?: boolean;
}

const ExportOption: React.FC<ExportOptionProps> = ({
  icon,
  label,
  description,
  onClick,
  loading,
}) => (
  <button
    onClick={onClick}
    disabled={loading}
    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.06] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <span className="flex-shrink-0">
      {loading ? <DeepSightSpinnerSmall /> : icon}
    </span>
    <div className="min-w-0">
      <p className="text-sm font-medium text-text-primary">{label}</p>
      <p className="text-xs text-text-muted">{description}</p>
    </div>
  </button>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export const AnalysisActionBar: React.FC<AnalysisActionBarProps> = ({
  summary,
  language,
  onOpenVoice,
  onOpenStudyTools,
  onOpenCitation,
  showStudyTools = true,
  showCitation = true,
  sticky = true,
}) => {
  const { user } = useAuth();
  const { showToast, ToastComponent } = useToast();
  const plan = normalizePlanId(user?.plan);
  const ADMIN_EMAIL = "maximeleparc3@gmail.com";
  const isAdmin =
    user?.is_admin || user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const voiceEnabled =
    isAdmin || (PLAN_LIMITS[plan]?.voiceChatEnabled ?? false);

  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  // --- Export menu position ---
  const updateMenuPos = useCallback(() => {
    if (exportBtnRef.current) {
      const rect = exportBtnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 8, left: Math.max(8, rect.left) });
    }
  }, []);

  useEffect(() => {
    if (!showExportMenu) return;
    updateMenuPos();
    const handleClickOutside = (e: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node) &&
        exportBtnRef.current &&
        !exportBtnRef.current.contains(e.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };
    const handleDismiss = () => setShowExportMenu(false);
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("resize", handleDismiss);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("resize", handleDismiss);
    };
  }, [showExportMenu, updateMenuPos]);

  // --- Handlers ---
  const handleCopy = useCallback(async () => {
    if (!summary?.summary_content) return;
    try {
      await navigator.clipboard.writeText(summary.summary_content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(
        language === "fr" ? "Impossible de copier" : "Copy failed",
        "error",
      );
    }
  }, [summary?.summary_content, language, showToast]);

  const handleShare = useCallback(async () => {
    if (!summary?.video_id || sharing) return;
    setSharing(true);
    try {
      const { share_url } = await shareApi.createShareLink(summary.video_id);
      if (navigator.share) {
        await navigator.share({
          title: summary.video_title
            ? `DeepSight — ${summary.video_title}`
            : "DeepSight Analysis",
          url: share_url,
        });
      } else {
        await navigator.clipboard.writeText(share_url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
        showToast(
          language === "fr" ? "Lien copié !" : "Link copied!",
          "success",
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      showToast(
        language === "fr" ? "Erreur de partage" : "Share error",
        "error",
      );
    } finally {
      setSharing(false);
    }
  }, [summary?.video_id, summary?.video_title, sharing, language, showToast]);

  const handleExport = useCallback(
    async (format: "pdf" | "md" | "txt") => {
      if (!summary?.id) return;
      setExportingFormat(format);
      setShowExportMenu(false);
      try {
        const blob = await videoApi.exportSummary(summary.id, format);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `DeepSight - ${sanitizeTitle(summary.video_title || "analyse")}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        const nameMap: Record<string, string> = {
          pdf: "PDF",
          md: "Markdown",
          txt: "Texte",
        };
        showToast(
          `Export ${nameMap[format]} ${language === "fr" ? "téléchargé" : "downloaded"}`,
          "success",
        );
      } catch {
        showToast(
          language === "fr" ? "Erreur d'export" : "Export error",
          "error",
        );
      } finally {
        setExportingFormat(null);
      }
    },
    [summary?.id, summary?.video_title, language, showToast],
  );

  const isVoiceLocked = !voiceEnabled;

  return (
    <>
      {ToastComponent}
      <div
        className={`w-full rounded-2xl relative overflow-hidden ${sticky ? "sticky top-4 z-30" : ""}`}
        style={{
          background:
            "linear-gradient(135deg, rgba(15,15,25,0.85) 0%, rgba(20,20,35,0.9) 100%)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Gradient accent top line */}
        <div
          className="absolute top-0 left-4 right-4 h-px rounded-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, #6366f1, #8b5cf6, #06b6d4, transparent)",
          }}
        />

        <div className="px-3 py-3 sm:px-4 sm:py-3.5">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            {/* ═══════════════════════════════════════════════════════════
                 HERO CTA — Voice Agent (ElevenLabs)
                 ═══════════════════════════════════════════════════════════ */}
            <motion.button
              onClick={isVoiceLocked ? undefined : onOpenVoice}
              disabled={isVoiceLocked}
              className={`
                relative flex items-center gap-2.5 sm:gap-3
                px-4 sm:px-5 py-2.5 sm:py-3
                rounded-xl
                font-semibold text-sm
                transition-all duration-300
                outline-none
                focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]
                ${
                  isVoiceLocked
                    ? "bg-white/[0.04] border border-white/10 text-white/40 cursor-not-allowed"
                    : "cursor-pointer"
                }
                group min-w-0 lg:flex-shrink-0
              `}
              style={
                !isVoiceLocked
                  ? {
                      background:
                        "linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.2) 50%, rgba(6,182,212,0.15) 100%)",
                      border: "1px solid rgba(99,102,241,0.35)",
                    }
                  : undefined
              }
              variants={heroGlow}
              animate={isVoiceLocked ? "locked" : "idle"}
              whileHover={!isVoiceLocked ? { scale: 1.02 } : undefined}
              whileTap={!isVoiceLocked ? { scale: 0.98 } : undefined}
            >
              {/* Icon container */}
              <div
                className={`
                relative flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center
                ${isVoiceLocked ? "bg-white/5" : "bg-gradient-to-br from-indigo-500/30 to-violet-500/30"}
              `}
              >
                {isVoiceLocked ? (
                  <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-text-tertiary" />
                ) : (
                  <VoiceAgentIcon className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-300 group-hover:text-indigo-200 transition-colors" />
                )}
                {!isVoiceLocked && (
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </div>

              {/* Text */}
              <div className="flex flex-col items-start min-w-0">
                <span
                  className={`
                  font-bold tracking-tight truncate
                  ${isVoiceLocked ? "text-white/40 text-[13px]" : "text-white/90 group-hover:text-white text-[13px] sm:text-sm"}
                  transition-colors
                `}
                >
                  {isVoiceLocked
                    ? language === "fr"
                      ? "Agent vocal verrouillé"
                      : "Voice Agent locked"
                    : language === "fr"
                      ? "Parler avec l'Agent IA"
                      : "Talk to AI Agent"}
                </span>
                <span
                  className={`
                  text-[11px] sm:text-xs truncate
                  ${isVoiceLocked ? "text-white/25" : "text-white/45 group-hover:text-white/55"}
                  transition-colors
                `}
                >
                  {isVoiceLocked
                    ? language === "fr"
                      ? "Disponible dès le plan Étudiant"
                      : "Available from Student plan"
                    : language === "fr"
                      ? "Propulsé par ElevenLabs"
                      : "Powered by ElevenLabs"}
                </span>
              </div>

              {!isVoiceLocked && (
                <Sparkles className="w-4 h-4 text-indigo-400/50 group-hover:text-indigo-300/80 flex-shrink-0 transition-colors ml-auto hidden sm:block" />
              )}
            </motion.button>

            {/* ═══════════════════════════════════════════════════════════
                 ACTION BUTTONS — F8 : overflow-x-auto pour éviter
                 troncature à droite ≥lg (Citer / Écouter coupés).
                 ═══════════════════════════════════════════════════════════ */}
            <div
              role="toolbar"
              aria-label="Actions de la synthèse"
              className="flex items-center gap-1.5 sm:gap-2 flex-nowrap overflow-x-auto scrollbar-hide lg:ml-auto"
            >
              {/* Copier */}
              <ActionButton
                icon={
                  copied ? (
                    <Check className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )
                }
                label={
                  copied
                    ? language === "fr"
                      ? "Copié !"
                      : "Copied!"
                    : language === "fr"
                      ? "Copier"
                      : "Copy"
                }
                onClick={handleCopy}
                active={copied}
              />

              {/* Partager */}
              <ActionButton
                icon={
                  sharing ? (
                    <DeepSightSpinnerSmall />
                  ) : shareCopied ? (
                    <Check className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Share2 className="w-5 h-5" />
                  )
                }
                label={
                  shareCopied
                    ? language === "fr"
                      ? "Lien copié"
                      : "Link copied"
                    : language === "fr"
                      ? "Partager"
                      : "Share"
                }
                onClick={handleShare}
                disabled={sharing}
                active={shareCopied}
              />

              {/* Exporter */}
              <ActionButton
                ref={exportBtnRef}
                icon={
                  exportingFormat ? (
                    <DeepSightSpinnerSmall />
                  ) : (
                    <Download className="w-5 h-5" />
                  )
                }
                label="Export"
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={!!exportingFormat}
                showChevron
                active={showExportMenu}
              />

              {/* Audio Synthèse */}
              <div className="flex-shrink-0">
                <AudioSummaryButton
                  summaryId={summary.id}
                  videoTitle={sanitizeTitle(summary.video_title || "")}
                  language={language}
                  compact={false}
                />
              </div>

              {/* Outils d'étude */}
              {showStudyTools && onOpenStudyTools && (
                <ActionButton
                  icon={<Brain className="w-5 h-5" />}
                  label={language === "fr" ? "Réviser" : "Study"}
                  onClick={onOpenStudyTools}
                />
              )}

              {/* Citation */}
              {showCitation && onOpenCitation && (
                <ActionButton
                  icon={<GraduationCap className="w-5 h-5" />}
                  label={language === "fr" ? "Citer" : "Cite"}
                  onClick={onOpenCitation}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Export dropdown (portal) */}
      {showExportMenu &&
        createPortal(
          <div
            ref={exportMenuRef}
            className="fixed w-56 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl py-2 animate-fadeIn"
            style={{ top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          >
            <ExportOption
              icon={<FileText className="w-5 h-5 text-red-400" />}
              label="PDF"
              description={
                language === "fr"
                  ? "Export professionnel"
                  : "Professional layout"
              }
              onClick={() => handleExport("pdf")}
              loading={exportingFormat === "pdf"}
            />
            <ExportOption
              icon={<FileCode className="w-5 h-5 text-blue-400" />}
              label="Markdown"
              description={
                language === "fr" ? "Format éditable" : "Editable format"
              }
              onClick={() => handleExport("md")}
              loading={exportingFormat === "md"}
            />
            <ExportOption
              icon={<AlignLeft className="w-5 h-5 text-gray-400" />}
              label={language === "fr" ? "Texte brut" : "Plain text"}
              description={
                language === "fr"
                  ? "Copier-coller universel"
                  : "Universal copy-paste"
              }
              onClick={() => handleExport("txt")}
              loading={exportingFormat === "txt"}
            />
          </div>,
          document.body,
        )}
    </>
  );
};

export default AnalysisActionBar;
