/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🌻 TOURNESOL TRENDING — Vidéos recommandées par Tournesol                       ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  - Affiche les vidéos les mieux notées par la communauté Tournesol               ║
 * ║  - API publique, aucune auth requise                                             ║
 * ║  - Respecte la privacy : aucune donnée utilisateur DeepSight exposée             ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect, useCallback } from "react";
import { ExternalLink, Clock, ThumbsUp, RefreshCw } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES — Tournesol API response
// ═══════════════════════════════════════════════════════════════════════════════

interface TournesolEntity {
  uid: string;
  type: string;
  metadata: {
    name: string;
    tags?: string[];
    views?: number;
    source: string;
    duration?: number;
    language?: string;
    uploader?: string;
    video_id: string;
    channel_id?: string;
    description?: string;
    is_unlisted?: boolean;
    publication_date?: string;
  };
}

interface TournesolCriteriaScore {
  criteria: string;
  score: number;
}

interface TournesolCollectiveRating {
  n_comparisons: number;
  n_contributors: number;
  tournesol_score: number;
  unsafe: { status: boolean; reasons: string[] };
  criteria_scores: TournesolCriteriaScore[];
}

interface TournesolResult {
  entity: TournesolEntity;
  collective_rating: TournesolCollectiveRating;
  recommendation_metadata: { total_score: number };
}

