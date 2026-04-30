/**
 * GeoTab — Onglet GEO (Generative Engine Optimization)
 * Affiche le score GEO, les quotes citables et les recommandations.
 */

import React, { useState, useEffect } from "react";
import {
  Target,
  Quote,
  Lightbulb,
  TrendingUp,
  BookOpen,
  Shield,
  Layers,
  Clock,
  Loader2,
  Lock,
} from "lucide-react";
import { geoApi } from "../../services/api";
import type {
  GeoScoreResponse,
  GeoCitableQuote,
  GeoRecommendation,
} from "../../services/api";
import type { Summary } from "../../services/api";

interface GeoTabProps {
  selectedSummary: Summary;
  user: { plan?: string };
  language: "fr" | "en";
}

const DIMENSION_CONFIG = [
  {
    key: "citability" as const,
    labelFr: "Citabilite",
    labelEn: "Citability",
    icon: Quote,
    color: "text-blue-400",
    bg: "bg-blue-500",
  },
  {
    key: "structure" as const,
    labelFr: "Structure",
    labelEn: "Structure",
    icon: Layers,
    color: "text-violet-400",
    bg: "bg-violet-500",
  },
  {
    key: "authority" as const,
    labelFr: "Autorite",
    labelEn: "Authority",
    icon: Shield,
    color: "text-emerald-400",
    bg: "bg-emerald-500",
  },
  {
    key: "coverage" as const,
    labelFr: "Couverture",
    labelEn: "Coverage",
    icon: BookOpen,
    color: "text-amber-400",
    bg: "bg-amber-500",
  },
  {
    key: "freshness" as const,
    labelFr: "Fraicheur",
    labelEn: "Freshness",
    icon: Clock,
    color: "text-cyan-400",
    bg: "bg-cyan-500",
  },
];

const GRADE_COLORS: Record<string, string> = {
  A: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  B: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  C: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  D: "text-orange-400 border-orange-500/30 bg-orange-500/10",
  F: "text-red-400 border-red-500/30 bg-red-500/10",
};

const MARKER_STYLES: Record<string, string> = {
  SOLID: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  PLAUSIBLE: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  UNCERTAIN: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  TO_VERIFY: "bg-red-500/15 text-red-400 border-red-500/30",
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-500/15 text-red-400",
  medium: "bg-amber-500/15 text-amber-400",
  low: "bg-blue-500/15 text-blue-400",
};

