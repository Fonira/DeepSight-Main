/**
 * DEEP SIGHT — AnalysisHub / VisualTab
 *
 * Onglet "Visuel" : consomme `analysis.visual_analysis` (payload Phase 2 —
 * Mistral Vision sur storyboards YouTube) et le rend en 6 sections :
 *   1. Hook visuel (gros texte d'intro)
 *   2. Structure visuelle (badge)
 *   3. Moments clés (timeline timestamp + description + type)
 *   4. Texte visible à l'écran
 *   5. Indicateurs SEO visuels (grid)
 *   6. Résumé visuel (prose)
 *
 * Empty state : affiche un message + CTA quand `visual_analysis` est null
 * ou undefined (analyse non lancée / Phase 2 désactivée). Le tab est
 * toujours rendu — la décision de masquer le bouton se fait en amont
 * dans le HubTabBar / AnalysisHub si on veut le hide selon plan/feature.
 */

import React from "react";
import {
  Eye,
  Film,
  Clock,
  Type,
  Sparkles,
  FileVideo,
  Sun,
  User,
  Subtitles,
  Zap,
  Image as ImageIcon,
  Info,
  Loader2,
} from "lucide-react";
import type {
  VisualAnalysis,
  VisualStructure,
  VisualSeoIndicators,
  VisualQualitativeLevel,
} from "../../types/analysis";

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 PROPS
// ═══════════════════════════════════════════════════════════════════════════════

