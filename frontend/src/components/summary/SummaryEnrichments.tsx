/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  📚 SUMMARY ENRICHMENTS — spike post-processing pour synthèses détaillées          ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Affiche 3 sections d'enrichissement Mistral générées à la demande sur un Summary  ║
 * ║  existant : key_quotes, key_takeaways, chapter_themes.                             ║
 * ║                                                                                    ║
 * ║  - Si `summary_extras` null + bouton non cliqué → affiche un bouton "Enrichir".    ║
 * ║  - Sur click : POST /api/videos/summary/{id}/enrich, loading state, puis render.   ║
 * ║  - Si `summary_extras` déjà présent → render direct (cache).                       ║
 * ║                                                                                    ║
 * ║  Composant prop-driven sur summaryId + extras initiaux ; gère son propre fetch.    ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Quote,
  ListChecks,
  BookMarked,
  AlertCircle,
} from "lucide-react";

import { videoApi } from "../../services/api";
import type { SummaryExtrasData } from "../../services/api";
import { DeepSightSpinnerSmall } from "../ui/DeepSightSpinner";

export interface SummaryEnrichmentsProps {
  summaryId: number;
  /** Extras initiaux (depuis le GET /summary/{id}). Si null → affiche le bouton. */
  initialExtras: SummaryExtrasData | null | undefined;
  /** Callback quand un nouvel enrichment est généré (pour update parent). */
  onEnrichmentReady?: (extras: SummaryExtrasData) => void;
  className?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

// ─── Sub-section : Citations marquantes ───────────────────────────────────────

const QuotesSection: React.FC<{ quotes: SummaryExtrasData["key_quotes"] }> = ({
  quotes,
}) => (
  <div
    className="rounded-xl bg-white/5 border border-violet-500/20 backdrop-blur-xl p-5"
    data-testid="summary-enrich-quotes"
  >
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
        <Quote className="w-4 h-4 text-violet-400" aria-hidden />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">
          Citations marquantes
        </h3>
        <p className="text-xs text-text-muted">
          Extraits littéraux du contenu
        </p>
      </div>
    </div>
    <motion.ul
      className="space-y-3"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {quotes.map((q, i) => (
        <motion.li
          key={i}
          variants={itemVariants}
          className="rounded-lg bg-violet-500/[0.05] border border-violet-500/10 p-4 space-y-2"
          data-testid={`summary-enrich-quote-${i}`}
        >
          <p className="text-sm text-text-primary italic leading-relaxed">
            « {q.quote} »
          </p>
          {q.context && (
            <p className="text-xs text-text-muted leading-relaxed pl-2 border-l-2 border-violet-400/30">
              {q.context}
            </p>
          )}
        </motion.li>
      ))}
    </motion.ul>
  </div>
);

// ─── Sub-section : Takeaways ───────────────────────────────────────────────────

const TakeawaysSection: React.FC<{ takeaways: string[] }> = ({ takeaways }) => (
  <div
    className="rounded-xl bg-white/5 border border-emerald-500/20 backdrop-blur-xl p-5"
    data-testid="summary-enrich-takeaways"
  >
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
        <ListChecks className="w-4 h-4 text-emerald-400" aria-hidden />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">
          À retenir
        </h3>
        <p className="text-xs text-text-muted">
          Insights clés et conclusions saillantes
        </p>
      </div>
    </div>
    <motion.ul
      className="space-y-2"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {takeaways.map((t, i) => (
        <motion.li
          key={i}
          variants={itemVariants}
          className="flex items-start gap-2.5 rounded-lg bg-emerald-500/[0.05] border border-emerald-500/10 p-3"
          data-testid={`summary-enrich-takeaway-${i}`}
        >
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-emerald-400 text-[10px] font-bold">
              {i + 1}
            </span>
          </div>
          <p className="text-sm text-text-primary leading-relaxed">{t}</p>
        </motion.li>
      ))}
    </motion.ul>
  </div>
);

// ─── Sub-section : Chapter themes ─────────────────────────────────────────────

const ChapterThemesSection: React.FC<{
  themes: SummaryExtrasData["chapter_themes"];
}> = ({ themes }) => (
  <div
    className="rounded-xl bg-white/5 border border-indigo-500/20 backdrop-blur-xl p-5"
    data-testid="summary-enrich-themes"
  >
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
        <BookMarked className="w-4 h-4 text-indigo-400" aria-hidden />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">
          Table des matières enrichie
        </h3>
        <p className="text-xs text-text-muted">
          Thèmes et chapitres structurés
        </p>
      </div>
    </div>
    <motion.ol
      className="space-y-2"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {themes.map((t, i) => (
        <motion.li
          key={i}
          variants={itemVariants}
          className="rounded-lg bg-indigo-500/[0.05] border border-indigo-500/10 p-3 space-y-1"
          data-testid={`summary-enrich-theme-${i}`}
        >
          <p className="text-sm font-semibold text-indigo-300">
            <span className="text-indigo-400/70 mr-2">
              {String(i + 1).padStart(2, "0")}.
            </span>
            {t.theme}
          </p>
          {t.summary && (
            <p className="text-xs text-text-secondary leading-relaxed pl-7">
              {t.summary}
            </p>
          )}
        </motion.li>
      ))}
    </motion.ol>
  </div>
);

// ─── Composant principal ──────────────────────────────────────────────────────

export const SummaryEnrichments: React.FC<SummaryEnrichmentsProps> = ({
  summaryId,
  initialExtras,
  onEnrichmentReady,
  className = "",
}) => {
  const [extras, setExtras] = useState<SummaryExtrasData | null>(
    initialExtras ?? null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnrich = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await videoApi.enrichSummary(summaryId);
      if (res.extras) {
        setExtras(res.extras);
        onEnrichmentReady?.(res.extras);
      } else {
        setError("Aucun enrichissement renvoyé par le backend.");
      }
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Erreur inattendue lors de l'enrichissement.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [summaryId, onEnrichmentReady]);

  // ─── Bouton "Enrichir" (initial state) ───
  if (!extras) {
    return (
      <div
        className={`rounded-xl bg-gradient-to-br from-cyan-500/[0.07] to-indigo-500/[0.05] border border-cyan-500/20 backdrop-blur-xl p-5 ${className}`}
        data-testid="summary-enrich-cta"
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-cyan-400" aria-hidden />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <p className="text-sm font-semibold text-white">
                Enrichir l'analyse
              </p>
              <p className="text-xs text-text-muted leading-relaxed">
                Génère 3 sections supplémentaires : citations marquantes,
                takeaways, et table des matières structurée.
              </p>
            </div>
            <button
              type="button"
              onClick={handleEnrich}
              disabled={isLoading}
              data-testid="summary-enrich-button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
            >
              {isLoading ? (
                <>
                  <DeepSightSpinnerSmall />
                  Génération en cours…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Enrichir avec Mistral
                </>
              )}
            </button>
            {error && (
              <div
                role="alert"
                data-testid="summary-enrich-error"
                className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20"
              >
                <AlertCircle
                  className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5"
                  aria-hidden
                />
                <p className="text-xs text-red-300 break-words">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Render extras (cached or freshly generated) ───
  const isEmpty =
    extras.key_quotes.length === 0 &&
    extras.key_takeaways.length === 0 &&
    extras.chapter_themes.length === 0;

  if (isEmpty) {
    return (
      <div
        className={`rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl p-5 text-center ${className}`}
        data-testid="summary-enrich-empty"
      >
        <p className="text-xs text-text-muted">
          Aucun enrichissement n'a pu être extrait pour cette analyse.
        </p>
      </div>
    );
  }

  return (
    <section
      role="region"
      aria-label="Enrichissements de l'analyse"
      data-testid="summary-enrichments"
      className={`space-y-4 ${className}`}
    >
      {extras.key_quotes.length > 0 && (
        <QuotesSection quotes={extras.key_quotes} />
      )}
      {extras.key_takeaways.length > 0 && (
        <TakeawaysSection takeaways={extras.key_takeaways} />
      )}
      {extras.chapter_themes.length > 0 && (
        <ChapterThemesSection themes={extras.chapter_themes} />
      )}
    </section>
  );
};

export default SummaryEnrichments;
