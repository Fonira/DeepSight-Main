/**
 * 🌻 TOURNESOL WIDGET v2.0 — Inspiré du prototype extension
 * ═══════════════════════════════════════════════════════════════════════════════
 * Affiche les données Tournesol fidèle au design de l'extension officielle
 *
 * FONCTIONNALITÉS:
 * - Badge score avec icône tournesol (style extension)
 * - Comparaisons / Contributeurs
 * - Bouton "Comparer" vert → ouvre Tournesol
 * - Bouton "Plus Tard" pour sauvegarder
 * - Popup éducatif sur l'éthique algorithmique
 *
 * API: https://api.tournesol.app/polls/videos/entities/yt:{video_id}
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useRef } from "react";
import {
  ExternalLink,
  Info,
  Users,
  Scale,
  Shield,
  BookOpen,
  Sparkles,
  X,
  ChevronDown,
  ChevronUp,
  Plus,
  AlertTriangle,
  Heart,
  Zap,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface TournesolEntity {
  uid: string;
  tournesol_score: number | null;
  n_comparisons: number;
  n_contributors: number;
  criteria_scores?: Array<{
    criteria: string;
    score: number | null;
  }>;
  metadata?: {
    name?: string;
    uploader?: string;
    publication_date?: string;
  };
}

interface TournesolWidgetProps {
  videoId: string;
  variant?: "full" | "compact" | "badge";
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 CRITÈRES TOURNESOL
// ═══════════════════════════════════════════════════════════════════════════════

const CRITERIA_CONFIG: Record<
  string,
  {
    label: string;
    labelFr: string;
    icon: React.ElementType;
    color: string;
    description: string;
  }
> = {
  largely_recommended: {
    label: "Largely Recommended",
    labelFr: "Score global",
    icon: Sparkles,
    color: "#FFD700",
    description: "Score global Tournesol basé sur tous les critères",
  },
  reliability: {
    label: "Reliable & Not Misleading",
    labelFr: "Fiable",
    icon: Shield,
    color: "#10b981",
    description: "Contenu fiable et non trompeur",
  },
  importance: {
    label: "Important & Actionable",
    labelFr: "Important",
    icon: Scale,
    color: "#8b5cf6",
    description: "Sujet important et actionnable",
  },
  engaging: {
    label: "Engaging & Thought-provoking",
    labelFr: "Engageant",
    icon: Sparkles,
    color: "#f59e0b",
    description: "Contenu engageant et stimulant",
  },
  pedagogy: {
    label: "Clear & Pedagogical",
    labelFr: "Pédagogique",
    icon: BookOpen,
    color: "#3b82f6",
    description: "Clair et pédagogique",
  },
  layman_friendly: {
    label: "Layman-friendly",
    labelFr: "Accessible",
    icon: Users,
    color: "#ec4899",
    description: "Accessible au grand public",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🌻 ICÔNE TOURNESOL SVG
// ═══════════════════════════════════════════════════════════════════════════════

const TournesolIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = "",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    className={className}
    style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}
  >
    {/* Pétales */}
    {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => (
      <ellipse
        key={i}
        cx="50"
        cy="20"
        rx="8"
        ry="18"
        fill="#FFD700"
        transform={`rotate(${angle} 50 50)`}
        style={{ filter: "brightness(1.1)" }}
      />
    ))}
    {/* Centre */}
    <circle cx="50" cy="50" r="20" fill="#8B4513" />
    <circle cx="50" cy="50" r="16" fill="#A0522D" />
    {/* Graines */}
    {[
      [45, 45],
      [55, 45],
      [50, 50],
      [45, 55],
      [55, 55],
      [50, 42],
      [42, 50],
      [58, 50],
      [50, 58],
    ].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="2.5" fill="#654321" opacity="0.7" />
    ))}
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// 🌻 COMPOSANT PRINCIPAL — STYLE EXTENSION
// ═══════════════════════════════════════════════════════════════════════════════