interface TournesolApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: TournesolResult[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🌍 CONFIG & TRANSLATIONS
// ═══════════════════════════════════════════════════════════════════════════════

// Proxy via notre backend pour contourner CORS (api.tournesol.app ne renvoie pas Access-Control-Allow-Origin)
const TOURNESOL_API = `${import.meta.env.VITE_API_URL || "https://api.deepsightsynthesis.com"}/api/tournesol/recommendations/raw`;
const TOURNESOL_SITE = "https://tournesol.app";

const LANGUAGES = [
  { value: "" as const, label: { fr: "Toutes", en: "All" } },
  { value: "fr" as const, label: { fr: "Français", en: "French" } },
  { value: "en" as const, label: { fr: "Anglais", en: "English" } },
];

const MESSAGES = {
  fr: {
    title: "Recommandations Tournesol",
    subtitle: "Vidéos de qualité recommandées par la communauté Tournesol",
    poweredBy: "Propulsé par",
    score: "Score",
    contributors: "contributeurs",
    comparisons: "comparaisons",
    noData: "Aucune recommandation disponible.",
    error: "Impossible de charger les recommandations",
    retry: "Réessayer",
    analyzeThis: "Analyser avec DeepSight",
    reliability: "Fiabilité",
    pedagogy: "Pédagogie",
    importance: "Importance",
    engaging: "Engagement",
  },
  en: {
    title: "Tournesol Recommendations",
    subtitle: "Quality videos recommended by the Tournesol community",
    poweredBy: "Powered by",
    score: "Score",
    contributors: "contributors",
    comparisons: "comparisons",
    noData: "No recommendations available.",
    error: "Failed to load recommendations",
    retry: "Retry",
    analyzeThis: "Analyze with DeepSight",
    reliability: "Reliability",
    pedagogy: "Pedagogy",
    importance: "Importance",
    engaging: "Engaging",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const formatDuration = (seconds: number | undefined | null): string => {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}`;
  return `${m}min`;
};

const formatScore = (score: number): string => {
  return Math.round(score).toString();
};

const getScoreColor = (score: number): string => {
  if (score >= 60) return "text-emerald-400";
  if (score >= 40) return "text-yellow-400";
  return "text-orange-400";
};

const getScoreBg = (score: number): string => {
  if (score >= 60) return "bg-emerald-500/20";
  if (score >= 40) return "bg-yellow-500/20";
  return "bg-orange-500/20";
};

const getCriteriaScore = (
  criteria: TournesolCriteriaScore[],
  key: string,
): number | null => {
  const found = criteria.find((c) => c.criteria === key);
  return found ? Math.round(found.score) : null;
};

const formatPublicationDate = (dateStr: string | undefined): string => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 7) return `${diffDays}j`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}sem`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}m`;
  return `${Math.floor(diffDays / 365)}a`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🌻 MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface TournesolTrendingSectionProps {
  onVideoSelect?: (videoId: string) => void;
  language?: "fr" | "en";
}

export const TournesolTrendingSection: React.FC<
  TournesolTrendingSectionProps
> = ({ onVideoSelect, language = "fr" }) => {
  const [langFilter, setLangFilter] = useState<"" | "fr" | "en">("");
  const [results, setResults] = useState<TournesolResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = MESSAGES[language];

  // Nombre de résultats demandés par page
  const PAGE_SIZE = 12;
  // Pool total dans lequel on pioche aléatoirement (Tournesol a ~500+ vidéos recommandées)
  const POOL_SIZE = 200;

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Offset aléatoire pour varier les suggestions à chaque chargement
      const randomOffset = Math.floor(Math.random() * (POOL_SIZE - PAGE_SIZE));

      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(randomOffset),
        unsafe: "false",
      });
      if (langFilter) {
        params.set("metadata[language]", langFilter);
      }

      const response = await fetch(`${TOURNESOL_API}?${params}`);
      if (!response.ok) {
        throw new Error(`Tournesol API error: ${response.status}`);
      }

      const data: TournesolApiResponse = await response.json();
      // Mélanger les résultats pour encore plus de variété visuelle
      const shuffled = (data.results || []).sort(() => Math.random() - 0.5);
      setResults(shuffled);
    } catch (err) {
      console.error("[TournesolTrending] Fetch error:", err);
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }, [langFilter, t.error]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-yellow-500/10">
            <img
              src="/platforms/tournesol-icon.svg"
              alt="Tournesol"
              className="w-5 h-5"
            />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              {t.title}
              <span className="text-[10px] font-normal text-white/30">
                {t.poweredBy}{" "}
                <a
                  href={TOURNESOL_SITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400/60 hover:text-yellow-400 transition-colors"
                >
                  tournesol.app
                  <ExternalLink className="w-2.5 h-2.5 inline ml-0.5 -mt-0.5" />
                </a>
              </span>
            </h2>
            <p className="text-sm text-white/50">{t.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh button */}
          <button
            onClick={fetchRecommendations}
            disabled={loading}
            className="p-2 rounded-lg text-white/30 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all disabled:opacity-30"
            title={
              language === "fr" ? "Nouvelles suggestions" : "New suggestions"
            }
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* Language filter */}
          <div className="flex gap-1 bg-white/5 rounded-lg p-1">
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                onClick={() => setLangFilter(l.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  langFilter === l.value
                    ? "bg-yellow-500/20 text-yellow-300"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {l.label[language]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-white/5 border border-white/10 overflow-hidden animate-pulse"
            >
              <div className="aspect-video bg-white/10" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/10 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-white/40 mb-3">{error}</p>
          <button
            onClick={fetchRecommendations}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-yellow-400 bg-yellow-500/10 rounded-lg hover:bg-yellow-500/20 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {t.retry}
          </button>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-12 text-white/40">{t.noData}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {results.map((item) => (
            <TournesolCard
              key={item.entity.uid}
              item={item}
              language={language}
              labels={t}
              onClick={() => {
                const videoId = item.entity.metadata.video_id;
                onVideoSelect?.(videoId);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🃏 CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface TournesolCardProps {
  item: TournesolResult;
  language: "fr" | "en";
  labels: (typeof MESSAGES)["fr"];
  onClick: () => void;
}

const TournesolCard: React.FC<TournesolCardProps> = ({
  item,
  language,
  labels,
  onClick,
}) => {
  const { entity, collective_rating } = item;
  const { metadata } = entity;
  const thumbUrl = `https://img.youtube.com/vi/${metadata.video_id}/mqdefault.jpg`;
  const score = collective_rating.tournesol_score;

  const reliability = getCriteriaScore(
    collective_rating.criteria_scores,
    "reliability",
  );
  const pedagogy = getCriteriaScore(
    collective_rating.criteria_scores,
    "pedagogy",
  );

  return (
    <button
      onClick={onClick}
      className="group rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden
                 hover:bg-white/[0.06] hover:border-yellow-500/20 transition-all text-left w-full
                 backdrop-blur-sm"
      title={labels.analyzeThis}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={thumbUrl}
          alt={metadata.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {metadata.duration && (
          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/80 rounded text-[10px] text-white/80 font-mono">
            <Clock className="w-2.5 h-2.5 inline mr-0.5 -mt-0.5" />
            {formatDuration(metadata.duration)}
          </span>
        )}
        {/* Tournesol score badge */}
        <span
          className={`absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${getScoreBg(score)} ${getScoreColor(score)}`}
        >
          🌻 {formatScore(score)}
        </span>
        {/* Publication date */}
        {metadata.publication_date && (
          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-white/50">
            {formatPublicationDate(metadata.publication_date)}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <h3 className="text-sm font-medium text-white/90 line-clamp-2 leading-tight">
          {metadata.name}
        </h3>
        <p className="text-xs text-white/40 truncate">{metadata.uploader}</p>

        {/* Criteria mini-scores */}
        <div className="flex items-center gap-2 text-[10px] text-white/30 pt-1 flex-wrap">
          <span className="flex items-center gap-1">
            <ThumbsUp className="w-3 h-3" />
            {collective_rating.n_contributors} {labels.contributors}
          </span>
          {reliability !== null && (
            <span
              className={`${reliability >= 50 ? "text-emerald-400/60" : "text-white/30"}`}
            >
              {labels.reliability}: {reliability}
            </span>
          )}
          {pedagogy !== null && (
            <span
              className={`${pedagogy >= 50 ? "text-blue-400/60" : "text-white/30"}`}
            >
              {labels.pedagogy}: {pedagogy}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export default TournesolTrendingSection;
