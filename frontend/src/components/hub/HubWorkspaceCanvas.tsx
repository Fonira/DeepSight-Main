/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🎨 HUB WORKSPACE CANVAS v2 — rendu natif enrichi (2026-05-06)                     ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Remplace l'embed Miro iframe par un rendu HTML/React natif inspiré du composant   ║
 * ║  DebateConvergenceDivergence (style apprécié par l'utilisateur sur Débat IA).      ║
 * ║                                                                                    ║
 * ║  v1 (initial) : 2 sections (concepts partagés + perspectives par thème).           ║
 * ║  v2 (enrichi) : ajoute synthesis + theme.description + perspective.key_quote.      ║
 * ║                                                                                    ║
 * ║  Sections rendues :                                                                ║
 * ║    1. Synthèse transversale (cyan, optionnel — affiché si présent)                 ║
 * ║    2. Concepts partagés (emerald)                                                  ║
 * ║    3. Perspectives complémentaires (indigo/violet) avec :                          ║
 * ║         - description du thème (optionnel)                                         ║
 * ║         - excerpt riche par analyse                                                ║
 * ║         - key_quote en italique (optionnel)                                        ║
 * ║                                                                                    ║
 * ║  Backward-compat : un canvas v1 (sans synthesis/description/key_quote) reste       ║
 * ║  parfaitement rendu. Workspaces pré-pivot ou Mistral fail → fallback Miro.        ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React from "react";
import { motion } from "framer-motion";
import { Handshake, Layers, Quote, Sparkles } from "lucide-react";

import { MiroBoardEmbed } from "./MiroBoardEmbed";
import type {
  CanvasTheme,
  HubWorkspaceStatus,
  WorkspaceCanvasData,
} from "../../services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SummaryPreview {
  title: string;
  thumbnail?: string;
  channel?: string;
}

export interface HubWorkspaceCanvasProps {
  /** Canvas Mistral. Null = workspace pré-pivot ou Mistral fail → fallback Miro. */
  canvasData: WorkspaceCanvasData | null;
  /** Titres + thumbnails des analyses pour enrichir les cards perspectives. */
  summaryDetails: Record<number, SummaryPreview | null>;
  /** Nom du workspace, pour aria-label. */
  workspaceName: string;
  // ─── Props passées à MiroBoardEmbed quand canvas_data est null ───
  /** Miro board ID (rétro-compat workspaces pré-pivot). */
  boardId: string | null;
  viewLink?: string | null;
  status: HubWorkspaceStatus;
  errorMessage?: string | null;
  onRetry?: () => void;
  className?: string;
}

// ─── Animations ───────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// ─── Sub-section v2 : Synthèse transversale (optionnel) ──────────────────────

interface SynthesisSectionProps {
  synthesis: string;
}

const SynthesisSection: React.FC<SynthesisSectionProps> = ({ synthesis }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className="rounded-xl bg-gradient-to-br from-cyan-500/[0.07] to-indigo-500/[0.05] border border-cyan-500/20 backdrop-blur-xl p-5"
    data-testid="hub-canvas-synthesis"
  >
    <div className="flex items-center gap-2 mb-3">
      <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
        <Sparkles className="w-4 h-4 text-cyan-400" aria-hidden />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">Synthèse transversale</h3>
        <p className="text-xs text-text-muted">
          Vue d'ensemble du workspace
        </p>
      </div>
    </div>
    <p className="text-sm text-text-primary leading-relaxed whitespace-pre-line">
      {synthesis}
    </p>
  </motion.div>
);

// ─── Sub-section : Concepts partagés ───────────────────────────────────────────

interface SharedConceptsSectionProps {
  concepts: string[];
}

const SharedConceptsSection: React.FC<SharedConceptsSectionProps> = ({
  concepts,
}) => (
  <div
    className="rounded-xl bg-white/5 border border-emerald-500/20 backdrop-blur-xl p-5"
    data-testid="hub-canvas-shared-concepts"
  >
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
        <Handshake className="w-4 h-4 text-emerald-400" aria-hidden />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">Concepts partagés</h3>
        <p className="text-xs text-text-muted">
          Ce que plusieurs analyses ont en commun
        </p>
      </div>
    </div>

    <motion.ul
      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {concepts.map((concept, i) => (
        <motion.li
          key={`${i}-${concept}`}
          variants={itemVariants}
          className="flex items-start gap-2.5 rounded-lg bg-emerald-500/[0.05] border border-emerald-500/10 p-3"
          data-testid={`hub-canvas-shared-concept-${i}`}
        >
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-emerald-400 text-[10px] font-bold">
              {i + 1}
            </span>
          </div>
          <p className="text-sm text-text-primary leading-relaxed">{concept}</p>
        </motion.li>
      ))}
    </motion.ul>
  </div>
);

// ─── Sub-section : Perspectives complémentaires ────────────────────────────────

interface ThemesSectionProps {
  themes: CanvasTheme[];
  summaryDetails: Record<number, SummaryPreview | null>;
}