export const GeoTab: React.FC<GeoTabProps> = ({
  selectedSummary,
  user,
  language,
}) => {
  const [geoData, setGeoData] = useState<GeoScoreResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pricing v2 : gating GEO ouvert sur plans payants (Pro 8,99 € / Expert 19,99 €).
  // L'alias "plus" v0/v1 est conserve pour grandfathering (mappe vers pro via
  // normalizePlanId backend ; ici on accepte les deux libelles a la lecture).
  const isGeoEnabled =
    user.plan === "pro" || user.plan === "expert" || user.plan === "plus";
  const t = (fr: string, en: string) => (language === "fr" ? fr : en);

  useEffect(() => {
    if (!isGeoEnabled || !selectedSummary?.id) return;

    let cancelled = false;
    const fetchGeo = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await geoApi.getScore(selectedSummary.id);
        if (!cancelled) setGeoData(data);
      } catch (err) {
        if (!cancelled)
          setError(
            t(
              "Erreur lors du calcul du score GEO",
              "Error calculating GEO score",
            ),
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchGeo();
    return () => {
      cancelled = true;
    };
  }, [selectedSummary?.id, isGeoEnabled]);

  // Locked state
  if (!isGeoEnabled) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 mb-4">
          <Lock className="w-8 h-8 text-text-tertiary" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          {t("Score GEO", "GEO Score")}
        </h3>
        <p className="text-text-tertiary text-sm max-w-md mx-auto mb-4">
          {t(
            "Mesurez la probabilite que votre video soit citee par ChatGPT, Perplexity ou Gemini. Disponible a partir du plan Plus.",
            "Measure the likelihood of your video being cited by ChatGPT, Perplexity, or Gemini. Available from the Plus plan.",
          )}
        </p>
        <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 text-sm font-medium border border-blue-500/20">
          <TrendingUp className="w-4 h-4" />
          {t("Passer au plan Plus", "Upgrade to Plus")}
        </span>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
        <p className="text-text-tertiary text-sm">
          {t("Calcul du score GEO...", "Calculating GEO score...")}
        </p>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!geoData) return null;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header: Score + Grade */}
      <div className="flex items-center gap-6">
        <div className="relative">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-white/5"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              stroke="url(#geoGradient)"
              strokeDasharray={`${(geoData.overall_score / 100) * 264} 264`}
            />
            <defs>
              <linearGradient
                id="geoGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#14b8a6" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-text-primary">
              {Math.round(geoData.overall_score)}
            </span>
            <span className="text-[10px] text-text-tertiary">/100</span>
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-lg font-semibold text-text-primary">
              {t("Score GEO", "GEO Score")}
            </h3>
            <span
              className={`text-xl font-bold px-3 py-0.5 rounded-lg border ${GRADE_COLORS[geoData.grade] || ""}`}
            >
              {geoData.grade}
            </span>
          </div>
          <p className="text-sm text-text-tertiary">
            {t(
              `${geoData.solid_claims} claims solides sur ${geoData.total_claims} — ${geoData.citable_quotes.length} quotes citables`,
              `${geoData.solid_claims} solid claims out of ${geoData.total_claims} — ${geoData.citable_quotes.length} citable quotes`,
            )}
          </p>
        </div>
      </div>

      {/* Breakdown bars */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-text-secondary">
          {t("Dimensions", "Dimensions")}
        </h4>
        {DIMENSION_CONFIG.map(
          ({ key, labelFr, labelEn, icon: Icon, color, bg }) => {
            const value = geoData.breakdown[key];
            return (
              <div key={key} className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${color} flex-shrink-0`} />
                <span className="text-xs text-text-tertiary w-20 flex-shrink-0">
                  {t(labelFr, labelEn)}
                </span>
                <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${bg} transition-all duration-700`}
                    style={{ width: `${value}%`, opacity: 0.7 }}
                  />
                </div>
                <span className="text-xs font-mono text-text-secondary w-8 text-right">
                  {Math.round(value)}
                </span>
              </div>
            );
          },
        )}
      </div>

      {/* Citable Quotes */}
      {geoData.citable_quotes.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-text-secondary flex items-center gap-2">
            <Quote className="w-4 h-4" />
            {t("Quotes citables par les IA", "AI-citable quotes")}
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {geoData.citable_quotes
              .slice(0, 8)
              .map((q: GeoCitableQuote, i: number) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${MARKER_STYLES[q.marker] || "bg-white/10 text-white/60"}`}
                    >
                      {q.marker}
                    </span>
                    <p className="text-sm text-text-secondary flex-1 leading-relaxed">
                      {q.text}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 mt-2 ml-8">
                    <span className="text-[10px] text-text-tertiary">
                      {t("Score", "Score")}:{" "}
                      <span className="font-mono text-teal-400">{q.score}</span>
                    </span>
                    {q.has_stats && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400">
                        stats
                      </span>
                    )}
                    {q.improvement_hint && (
                      <span className="text-[10px] text-text-tertiary italic">
                        {q.improvement_hint}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {geoData.recommendations.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-text-secondary flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            {t("Recommandations", "Recommendations")}
          </h4>
          <div className="space-y-2">
            {geoData.recommendations.map((r: GeoRecommendation, i: number) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5"
              >
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${PRIORITY_STYLES[r.priority] || ""}`}
                >
                  {r.priority === "high"
                    ? language === "fr"
                      ? "HAUT"
                      : "HIGH"
                    : r.priority === "medium"
                      ? language === "fr"
                        ? "MOY"
                        : "MED"
                      : language === "fr"
                        ? "BAS"
                        : "LOW"}
                </span>
                <p className="text-sm text-text-secondary flex-1">
                  {r.message}
                </p>
                <span className="text-[10px] font-mono text-emerald-400 flex-shrink-0">
                  +{r.impact_estimate}pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
