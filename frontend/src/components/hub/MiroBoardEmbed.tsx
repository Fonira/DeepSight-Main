/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🎨 MIRO BOARD EMBED — Hub Workspace MVP (Wave 2a)                                 ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Composant pur prop-driven pour afficher un workspace Miro lié au Hub DeepSight.   ║
 * ║                                                                                    ║
 * ║  - status="pending"|"creating" → skeleton glassmorphism + spinner                  ║
 * ║  - status="ready" + boardId → iframe embed Miro view-only                          ║
 * ║  - status="ready" sans boardId → fallback compact + lien viewLink optionnel        ║
 * ║  - status="failed" → bloc erreur amber/red + bouton "Réessayer" (onRetry)          ║
 * ║                                                                                    ║
 * ║  Aucun appel API, aucun state global. Factorisé depuis DebateMiroEmbed pour        ║
 * ║  réutilisation Hub Workspace MVP. DebateMiroEmbed reste intact (prod Débat IA).    ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React from "react";
import { motion } from "framer-motion";
import { Layout, ExternalLink, AlertTriangle } from "lucide-react";
import { DeepSightSpinnerSmall } from "../ui/DeepSightSpinner";

export interface MiroBoardEmbedProps {
  /** Miro board ID (sans le préfixe). Si null/undefined : montre fallback */
  boardId: string | null;
  /** URL view-only public ou auth Miro. Optionnel — si fourni, utilisé pour le href du fallback link */
  viewLink?: string | null;
  /** État du board côté DeepSight backend. Pilote le rendu : skeleton si creating, erreur si failed, embed si ready */
  status: "pending" | "creating" | "ready" | "failed";
  /** Message d'erreur backend si status=failed */
  errorMessage?: string | null;
  /** Hauteur iframe (default 600px) */
  height?: number;
  /** Callback quand iframe a loaded — pour métriques / loading state externe */
  onLoad?: () => void;
  /** Callback "Réessayer" sur état failed — bouton n'est rendu que si fourni */
  onRetry?: () => void;
  /** ClassName additionnelle */
  className?: string;
}

/**
 * Construit l'URL d'embed Miro à partir d'un board ID.
 *
 * Pattern Miro : `https://miro.com/app/embed/{boardId}/?embedMode=view_only_without_ui&moveToViewport=fit`
 */
function buildEmbedUrl(boardId: string): string {
  return `https://miro.com/app/embed/${boardId}/?embedMode=view_only_without_ui&moveToViewport=fit`;
}

export const MiroBoardEmbed: React.FC<MiroBoardEmbedProps> = ({
  boardId,
  viewLink,
  status,
  errorMessage,
  height = 600,
  onLoad,
  onRetry,
  className = "",
}) => {
  const isLoading = status === "pending" || status === "creating";

  // ─── Skeleton (pending / creating) ───
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        role="region"
        aria-label="Hub Workspace Miro Board"
        aria-busy={status === "creating"}
        className={`backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl overflow-hidden ${className}`}
        data-testid="miro-board-embed-skeleton"
      >
        <div
          className="flex flex-col items-center justify-center gap-4 p-8"
          style={{ minHeight: height }}
        >
          <DeepSightSpinnerSmall />
          <div className="text-center">
            <p className="text-sm font-medium text-white">
              Création du workspace Miro…
            </p>
            <p className="text-xs text-text-muted mt-1">
              Quelques secondes, on prépare ton board.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // ─── Failed ───
  if (status === "failed") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        role="region"
        aria-label="Hub Workspace Miro Board"
        className={`backdrop-blur-xl bg-red-500/10 border border-red-500/20 rounded-xl overflow-hidden p-4 ${className}`}
        data-testid="miro-board-embed-error"
      >
        <div className="flex items-start gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-400">
              Workspace Miro indisponible
            </p>
            {errorMessage && (
              <p className="text-xs text-red-300/80 mt-1 break-words">
                {errorMessage}
              </p>
            )}
          </div>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-medium text-red-300 hover:text-red-200 underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 rounded"
            data-testid="miro-board-embed-retry"
          >
            Réessayer
          </button>
        )}
      </motion.div>
    );
  }

  // ─── Ready : fallback si pas de boardId ───
  if (!boardId) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        role="region"
        aria-label="Hub Workspace Miro Board"
        className={`backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl overflow-hidden p-5 ${className}`}
        data-testid="miro-board-embed-fallback"
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-yellow-500/15 border border-yellow-500/25 flex items-center justify-center">
            <Layout className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">
              Workspace en cours d'initialisation
            </p>
            <p className="text-xs text-text-muted mt-1">
              Le board Miro sera disponible dans quelques instants.
            </p>
            {viewLink && (
              <a
                href={viewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-text-secondary hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/60"
                data-testid="miro-board-embed-fallback-link"
              >
                Ouvrir dans Miro
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // ─── Ready : iframe embed ───
  const embedUrl = buildEmbedUrl(boardId);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      role="region"
      aria-label="Hub Workspace Miro Board"
      className={`backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl overflow-hidden ${className}`}
      data-testid="miro-board-embed-ready"
    >
      <iframe
        src={embedUrl}
        width="100%"
        height={height}
        title="Miro Workspace"
        loading="lazy"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={onLoad}
        className="block w-full border-0"
        data-testid="miro-board-embed-iframe"
      />
    </motion.div>
  );
};

export default MiroBoardEmbed;
