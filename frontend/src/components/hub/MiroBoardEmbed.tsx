/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🎨 MIRO BOARD EMBED — Hub Workspace MVP (Wave 2a)                                 ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Composant pur prop-driven pour afficher un workspace Miro lié au Hub DeepSight.   ║
 * ║                                                                                    ║
 * ║  - status="pending"|"creating" → skeleton glassmorphism + spinner                  ║
 * ║  - status="ready" → carte cliquable "Ouvrir dans Miro" (nouvel onglet)             ║
 * ║  - status="failed" → bloc erreur amber/red + bouton "Réessayer" (onRetry)          ║
 * ║                                                                                    ║
 * ║  Pourquoi pas d'iframe embed ?                                                     ║
 * ║  Le plan Miro Personal Starter ($8/mo) ne supporte pas l'embed iframe externe      ║
 * ║  (le board s'affiche "Ce contenu est bloqué"). Le viewLink direct (nouvel onglet)  ║
 * ║  marche par contre sur tous les plans. UX : un clic = board ouvert plein-écran     ║
 * ║  dans Miro, où l'utilisateur retrouve la pleine puissance du whiteboard.           ║
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
  /** Hauteur du bloc ready (default 600px) */
  height?: number;
  /** Conservé pour rétro-compat — l'embed iframe a été remplacé par un lien externe */
  onLoad?: () => void;
  /** Callback "Réessayer" sur état failed — bouton n'est rendu que si fourni */
  onRetry?: () => void;
  /** ClassName additionnelle */
  className?: string;
}

/**
 * Construit l'URL public Miro à ouvrir en nouvel onglet à partir d'un board ID.
 *
 * Pattern Miro standard : `https://miro.com/app/board/{boardId}`
 */
function buildBoardUrl(boardId: string): string {
  return `https://miro.com/app/board/${boardId}`;
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

  // ─── Ready : carte "Ouvrir dans Miro" (le plan Personal Starter ne permet pas l'embed iframe) ───
  const boardUrl = viewLink || (boardId ? buildBoardUrl(boardId) : null);

  if (!boardUrl) {
    // Edge case : status=ready mais ni viewLink ni boardId — affiche un fallback safe
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
              Workspace prêt mais lien indisponible
            </p>
            <p className="text-xs text-text-muted mt-1">
              Réessaie de recharger la page dans quelques instants.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      role="region"
      aria-label="Hub Workspace Miro Board"
      className={`backdrop-blur-xl bg-gradient-to-br from-white/[0.07] to-white/[0.03] border border-white/10 rounded-xl overflow-hidden ${className}`}
      data-testid="miro-board-embed-ready"
    >
      <div
        className="flex flex-col items-center justify-center gap-5 px-6 py-12 text-center"
        style={{ minHeight: height }}
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-400/30 flex items-center justify-center shadow-lg shadow-indigo-500/10">
          <Layout className="w-8 h-8 text-indigo-300" />
        </div>
        <div className="max-w-md">
          <h3 className="text-base font-semibold text-white">
            Workspace Miro prêt
          </h3>
          <p className="text-sm text-text-muted mt-1.5 leading-relaxed">
            Ton tableau visuel est créé avec toutes tes analyses. Ouvre-le
            dans Miro pour explorer, organiser et collaborer en plein écran.
          </p>
        </div>
        <a
          href={boardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-sm font-semibold text-white transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
          data-testid="miro-board-embed-open-link"
        >
          Ouvrir dans Miro
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </motion.div>
  );
};

export default MiroBoardEmbed;