interface VisualTabProps {
  visualAnalysis: VisualAnalysis | null | undefined;
  language: "fr" | "en";
  /**
   * Callback déclenché par le CTA "Réanalyser avec le visuel" de l'empty state.
   * Si fourni, le bouton devient interactif. Si absent, le CTA reste un badge
   * informatif inerte (rétrocompat tests / pages legacy).
   */
  onReanalyze?: () => void;
  /**
   * Indique qu'une re-analyse est en cours — affiche un spinner et désactive
   * le bouton pour éviter les double-clicks.
   */
  isReanalyzing?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 LABEL HELPERS — i18n minimal local (pas de dépendance i18n côté tab)
// ═══════════════════════════════════════════════════════════════════════════════

const STRUCTURE_LABELS: Record<
  VisualStructure,
  { fr: string; en: string }
> = {
  talking_head: { fr: "Talking head", en: "Talking head" },
  b_roll: { fr: "B-roll", en: "B-roll" },
  gameplay: { fr: "Gameplay", en: "Gameplay" },
  slides: { fr: "Slides", en: "Slides" },
  tutorial: { fr: "Tutoriel", en: "Tutorial" },
  interview: { fr: "Interview", en: "Interview" },
  vlog: { fr: "Vlog", en: "Vlog" },
  mixed: { fr: "Mixte", en: "Mixed" },
  other: { fr: "Autre", en: "Other" },
};

const QUALITATIVE_LABELS: Record<
  VisualQualitativeLevel,
  { fr: string; en: string }
> = {
  low: { fr: "Faible", en: "Low" },
  medium: { fr: "Moyen", en: "Medium" },
  high: { fr: "Élevé", en: "High" },
};

const QUALITATIVE_COLORS: Record<VisualQualitativeLevel, string> = {
  low: "text-amber-300 bg-amber-500/10 border-amber-500/20",
  medium: "text-blue-300 bg-blue-500/10 border-blue-500/20",
  high: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🛠️ UTILS
// ═══════════════════════════════════════════════════════════════════════════════

/** Formate un timestamp (secondes) en MM:SS ou H:MM:SS si > 1h. */
function formatTimestamp(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  if (h > 0) {
    return `${h}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

const t = (lang: "fr" | "en", fr: string, en: string) =>
  lang === "fr" ? fr : en;

// ═══════════════════════════════════════════════════════════════════════════════
// 🧩 SOUS-COMPOSANTS — petits, isolés, lisibles
// ═══════════════════════════════════════════════════════════════════════════════

const SectionTitle: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  children: React.ReactNode;
}> = ({ icon: Icon, iconColor, children }) => (
  <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-text-secondary mb-3">
    <Icon className={`w-4 h-4 ${iconColor}`} />
    <span>{children}</span>
  </h3>
);

interface IndicatorTileProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  /** Texte de droite — soit valeur qualitative, soit "Oui/Non/—". */
  valueNode: React.ReactNode;
}

const IndicatorTile: React.FC<IndicatorTileProps> = ({
  icon: Icon,
  label,
  valueNode,
}) => (
  <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="w-4 h-4 text-text-tertiary flex-shrink-0" />
      <span className="text-xs text-text-tertiary truncate">{label}</span>
    </div>
    <div className="flex-shrink-0">{valueNode}</div>
  </div>
);

const QualitativeBadge: React.FC<{
  level: VisualQualitativeLevel | undefined;
  language: "fr" | "en";
}> = ({ level, language }) => {
  if (!level) {
    return <span className="text-xs text-text-tertiary font-mono">—</span>;
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${QUALITATIVE_COLORS[level]}`}
    >
      {QUALITATIVE_LABELS[level][language]}
    </span>
  );
};

const BooleanBadge: React.FC<{
  value: boolean | undefined;
  language: "fr" | "en";
}> = ({ value, language }) => {
  if (value === undefined) {
    return <span className="text-xs text-text-tertiary font-mono">—</span>;
  }
  if (value) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border text-emerald-300 bg-emerald-500/10 border-emerald-500/20">
        {t(language, "Oui", "Yes")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border text-text-tertiary bg-white/5 border-white/10">
      {t(language, "Non", "No")}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🚫 EMPTY STATE — Phase 2 non activée pour cette analyse
// ═══════════════════════════════════════════════════════════════════════════════

interface EmptyVisualStateProps {
  language: "fr" | "en";
  onReanalyze?: () => void;
  isReanalyzing?: boolean;
}

const EmptyVisualState: React.FC<EmptyVisualStateProps> = ({
  language,
  onReanalyze,
  isReanalyzing,
}) => {
  const ctaLabel = isReanalyzing
    ? t(language, "Analyse en cours…", "Analysis in progress…")
    : t(language, "Réanalyser avec le visuel", "Re-analyze with visuals");

  // Common pill classes (button + badge fallback partagent l'esthétique).
  const pillBase =
    "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors";
  const pillIdle =
    "bg-indigo-500/10 text-indigo-300 border-indigo-500/20 hover:bg-indigo-500/20";
  const pillBusy =
    "bg-indigo-500/5 text-indigo-300/70 border-indigo-500/10 cursor-wait";
  const pillStatic = "bg-indigo-500/10 text-indigo-300 border-indigo-500/20";

  return (
    <div className="p-8 sm:p-12 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 mb-4">
        <Eye className="w-8 h-8 text-text-tertiary" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-2">
        {t(
          language,
          "Analyse visuelle non disponible",
          "Visual analysis unavailable",
        )}
      </h3>
      <p className="text-sm text-text-tertiary max-w-md mx-auto mb-4">
        {t(
          language,
          "Cette analyse n'a pas inclus la couche visuelle. Réanalysez la vidéo en activant l'option « Analyse visuelle » pour voir le hook, la structure, les moments clés et les indicateurs SEO visuels extraits par Mistral Vision.",
          "This analysis did not include the visual layer. Re-run the analysis with the « Visual analysis » option enabled to see the hook, structure, key moments and SEO indicators extracted by Mistral Vision.",
        )}
      </p>
      {onReanalyze ? (
        <button
          type="button"
          onClick={onReanalyze}
          disabled={isReanalyzing}
          aria-busy={isReanalyzing || undefined}
          className={`${pillBase} ${
            isReanalyzing ? pillBusy : pillIdle
          } disabled:opacity-80`}
        >
          {isReanalyzing ? (
            <Loader2
              className="w-4 h-4 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Sparkles className="w-4 h-4" aria-hidden="true" />
          )}
          {ctaLabel}
        </button>
      ) : (
        <span className={`${pillBase} ${pillStatic}`}>
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          {ctaLabel}
        </span>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const VisualTab: React.FC<VisualTabProps> = ({
  visualAnalysis,
  language,
}) => {
  // Empty state quand le payload est absent (Phase 2 non lancée)
  if (!visualAnalysis) {
    return <EmptyVisualState language={language} />;
  }

  const {
    visual_hook,
    visual_structure,
    key_moments,
    visible_text,
    visual_seo_indicators,
    summary_visual,
    model_used,
    frames_analyzed,
    frames_downsampled,
  } = visualAnalysis;

  const structureLabel =
    STRUCTURE_LABELS[visual_structure]?.[language] ?? visual_structure;

  // Tri des moments clés par timestamp pour cohérence visuelle
  const sortedMoments = [...(key_moments || [])].sort(
    (a, b) => a.timestamp_s - b.timestamp_s,
  );

  return (
    <div className="p-4 sm:p-6 space-y-8">
      {/* ─── 1. HOOK VISUEL ─── */}
      <section aria-labelledby="visual-hook-title">
        <SectionTitle icon={Eye} iconColor="text-indigo-400">
          <span id="visual-hook-title">
            {t(language, "Hook visuel", "Visual hook")}
          </span>
        </SectionTitle>
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 sm:p-5">
          <p className="text-base sm:text-lg leading-relaxed text-text-primary">
            {visual_hook || (
              <span className="italic text-text-tertiary">
                {t(language, "Aucun hook détecté.", "No hook detected.")}
              </span>
            )}
          </p>
        </div>
      </section>

      {/* ─── 2. STRUCTURE VISUELLE ─── */}
      <section aria-labelledby="visual-structure-title">
        <SectionTitle icon={Film} iconColor="text-violet-400">
          <span id="visual-structure-title">
            {t(language, "Structure", "Structure")}
          </span>
        </SectionTitle>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border bg-violet-500/10 text-violet-300 border-violet-500/20">
            <FileVideo className="w-4 h-4" aria-hidden="true" />
            {structureLabel}
          </span>
        </div>
      </section>

      {/* ─── 3. MOMENTS CLÉS ─── */}
      <section aria-labelledby="visual-moments-title">
        <SectionTitle icon={Clock} iconColor="text-cyan-400">
          <span id="visual-moments-title">
            {t(language, "Moments clés", "Key moments")}
          </span>
        </SectionTitle>
        {sortedMoments.length === 0 ? (
          <p className="text-sm italic text-text-tertiary">
            {t(
              language,
              "Aucun moment clé détecté.",
              "No key moments detected.",
            )}
          </p>
        ) : (
          <ol className="space-y-2">
            {sortedMoments.map((moment, idx) => (
              <li
                key={`${moment.timestamp_s}-${idx}`}
                className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors"
              >
                <span
                  className="flex-shrink-0 inline-flex items-center justify-center min-w-[58px] px-2 py-1 rounded-md font-mono text-[11px] font-semibold tracking-wider text-cyan-300 bg-cyan-500/10 border border-cyan-500/20"
                  style={{ fontFamily: "JetBrains Mono, monospace" }}
                  aria-label={t(language, "Timestamp", "Timestamp")}
                >
                  {formatTimestamp(moment.timestamp_s)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary leading-relaxed">
                    {moment.description}
                  </p>
                </div>
                {moment.type && (
                  <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border text-text-secondary bg-white/5 border-white/10">
                    {moment.type}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* ─── 4. TEXTE VISIBLE ─── */}
      <section aria-labelledby="visual-text-title">
        <SectionTitle icon={Type} iconColor="text-amber-400">
          <span id="visual-text-title">
            {t(language, "Texte visible à l'écran", "On-screen text")}
          </span>
        </SectionTitle>
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4">
          {visible_text && visible_text.trim() ? (
            <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
              {visible_text}
            </p>
          ) : (
            <p className="text-sm italic text-text-tertiary">
              {t(
                language,
                "Aucun texte détecté.",
                "No text detected.",
              )}
            </p>
          )}
        </div>
      </section>

      {/* ─── 5. INDICATEURS SEO VISUELS ─── */}
      <section aria-labelledby="visual-seo-title">
        <SectionTitle icon={Sparkles} iconColor="text-emerald-400">
          <span id="visual-seo-title">
            {t(
              language,
              "Indicateurs SEO visuels",
              "Visual SEO indicators",
            )}
          </span>
        </SectionTitle>
        <SeoIndicatorsGrid
          indicators={visual_seo_indicators}
          language={language}
        />
      </section>

      {/* ─── 6. RÉSUMÉ VISUEL ─── */}
      <section aria-labelledby="visual-summary-title">
        <SectionTitle icon={Info} iconColor="text-blue-400">
          <span id="visual-summary-title">
            {t(language, "Résumé visuel", "Visual summary")}
          </span>
        </SectionTitle>
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 sm:p-5">
          {summary_visual ? (
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
              {summary_visual}
            </p>
          ) : (
            <p className="text-sm italic text-text-tertiary">
              {t(
                language,
                "Aucun résumé visuel généré.",
                "No visual summary generated.",
              )}
            </p>
          )}
        </div>
      </section>

      {/* ─── METADATA (footer discret) ─── */}
      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-tertiary border-t border-white/5 pt-4">
        <span>
          {t(language, "Modèle", "Model")}:{" "}
          <span
            className="font-mono text-text-secondary"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
          >
            {model_used || "—"}
          </span>
        </span>
        <span>
          {t(language, "Frames analysées", "Frames analyzed")}:{" "}
          <span
            className="font-mono text-text-secondary"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
          >
            {frames_analyzed}
          </span>
        </span>
        {frames_downsampled && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-amber-500/10 text-amber-300 border border-amber-500/20">
            {t(language, "Échantillonné", "Downsampled")}
          </span>
        )}
      </footer>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🧮 GRID DES INDICATEURS SEO — extrait pour lisibilité
// ═══════════════════════════════════════════════════════════════════════════════

const SeoIndicatorsGrid: React.FC<{
  indicators: VisualSeoIndicators;
  language: "fr" | "en";
}> = ({ indicators, language }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <IndicatorTile
        icon={Sun}
        label={t(language, "Luminosité du hook", "Hook brightness")}
        valueNode={
          <QualitativeBadge
            level={indicators.hook_brightness}
            language={language}
          />
        }
      />
      <IndicatorTile
        icon={User}
        label={t(language, "Visage dans le hook", "Face in hook")}
        valueNode={
          <BooleanBadge
            value={indicators.face_visible_in_hook}
            language={language}
          />
        }
      />
      <IndicatorTile
        icon={Subtitles}
        label={t(language, "Sous-titres incrustés", "Burned-in subtitles")}
        valueNode={
          <BooleanBadge
            value={indicators.burned_in_subtitles}
            language={language}
          />
        }
      />
      <IndicatorTile
        icon={Zap}
        label={t(language, "Intro à fort mouvement", "High-motion intro")}
        valueNode={
          <BooleanBadge
            value={indicators.high_motion_intro}
            language={language}
          />
        }
      />
      <IndicatorTile
        icon={ImageIcon}
        label={t(
          language,
          "Qualité miniature (proxy)",
          "Thumbnail quality (proxy)",
        )}
        valueNode={
          <QualitativeBadge
            level={indicators.thumbnail_quality_proxy}
            language={language}
          />
        }
      />
    </div>
  );
};