const ThemesSection: React.FC<ThemesSectionProps> = ({
  themes,
  summaryDetails,
}) => (
  <div
    className="rounded-xl bg-white/5 border border-indigo-500/20 backdrop-blur-xl p-5"
    data-testid="hub-canvas-themes"
  >
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
        <Layers className="w-4 h-4 text-indigo-400" aria-hidden />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">
          Perspectives complémentaires
        </h3>
        <p className="text-xs text-text-muted">
          Chaque thématique vue par les analyses concernées
        </p>
      </div>
    </div>

    <motion.div
      className="space-y-5"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {themes.map((theme, i) => (
        <motion.div
          key={`${i}-${theme.theme}`}
          variants={itemVariants}
          className="rounded-lg bg-indigo-500/[0.05] border border-indigo-500/10 p-4 space-y-3"
          data-testid={`hub-canvas-theme-${i}`}
        >
          {/* Theme header : title + (optional) description */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              {theme.theme}
            </p>
            {theme.description && (
              <p
                className="text-xs text-text-secondary leading-relaxed italic"
                data-testid={`hub-canvas-theme-description-${i}`}
              >
                {theme.description}
              </p>
            )}
          </div>

          {/* Perspectives grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {theme.perspectives.map((perspective, j) => {
              const detail = summaryDetails[perspective.summary_id];
              const fallbackTitle = `Analyse #${perspective.summary_id}`;
              return (
                <div
                  key={`${i}-${j}-${perspective.summary_id}`}
                  className="rounded-md bg-violet-500/[0.06] border border-violet-500/15 p-3 flex flex-col gap-2"
                  data-testid={`hub-canvas-perspective-${i}-${perspective.summary_id}`}
                >
                  {/* Header : thumbnail + title */}
                  <div className="flex items-start gap-2">
                    {detail?.thumbnail ? (
                      <img
                        src={detail.thumbnail}
                        alt=""
                        className="w-12 h-7 rounded object-cover shrink-0 bg-white/[0.04]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-12 h-7 rounded bg-white/[0.04] shrink-0" />
                    )}
                    <p className="text-[11px] font-semibold text-violet-300 leading-tight line-clamp-2 flex-1">
                      {detail?.title ?? fallbackTitle}
                    </p>
                  </div>

                  {/* Excerpt — riche v2 (3-5 phrases) */}
                  <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">
                    {perspective.excerpt}
                  </p>

                  {/* key_quote optionnel v2 */}
                  {perspective.key_quote && (
                    <div
                      className="flex items-start gap-1.5 pl-2 border-l-2 border-violet-400/40 mt-0.5"
                      data-testid={`hub-canvas-key-quote-${i}-${perspective.summary_id}`}
                    >
                      <Quote
                        className="w-3 h-3 text-violet-400/70 shrink-0 mt-0.5"
                        aria-hidden
                      />
                      <p className="text-[11px] text-violet-200/90 italic leading-relaxed">
                        {perspective.key_quote}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      ))}
    </motion.div>
  </div>
);

// ─── Empty state (canvas vide après validation backend, très rare) ──────────────

const CanvasEmptyState: React.FC = () => (
  <div
    className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl p-8 text-center"
    data-testid="hub-canvas-empty"
  >
    <Sparkles
      className="w-6 h-6 text-text-muted mx-auto mb-2"
      aria-hidden
    />
    <p className="text-sm font-medium text-white mb-1">
      Pas de canvas généré
    </p>
    <p className="text-xs text-text-muted">
      Le canvas natif n'a pas pu être généré pour ce workspace.
    </p>
  </div>
);

// ─── Composant principal ──────────────────────────────────────────────────────

export const HubWorkspaceCanvas: React.FC<HubWorkspaceCanvasProps> = ({
  canvasData,
  summaryDetails,
  workspaceName,
  boardId,
  viewLink,
  status,
  errorMessage,
  onRetry,
  className = "",
}) => {
  // Pivot fallback : workspaces pré-pivot ou Mistral fail → MiroBoardEmbed.
  // Aussi quand status pending/creating/failed : on garde le rendu Miro
  // (skeleton/erreur) jusqu'à status='ready'.
  if (!canvasData || status !== "ready") {
    return (
      <MiroBoardEmbed
        boardId={boardId}
        viewLink={viewLink}
        status={status}
        errorMessage={errorMessage}
        height={700}
        onRetry={onRetry}
        className={className}
      />
    );
  }

  const {
    shared_concepts: sharedConcepts,
    themes,
    synthesis,
  } = canvasData;
  const isEmpty = sharedConcepts.length === 0 && themes.length === 0;

  return (
    <section
      role="region"
      aria-label={`Canvas du workspace ${workspaceName}`}
      data-testid="hub-workspace-canvas"
      className={`space-y-6 ${className}`}
    >
      {synthesis && <SynthesisSection synthesis={synthesis} />}
      {sharedConcepts.length > 0 && (
        <SharedConceptsSection concepts={sharedConcepts} />
      )}
      {themes.length > 0 && (
        <ThemesSection themes={themes} summaryDetails={summaryDetails} />
      )}
      {isEmpty && <CanvasEmptyState />}
    </section>
  );
};

export default HubWorkspaceCanvas;
