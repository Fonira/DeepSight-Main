/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🎨 DEBATE MIRO EMBED — Wave 3 F (Débat IA v2)                                     ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Affiche un board Miro généré côté serveur pour visualiser le débat.               ║
 * ║                                                                                    ║
 * ║  - Si debate.miro_board_url existe → iframe embed + lien externe.                  ║
 * ║  - Sinon → CTA "Générer le board Miro" (bouton onClick → onGenerate).              ║
 * ║                                                                                    ║
 * ║  Cf. docs/superpowers/specs/2026-05-04-debate-ia-v2.md §7.4.                       ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React from "react";
import { motion } from "framer-motion";
import { Layout, ExternalLink, Sparkles, AlertCircle } from "lucide-react";
import type { DebateAnalysis } from "../../types/debate";

interface DebateMiroEmbedProps {
  debate: DebateAnalysis;
  /** Callback déclenché par le CTA — appelle l'API generateMiroBoard. */
  onGenerate: () => Promise<void>;
  /** Vrai si la génération est en cours (spinner sur le bouton). */
  isGenerating: boolean;
  /** Message d'erreur à afficher (généralement après un échec backend). */
  error?: string | null;
}

/**
 * Convertit l'URL d'un board Miro en URL d'embed iframe.
 *
 * Miro accepte `https://miro.com/app/live-embed/{boardId}/` pour les boards en
 * read-only. Si on reçoit déjà un `viewLink` (https://miro.com/app/board/{id}/),
 * on le convertit. Sinon, on retourne l'URL telle quelle.
 */
function toEmbedUrl(viewLink: string): string {
  if (!viewLink) return viewLink;
  // Pattern Miro : https://miro.com/app/board/{boardId}/...
  const match = viewLink.match(/miro\.com\/app\/board\/([^/?#]+)/i);
  if (match && match[1]) {
    return `https://miro.com/app/live-embed/${match[1]}/?embedMode=view_only_without_ui`;
  }
  return viewLink;
}

export const DebateMiroEmbed: React.FC<DebateMiroEmbedProps> = ({
  debate,
  onGenerate,
  isGenerating,
  error,
}) => {
  const hasBoard = Boolean(debate.miro_board_url);

  // ─── Affichage du board (iframe + lien externe) ───
  if (hasBoard && debate.miro_board_url) {
    const embedUrl = toEmbedUrl(debate.miro_board_url);
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl p-4 mb-4"
        data-testid="debate-miro-embed-board"
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/15 flex items-center justify-center">
              <Layout className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Tableau Miro</h3>
              <p className="text-xs text-text-muted">
                Vue interactive du débat — partageable en lecture seule
              </p>
            </div>
          </div>
          <a
            href={debate.miro_board_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-text-secondary hover:text-white transition-colors"
            data-testid="debate-miro-external-link"
          >
            Ouvrir dans Miro
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="rounded-lg overflow-hidden border border-white/10 bg-black/20">
          <iframe
            src={embedUrl}
            width="100%"
            height="600"
            frameBorder={0}
            allowFullScreen
            title={`Tableau Miro — ${debate.detected_topic ?? "Débat IA"}`}
            data-testid="debate-miro-iframe"
            className="block"
          />
        </div>
      </motion.div>
    );
  }

  // ─── CTA : pas encore de board ───
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-gradient-to-br from-yellow-500/10 to-amber-500/5 border border-yellow-500/20 backdrop-blur-xl p-5 mb-4"
      data-testid="debate-miro-embed-cta"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
          <Layout className="w-5 h-5 text-yellow-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-white">
              Tableau Miro interactif
            </h3>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/25 text-[10px] uppercase tracking-wider text-yellow-300">
              <Sparkles className="w-2.5 h-2.5" />
              Nouveau
            </span>
          </div>
          <p className="text-sm text-text-secondary mb-3 leading-relaxed">
            Visualise ce débat sous forme de board Miro structuré : vidéo
            principale, perspectives, convergences et divergences en sticky
            notes colorées. Idéal pour partager visuellement avec une équipe.
          </p>
          {error && (
            <div className="mb-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <button
            id="debate-miro-cta"
            type="button"
            onClick={() => {
              if (!isGenerating) {
                void onGenerate();
              }
            }}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-sm font-medium text-yellow-100 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="debate-miro-generate-btn"
          >
            {isGenerating ? (
              <>
                <svg
                  className="w-3.5 h-3.5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    opacity="0.25"
                  />
                  <path
                    d="M12 2a10 10 0 0 1 10 10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
                Génération…
              </>
            ) : (
              <>
                <Layout className="w-3.5 h-3.5" />
                Générer le board Miro
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default DebateMiroEmbed;
