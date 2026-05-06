/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  📚 SUMMARY NATIVE VIEW — refonte synthèse Option A 2026-05-06                      ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Rendu natif sectionné de la synthèse détaillée d'une vidéo. Reproduit le style    ║
 * ║  canvas v2 (HubWorkspaceCanvas) avec glassmorphism dark, gradients cyan/violet/    ║
 * ║  emerald/indigo et animations Framer.                                               ║
 * ║                                                                                    ║
 * ║  4 sections (toutes optionnelles, omises si vides) :                               ║
 * ║    1. Synthèse (cyan)         — overview 4-6 phrases                               ║
 * ║    2. Citations (violet)      — extraits littéraux avec mini-contexte              ║
 * ║    3. À retenir (emerald)     — takeaways actionnables                             ║
 * ║    4. Chapitres (indigo)      — thèmes avec sous-puces et citation marquante       ║
 * ║                                                                                    ║
 * ║  Backward-compat : si `extras` est null ou vide, fallback sur le Markdown          ║
 * ║  `summaryContent` via <EnrichedMarkdown> (Summary legacy avant Option A).          ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React from "react";
import { motion } from "framer-motion";
import { Sparkles, Quote, ListChecks, BookMarked } from "lucide-react";

import { EnrichedMarkdown } from "../EnrichedMarkdown";
import type { SummaryExtrasData, SummaryQuote } from "../../services/api";

export interface SummaryNativeViewProps {
  /** Identifiant de l'analyse (utilisé pour data-testid uniquement). */
  summaryId?: number;
  /** Extras Mistral (vue native). null/undefined = legacy → fallback Markdown. */
  extras: SummaryExtrasData | null | undefined;
  /** Markdown brut `summary_content` — utilisé en fallback si extras absent. */
  summaryContent?: string | null;
  /** Langue pour EnrichedMarkdown (fallback). Default fr. */
  language?: "fr" | "en";
  /** Callback timecodes pour EnrichedMarkdown (fallback). */
  onTimecodeClick?: (seconds: number) => void;
  className?: string;
}

// ─── Animations ───────────────────────────────────────────────────────────────

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

// ─── Section 1 : Synthèse (cyan gradient) ─────────────────────────────────────

const SynthesisSection: React.FC<{ synthesis: string }> = ({ synthesis }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className="rounded-xl bg-gradient-to-br from-cyan-500/[0.07] to-indigo-500/[0.05] border border-cyan-500/20 backdrop-blur-xl p-5"
    data-testid="summary-native-synthesis"
  >
    <div className="flex items-center gap-2 mb-3">
      <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
        <Sparkles className="w-4 h-4 text-cyan-400" aria-hidden />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">Synthèse</h3>
        <p className="text-xs text-text-muted">Vue d&apos;ensemble de l&apos;analyse</p>
      </div>
    </div>
    <p className="text-sm text-text-primary leading-relaxed whitespace-pre-line">
      {synthesis}
    </p>
  </motion.div>
);

// ─── Section 2 : Citations marquantes (violet) ────────────────────────────────