export const TournesolWidget: React.FC<TournesolWidgetProps> = ({
  videoId,
  variant = "full",
  className = "",
}) => {
  const [data, setData] = useState<TournesolEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // Fetch Tournesol data via proxy backend (évite CORS)
  useEffect(() => {
    const fetchTournesolData = async () => {
      if (!videoId) {
        setLoading(false);
        return;
      }

      // Nettoyer le videoId
      const cleanVideoId = videoId.trim().replace(/^yt:/, "");

      setLoading(true);
      setError(null);

      try {
        // Utiliser le proxy backend Deep Sight
        const apiUrl =
          import.meta.env.VITE_API_URL || "https://api.deepsightsynthesis.com";
        const url = `${apiUrl}/api/tournesol/video/${cleanVideoId}`;

        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.found && result.data) {
          setData(result.data);
        } else {
          setData(null);
        }
      } catch (err: any) {
        setError("unavailable");
      } finally {
        setLoading(false);
      }
    };

    fetchTournesolData();
  }, [videoId]);

  // Close popup on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node)
      ) {
        setShowInfoPopup(false);
      }
    };

    if (showInfoPopup) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showInfoPopup]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔧 HELPER: Récupérer le score effectif
  // ═══════════════════════════════════════════════════════════════════════════════

  const getEffectiveScore = (): number | null => {
    if (!data) return null;

    // 1. Score global si disponible
    if (data.tournesol_score !== null && data.tournesol_score !== undefined) {
      return data.tournesol_score;
    }

    // 2. Sinon chercher "largely_recommended" dans criteria_scores
    if (data.criteria_scores && data.criteria_scores.length > 0) {
      const largelyRec = data.criteria_scores.find(
        (c) => c.criteria === "largely_recommended",
      );
      if (largelyRec && largelyRec.score !== null) {
        return largelyRec.score;
      }

      // 3. Ou prendre le premier score disponible
      const firstScore = data.criteria_scores.find((c) => c.score !== null);
      if (firstScore && firstScore.score !== null) {
        return firstScore.score;
      }
    }

    return null;
  };

  const effectiveScore = getEffectiveScore();
  const hasAnyData =
    data &&
    (effectiveScore !== null || (data.n_comparisons && data.n_comparisons > 0));

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎨 RENDER — CAS "PAS SUR TOURNESOL"
  // ═══════════════════════════════════════════════════════════════════════════════

  // Si pas de data ou erreur, afficher un widget "Non évalué"
  if (!loading && (!hasAnyData || error)) {
    // Pour le badge, ne rien afficher si pas de data
    if (variant === "badge") {
      return null;
    }

    // Pour la version complète, afficher "Non encore évalué"
    return (
      <div className={`relative ${className}`}>
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%)",
            border: "1px solid rgba(255, 215, 0, 0.15)",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
          }}
        >
          {/* Icône Tournesol */}
          <TournesolIcon size={28} />

          {/* Message */}
          <div className="flex-1">
            <span className="text-sm text-slate-300">
              Cette vidéo n'est{" "}
              <span className="text-[#FFD700] font-medium">
                pas encore évaluée
              </span>{" "}
              sur Tournesol
            </span>
          </div>

          {/* Bouton Comparer */}
          <a
            href={`https://tournesol.app/comparison?uidA=yt:${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all hover:scale-105 hover:shadow-lg"
            style={{
              background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
              color: "white",
              boxShadow: "0 2px 10px rgba(34, 197, 94, 0.3)",
            }}
          >
            <Scale className="w-4 h-4" />
            Évaluer
          </a>

          {/* Bouton info */}
          <button
            onClick={() => setShowInfoPopup(!showInfoPopup)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            title="Qu'est-ce que Tournesol ?"
          >
            <Info className="w-4 h-4 text-slate-400 hover:text-[#FFD700]" />
          </button>
        </div>

        {/* Popup info (même que la version complète) */}
        {showInfoPopup && (
          <div
            ref={popupRef}
            className="absolute top-full left-0 right-0 mt-2 p-5 rounded-xl z-50"
            style={{
              background:
                "linear-gradient(135deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%)",
              border: "1px solid rgba(255, 215, 0, 0.3)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(10px)",
            }}
          >
            <button
              onClick={() => setShowInfoPopup(false)}
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/10"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <TournesolIcon size={36} />
              <div>
                <h3 className="font-bold text-[#FFD700]">
                  Qu'est-ce que Tournesol ?
                </h3>
                <p className="text-xs text-slate-400">
                  Recommandations collaboratives et éthiques
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm leading-relaxed text-slate-300">
              <div
                className="flex gap-3 p-3 rounded-lg"
                style={{ background: "rgba(34, 197, 94, 0.1)" }}
              >
                <TournesolIcon size={20} className="flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-green-400 mb-1">
                    Alternative aux algorithmes
                  </div>
                  <p className="text-slate-400 text-xs">
                    Des{" "}
                    <strong className="text-slate-300">
                      citoyens évaluent collectivement
                    </strong>{" "}
                    les contenus selon des critères de qualité (fiabilité,
                    pédagogie, importance...) pour créer des recommandations
                    <strong className="text-slate-300">
                      {" "}
                      alternatives et démocratiques
                    </strong>
                    .
                  </p>
                </div>
              </div>

              <a
                href="https://tournesol.app/about"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-[#FFD700] transition-colors py-2"
              >
                <Info className="w-3 h-3" />
                En savoir plus sur le projet Tournesol
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Loading state
  if (loading) {
    return null;
  }

  // 🔧 Utiliser effectiveScore calculé ci-dessus
  const score = effectiveScore;
  const comparisons = data?.n_comparisons || 0;
  const contributors = data?.n_contributors || 0;

  const criteriaScores = data?.criteria_scores || [];

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎨 RENDER — BADGE COMPACT
  // ═══════════════════════════════════════════════════════════════════════════════

  if (variant === "badge") {
    return (
      <a
        href={`https://tournesol.app/entities/yt:${videoId}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all hover:scale-105 ${className}`}
        style={{
          background: "rgba(255, 215, 0, 0.12)",
          border: "1px solid rgba(255, 215, 0, 0.35)",
          color: "#FFD700",
        }}
        title={`Score Tournesol: ${score !== null ? Math.round(score) : "—"}`}
      >
        <TournesolIcon size={16} />
        <span>{score !== null ? Math.round(score) : "—"}</span>
      </a>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎨 RENDER — VERSION COMPLÈTE (Style Extension)
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className={`relative ${className}`}>
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* 🌻 BARRE PRINCIPALE — STYLE EXTENSION TOURNESOL */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)",
          border: "1px solid rgba(255, 215, 0, 0.25)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
        }}
      >
        {/* Score avec icône */}
        <button
          onClick={() => setShowInfoPopup(!showInfoPopup)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
          title="En savoir plus sur Tournesol"
        >
          <TournesolIcon size={28} />
          <span className="text-2xl font-black" style={{ color: "#FFD700" }}>
            {score !== null ? Math.round(score) : "—"}
          </span>
        </button>

        {/* Séparateur */}
        <div className="w-px h-8 bg-white/10" />

        {/* Stats */}
        <div className="flex items-center gap-1.5 text-sm text-slate-300">
          <span className="font-medium">{comparisons}</span>
          <span className="text-slate-500">comparaisons par</span>
          <span className="font-medium">{contributors}</span>
          <span className="text-slate-500">
            contributeur{contributors > 1 ? "·rices" : ""}
          </span>

          {/* Bouton info */}
          <button
            onClick={() => setShowInfoPopup(!showInfoPopup)}
            className="ml-1 p-1 rounded-full hover:bg-white/10 transition-colors"
            title="Qu'est-ce que Tournesol ?"
          >
            <Info className="w-4 h-4 text-slate-400 hover:text-[#FFD700]" />
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Boutons d'action */}
        <div className="flex items-center gap-2">
          {/* Bouton Comparer — Style extension */}
          <a
            href={`https://tournesol.app/comparison?uidA=yt:${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all hover:scale-105 hover:shadow-lg"
            style={{
              background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
              color: "white",
              boxShadow: "0 2px 10px rgba(34, 197, 94, 0.3)",
            }}
          >
            <Scale className="w-4 h-4" />
            Comparer
          </a>

          {/* Bouton Plus Tard */}
          <a
            href={`https://tournesol.app/rate_later/?add=yt:${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all hover:bg-white/10"
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#e2e8f0",
            }}
          >
            <Plus className="w-4 h-4" />
            Plus Tard
          </a>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* 📋 POPUP INFORMATIF */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {showInfoPopup && (
        <div
          ref={popupRef}
          className="absolute top-full mt-3 left-0 z-50 w-[calc(100vw-2rem)] sm:w-[420px] rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
          style={{
            background:
              "linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(10, 15, 30, 0.98) 100%)",
            border: "1px solid rgba(255, 215, 0, 0.3)",
            boxShadow:
              "0 25px 50px rgba(0, 0, 0, 0.5), 0 0 80px rgba(255, 215, 0, 0.08)",
          }}
        >
          {/* Header */}
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{
              background:
                "linear-gradient(135deg, rgba(255, 215, 0, 0.12) 0%, rgba(255, 183, 0, 0.05) 100%)",
              borderBottom: "1px solid rgba(255, 215, 0, 0.15)",
            }}
          >
            <div className="flex items-center gap-3">
              <TournesolIcon size={36} />
              <div>
                <h3 className="font-bold text-[#FFD700] text-lg">Tournesol</h3>
                <p className="text-xs text-slate-400">
                  Recommandations collaboratives & éthiques
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowInfoPopup(false)}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-5">
            {/* Score Card */}
            <div
              className="flex items-center gap-5 p-4 rounded-xl"
              style={{ background: "rgba(255, 215, 0, 0.08)" }}
            >
              <div className="text-center">
                <div className="text-5xl font-black text-[#FFD700]">
                  {score !== null ? Math.round(score) : "—"}
                </div>
                <div className="text-xs text-slate-500 mt-1">Score global</div>
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <Scale className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-300">
                    {comparisons} comparaisons
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-300">
                    {contributors} contributeur
                    {contributors > 1 ? "·rices" : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Critères détaillés */}
            {criteriaScores.length > 0 && (
              <div>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full flex items-center justify-between py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <span className="font-medium">📊 Critères détaillés</span>
                  {showDetails ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {showDetails && (
                  <div className="space-y-3 mt-2 p-3 rounded-xl bg-white/5 animate-in slide-in-from-top-2 duration-200">
                    {criteriaScores.map((criterion) => {
                      const config = CRITERIA_CONFIG[criterion.criteria];
                      if (!config || criterion.score === null) return null;

                      const Icon = config.icon;
                      const normalizedScore = Math.min(
                        100,
                        Math.max(0, ((criterion.score + 100) / 200) * 100),
                      );

                      return (
                        <div
                          key={criterion.criteria}
                          className="flex items-center gap-3"
                        >
                          <Icon
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: config.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-slate-300">
                                {config.labelFr}
                              </span>
                              <span
                                className="text-sm font-bold"
                                style={{ color: config.color }}
                              >
                                {Math.round(criterion.score)}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${normalizedScore}%`,
                                  background: `linear-gradient(90deg, ${config.color}cc, ${config.color})`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Call to Action */}
            <div className="flex gap-2">
              <a
                href={`https://tournesol.app/comparison?uidA=yt:${videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
                style={{
                  background:
                    "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                  color: "white",
                }}
              >
                <Scale className="w-4 h-4" />
                Comparer cette vidéo
              </a>
              <a
                href={`https://tournesol.app/entities/yt:${videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all hover:bg-white/10"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#e2e8f0",
                }}
              >
                <ExternalLink className="w-4 h-4" />
                Voir sur Tournesol
              </a>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent" />

            {/* Section éducative — L'enjeu des algorithmes */}
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 font-bold text-[#FFD700] text-sm">
                <AlertTriangle className="w-4 h-4" />
                Pourquoi c'est crucial ?
              </h4>

              <div className="space-y-3 text-sm leading-relaxed text-slate-300">
                <div
                  className="flex gap-3 p-3 rounded-lg"
                  style={{ background: "rgba(239, 68, 68, 0.1)" }}
                >
                  <Zap className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-red-400 mb-1">
                      Le problème
                    </div>
                    <p className="text-slate-400 text-xs">
                      Les algorithmes de YouTube, TikTok et autres maximisent le{" "}
                      <strong className="text-slate-300">temps d'écran</strong>,
                      pas la qualité. Résultat : désinformation, polarisation et
                      contenus sensationnalistes favorisés.
                    </p>
                  </div>
                </div>

                <div
                  className="flex gap-3 p-3 rounded-lg"
                  style={{ background: "rgba(34, 197, 94, 0.1)" }}
                >
                  <TournesolIcon size={20} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-green-400 mb-1">
                      La solution Tournesol
                    </div>
                    <p className="text-slate-400 text-xs">
                      Des{" "}
                      <strong className="text-slate-300">
                        citoyens évaluent collectivement
                      </strong>{" "}
                      les contenus selon des critères de qualité (fiabilité,
                      pédagogie, importance...) pour créer des recommandations
                      <strong className="text-slate-300">
                        {" "}
                        alternatives et démocratiques
                      </strong>
                      .
                    </p>
                  </div>
                </div>

                <div
                  className="flex gap-3 p-3 rounded-lg"
                  style={{ background: "rgba(255, 215, 0, 0.08)" }}
                >
                  <Heart className="w-5 h-5 text-[#FFD700] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-[#FFD700] mb-1">
                      Votre impact
                    </div>
                    <p className="text-slate-400 text-xs">
                      Chaque comparaison compte ! En évaluant des vidéos, vous
                      contribuez à un web plus sain et aidez la recherche en{" "}
                      <strong className="text-slate-300">
                        éthique algorithmique
                      </strong>
                      .
                    </p>
                  </div>
                </div>
              </div>

              {/* Lien vers Tournesol */}
              <a
                href="https://tournesol.app/about"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-[#FFD700] transition-colors py-2"
              >
                <Info className="w-3 h-3" />
                En savoir plus sur le projet Tournesol
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🏷️ BADGE COMPACT (pour les listes d'historique)
// ═══════════════════════════════════════════════════════════════════════════════

export const TournesolBadge: React.FC<{
  videoId: string;
  className?: string;
}> = ({ videoId, className = "" }) => {
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScore = async () => {
      try {
        // Utiliser le proxy backend Deep Sight
        const apiUrl =
          import.meta.env.VITE_API_URL || "https://api.deepsightsynthesis.com";
        const response = await fetch(
          `${apiUrl}/api/tournesol/video/${videoId}`,
          { headers: { Accept: "application/json" } },
        );
        if (response.ok) {
          const result = await response.json();
          if (result.found && result.data) {
            // 🔧 CORRECTION: Chercher le score dans tournesol_score OU criteria_scores
            let effectiveScore = result.data.tournesol_score;

            if (
              effectiveScore === null &&
              result.data.criteria_scores?.length > 0
            ) {
              const largelyRec = result.data.criteria_scores.find(
                (c: any) => c.criteria === "largely_recommended",
              );
              if (largelyRec?.score !== null) {
                effectiveScore = largelyRec.score;
              } else {
                const firstScore = result.data.criteria_scores.find(
                  (c: any) => c.score !== null,
                );
                if (firstScore?.score !== null) {
                  effectiveScore = firstScore.score;
                }
              }
            }

            setScore(effectiveScore);
          }
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    };
    fetchScore();
  }, [videoId]);

  if (loading || score === null) return null;

  return (
    <a
      href={`https://tournesol.app/entities/yt:${videoId}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold transition-all hover:scale-105 ${className}`}
      style={{
        background: "rgba(255, 215, 0, 0.12)",
        border: "1px solid rgba(255, 215, 0, 0.3)",
        color: "#FFD700",
      }}
      title={`Score Tournesol: ${Math.round(score)} — Cliquer pour voir sur Tournesol`}
    >
      <span>🌻</span>
      <span>{Math.round(score)}</span>
    </a>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🏷️ MINI WIDGET (pour affichage inline dans les badges)
// ═══════════════════════════════════════════════════════════════════════════════

export const TournesolMini: React.FC<{
  videoId: string;
  showStats?: boolean;
  className?: string;
}> = ({ videoId, showStats = true, className = "" }) => {
  const [data, setData] = useState<TournesolEntity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Nettoyer le videoId
      const cleanVideoId = videoId?.trim().replace(/^yt:/, "");
      if (!cleanVideoId) {
        setLoading(false);
        return;
      }

      try {
        // Utiliser le proxy backend Deep Sight
        const apiUrl =
          import.meta.env.VITE_API_URL || "https://api.deepsightsynthesis.com";
        const url = `${apiUrl}/api/tournesol/video/${cleanVideoId}`;

        // 🔍 DEBUG: Afficher l'URL appelée

        const response = await fetch(url, {
          headers: { Accept: "application/json" },
        });

        if (response.ok) {
          const result = await response.json();
          // 🔍 DEBUG: Log détaillé pour comprendre la structure

          if (result.found && result.data) {
            setData(result.data);
          } else {
          }
        }
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [videoId]);

  if (loading) return null;

  // 🔧 CORRECTION: Récupérer le score depuis tournesol_score OU criteria_scores
  const getEffectiveScore = (): number | null => {
    if (!data) return null;

    // 1. Score global si disponible
    if (data.tournesol_score !== null && data.tournesol_score !== undefined) {
      return data.tournesol_score;
    }

    // 2. Sinon chercher "largely_recommended" dans criteria_scores
    if (data.criteria_scores && data.criteria_scores.length > 0) {
      const largelyRec = data.criteria_scores.find(
        (c) => c.criteria === "largely_recommended",
      );
      if (largelyRec && largelyRec.score !== null) {
        return largelyRec.score;
      }

      // 3. Ou prendre le premier score disponible
      const firstScore = data.criteria_scores.find((c) => c.score !== null);
      if (firstScore && firstScore.score !== null) {
        return firstScore.score;
      }
    }

    return null;
  };

  const effectiveScore = getEffectiveScore();
  const hasAnyData =
    data &&
    (effectiveScore !== null || (data.n_comparisons && data.n_comparisons > 0));

  // Si pas sur Tournesol, afficher un badge "Non évalué"
  if (!hasAnyData) {
    return (
      <a
        href={`https://tournesol.app/comparison?uidA=yt:${videoId}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 group ${className}`}
        style={{
          background: "rgba(255, 215, 0, 0.08)",
          border: "1px solid rgba(255, 215, 0, 0.2)",
          color: "rgba(255, 215, 0, 0.7)",
        }}
        title="Cette vidéo n'est pas encore évaluée sur Tournesol — Cliquer pour évaluer"
      >
        <span className="text-base opacity-70">🌻</span>
        <span className="opacity-70">Non évalué</span>
        <span className="text-[10px] opacity-50 group-hover:opacity-100 transition-opacity">
          → Évaluer
        </span>
      </a>
    );
  }

  return (
    <a
      href={`https://tournesol.app/comparison?uidA=yt:${videoId}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:scale-105 group ${className}`}
      style={{
        background:
          "linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 183, 0, 0.1) 100%)",
        border: "1px solid rgba(255, 215, 0, 0.4)",
        color: "#FFD700",
      }}
      title="Score Tournesol — Cliquer pour comparer"
    >
      <span className="text-base">🌻</span>
      <span className="font-bold">
        {effectiveScore !== null ? Math.round(effectiveScore) : "—"}
      </span>
      {showStats && data && (
        <span className="text-[10px] opacity-70 group-hover:opacity-100 transition-opacity">
          • {data.n_comparisons || 0} comp. • {data.n_contributors || 0}{" "}
          contrib.
        </span>
      )}
    </a>
  );
};

export default TournesolWidget;