const QuotesSection: React.FC<{ quotes: SummaryQuote[] }> = ({ quotes }) => (
  <div
    className="rounded-xl bg-white/5 border border-violet-500/20 backdrop-blur-xl p-5"
    data-testid="summary-native-quotes"
  >
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
        <Quote className="w-4 h-4 text-violet-400" aria-hidden />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">Citations marquantes</h3>
        <p className="text-xs text-text-muted">Extraits littéraux du contenu</p>
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
          data-testid={`summary-native-quote-${i}`}
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

// ─── Section 3 : À retenir / Takeaways (emerald) ──────────────────────────────

const TakeawaysSection: React.FC<{ takeaways: string[] }> = ({ takeaways }) => (
  <div
    className="rounded-xl bg-white/5 border border-emerald-500/20 backdrop-blur-xl p-5"
    data-testid="summary-native-takeaways"
  >
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
        <ListChecks className="w-4 h-4 text-emerald-400" aria-hidden />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">À retenir</h3>
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
          data-testid={`summary-native-takeaway-${i}`}
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

// ─── Section 4 : Chapitres détaillés (indigo) ─────────────────────────────────

interface ChapterThemesSectionProps {
  themes: SummaryExtrasData["chapter_themes"];
}

const ChapterThemesSection: React.FC<ChapterThemesSectionProps> = ({ themes }) => (
  <div
    className="rounded-xl bg-white/5 border border-indigo-500/20 backdrop-blur-xl p-5"
    data-testid="summary-native-themes"
  >
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
        <BookMarked className="w-4 h-4 text-indigo-400" aria-hidden />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">Chapitres détaillés</h3>
        <p className="text-xs text-text-muted">
          Thèmes structurés avec sous-points et citations
        </p>
      </div>
    </div>
    <motion.ol
      className="space-y-3"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {themes.map((t, i) => (
        <motion.li
          key={i}
          variants={itemVariants}
          className="rounded-lg bg-indigo-500/[0.05] border border-indigo-500/10 p-4 space-y-2.5"
          data-testid={`summary-native-theme-${i}`}
        >
          {/* Header : numéro + titre du thème */}
          <div className="flex items-start gap-2">
            <span className="text-indigo-400/70 text-xs font-bold mt-0.5 shrink-0">
              {String(i + 1).padStart(2, "0")}.
            </span>
            <p className="text-sm font-semibold text-indigo-300 leading-snug">
              {t.theme}
            </p>
          </div>

          {/* Synthèse du thème (optionnel) */}
          {t.summary && (
            <p
              className="text-xs text-text-secondary leading-relaxed pl-7"
              data-testid={`summary-native-theme-summary-${i}`}
            >
              {t.summary}
            </p>
          )}

          {/* Sous-puces (optionnel) */}
          {t.key_points && t.key_points.length > 0 && (
            <ul
              className="pl-7 space-y-1.5"
              data-testid={`summary-native-theme-keypoints-${i}`}
            >
              {t.key_points.map((kp, j) => (
                <li
                  key={j}
                  className="flex items-start gap-2 text-xs text-text-secondary leading-relaxed"
                >
                  <span className="text-indigo-400/60 mt-1 shrink-0">•</span>
                  <span>{kp}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Citation marquante du thème (optionnel) */}
          {t.key_quote && (
            <div
              className="ml-7 flex items-start gap-1.5 pl-2 border-l-2 border-indigo-400/40 mt-1"
              data-testid={`summary-native-theme-quote-${i}`}
            >
              <Quote
                className="w-3 h-3 text-indigo-400/70 shrink-0 mt-0.5"
                aria-hidden
              />
              <div className="space-y-0.5">
                <p className="text-[11px] text-indigo-200/90 italic leading-relaxed">
                  « {t.key_quote.quote} »
                </p>
                {t.key_quote.context && (
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    {t.key_quote.context}
                  </p>
                )}
              </div>
            </div>
          )}
        </motion.li>
      ))}
    </motion.ol>
  </div>
);

// ─── Composant principal ──────────────────────────────────────────────────────

export const SummaryNativeView: React.FC<SummaryNativeViewProps> = ({
  summaryId,
  extras,
  summaryContent,
  language = "fr",
  onTimecodeClick,
  className,
}) => {
  // ─── Legacy fallback : pas d'extras → Markdown direct (rétro-compat) ───
  const hasNativeContent =
    !!extras &&
    (!!extras.synthesis ||
      extras.key_quotes.length > 0 ||
      extras.key_takeaways.length > 0 ||
      extras.chapter_themes.length > 0);

  if (!hasNativeContent) {
    if (!summaryContent) return null;
    return (
      <div
        className={`prose max-w-none ${className ?? ""}`}
        data-testid="summary-native-fallback"
        data-summary-id={summaryId}
      >
        <EnrichedMarkdown
          language={language}
          onTimecodeClick={onTimecodeClick}
          className="text-text-primary"
        >
          {summaryContent}
        </EnrichedMarkdown>
      </div>
    );
  }

  // hasNativeContent garantit extras non-null
  const { synthesis, key_quotes, key_takeaways, chapter_themes } =
    extras as SummaryExtrasData;

  return (
    <section
      role="region"
      aria-label="Synthèse native"
      data-testid="summary-native-view"
      data-summary-id={summaryId}
      className={`space-y-4 ${className ?? ""}`}
    >
      {synthesis && <SynthesisSection synthesis={synthesis} />}
      {key_quotes.length > 0 && <QuotesSection quotes={key_quotes} />}
      {key_takeaways.length > 0 && (
        <TakeawaysSection takeaways={key_takeaways} />
      )}
      {chapter_themes.length > 0 && (
        <ChapterThemesSection themes={chapter_themes} />
      )}
    </section>
  );
};

export default SummaryNativeView;
