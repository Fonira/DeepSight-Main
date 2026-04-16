/**
 * 🔄 LOADING SPINNER v5.0 — Deep Sight Aurora
 * Spinner CSS pur basé sur le vrai logo DeepSight avec effets magiques cumulables.
 * 60fps, zéro vidéo, zéro dépendance, respecte prefers-reduced-motion.
 * 🆕 v5.0: Aurora spinner avec blades/flames/water/sparks/rings via preset "magic"
 */

import React from "react";
import { LoadingWordCompact } from "./LoadingWord";
import "./Spinner.css";

// ═══════════════════════════════════════════════════════════════════════════════
// 🎬 LOADING SPINNER — Composant principal
// ═══════════════════════════════════════════════════════════════════════════════

export type SpinnerEffect =
  | "blades"
  | "flames"
  | "water"
  | "sparks"
  | "rings"
  | "magic";

interface LoadingSpinnerProps {
  /** Taille du spinner */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "hero" | number;
  /** Message à afficher sous le spinner */
  message?: string;
  /** Afficher en plein écran avec overlay */
  fullScreen?: boolean;
  /** Progression (0-100) pour la barre de chargement */
  progress?: number;
  /** Afficher la barre de progression */
  showProgress?: boolean;
  /** Classes CSS additionnelles */
  className?: string;
  /** Message pour les lecteurs d'écran */
  label?: string;
  /** Rétrocompatibilité */
  variant?: "nautical" | "gold" | "video";
  /** 🆕 Afficher le widget "Le Saviez-Vous" */
  showWord?: boolean;
  /** Effets magiques (défaut: ["magic"] pour md+, aucun pour xs/sm) */
  effects?: SpinnerEffect[];
  /** Vitesse rotation en secondes (override auto) */
  speed?: number;
  /** Sens rotation inversé */
  reverse?: boolean;
  /** URL logo (défaut: /deepsight-logo.png) */
  logoSrc?: string;
}

const sizeMap: Record<string, number> = {
  xs: 32,
  sm: 48,
  md: 96,
  lg: 160,
  xl: 240,
  hero: 360,
};

/** Durée rotation par défaut basée sur taille en px (petit = rapide, grand = hypnotique) */
function defaultDuration(px: number): number {
  if (px <= 48) return 2.2;
  if (px <= 96) return 3.5;
  if (px <= 160) return 5;
  return 7;
}

/** Effets par défaut basés sur taille */
function defaultEffects(px: number): SpinnerEffect[] {
  if (px < 56) return []; // trop petit pour que les effets soient lisibles
  if (px < 128) return ["flames", "sparks"];
  return ["magic"];
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  message,
  fullScreen = false,
  progress,
  showProgress = false,
  className = "",
  label = "Chargement en cours...",
  showWord = false,
  effects,
  speed,
  reverse = false,
  logoSrc = "/deepsight-logo.png",
}) => {
  const pixelSize = typeof size === "number" ? size : sizeMap[size];
  const resolvedEffects = effects ?? defaultEffects(pixelSize);
  const resolvedSpeed = speed ?? defaultDuration(pixelSize);
  const hasProgress = showProgress || typeof progress === "number";

  const fxClasses = resolvedEffects.map((e) => `ds-spinner--fx-${e}`);
  const spinnerClasses = [
    "ds-spinner",
    reverse ? "ds-spinner--reverse" : "",
    ...fxClasses,
  ]
    .filter(Boolean)
    .join(" ");

  const spinnerStyle: React.CSSProperties = {
    width: pixelSize,
    height: pixelSize,
    ["--ds-spin-duration" as string]: `${resolvedSpeed}s`,
  } as React.CSSProperties;

  const spinner = (
    <div
      className={`flex flex-col items-center justify-center gap-4 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className={spinnerClasses} style={spinnerStyle} aria-label={label}>
        <div className="ds-spinner__water" aria-hidden="true" />
        <div className="ds-spinner__flames" aria-hidden="true" />
        <div className="ds-spinner__blades" aria-hidden="true" />
        <div className="ds-spinner__rings" aria-hidden="true" />
        <div className="ds-spinner__wheel">
          <img
            className="ds-spinner__img"
            src={logoSrc}
            alt=""
            draggable={false}
            aria-hidden="true"
          />
        </div>
        <div className="ds-spinner__pulse" aria-hidden="true" />
        <div className="ds-spinner__ring" aria-hidden="true" />
        <div className="ds-spinner__sparks" aria-hidden="true" />
      </div>

      {/* Barre de progression */}
      {hasProgress && (
        <div className="w-full max-w-xs">
          <div className="h-1.5 bg-border-subtle/30 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${progress ?? 0}%`,
                background: "linear-gradient(90deg, #6366f1, #8b5cf6, #fb923c)",
              }}
            />
          </div>
          {typeof progress === "number" && (
            <p className="text-center text-text-tertiary text-xs mt-1">
              {Math.round(progress)}%
            </p>
          )}
        </div>
      )}

      {/* Message */}
      {message && (
        <p className="text-text-secondary text-sm animate-pulse text-center">
          {message}
        </p>
      )}

      {/* Widget "Le Saviez-Vous" */}
      {showWord && (
        <div className="mt-4 max-w-sm">
          <LoadingWordCompact />
        </div>
      )}

      <span className="sr-only">{label}</span>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary/90 dark:bg-[#0a0a1a]/95 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  return spinner;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 LOADING OVERLAY
// ═══════════════════════════════════════════════════════════════════════════════

export const LoadingOverlay: React.FC<{
  loading: boolean;
  message?: string;
  progress?: number;
  children: React.ReactNode;
}> = ({ loading, message, progress, children }) => {
  return (
    <div className="relative">
      {children}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/80 dark:bg-[#0a0a1a]/85 backdrop-blur-sm rounded-lg z-10">
          <LoadingSpinner
            size="lg"
            message={message}
            progress={progress}
            showProgress={typeof progress === "number"}
          />
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎬 PAGE LOADING — Écran de chargement pleine page
// ═══════════════════════════════════════════════════════════════════════════════

export const PageLoading: React.FC<{
  message?: string;
  progress?: number;
  showWord?: boolean;
}> = ({ message = "Chargement...", progress, showWord = true }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary dark:bg-[#0a0a1a]">
      <LoadingSpinner
        size="hero"
        message={message}
        progress={progress}
        showProgress={typeof progress === "number"}
        showWord={showWord}
      />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📹 VIDEO ANALYSIS LOADING — Pour l'analyse de vidéos
// ═══════════════════════════════════════════════════════════════════════════════

export const VideoAnalysisLoading: React.FC<{
  progress?: number;
  stage?: string;
  showWord?: boolean;
}> = ({ progress = 0, stage, showWord = true }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6">
      <LoadingSpinner size="xl" />

      {stage && (
        <p className="text-text-primary font-medium text-center">{stage}</p>
      )}

      <div className="w-72">
        <div className="h-2 bg-border-subtle/30 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #6366f1, #8b5cf6, #fb923c)",
            }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-text-tertiary">
          <span>{Math.round(progress)}%</span>
          <span>{progress < 100 ? "En cours..." : "Terminé !"}</span>
        </div>
      </div>

      {showWord && (
        <div className="mt-4 max-w-sm">
          <LoadingWordCompact />
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 SKELETON LOADER
// ═══════════════════════════════════════════════════════════════════════════════

interface SkeletonLoaderProps {
  lines?: number;
  className?: string;
  showLogo?: boolean;
  label?: string;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  lines = 3,
  className = "",
  showLogo = true,
  label = "Chargement du contenu...",
}) => {
  return (
    <div
      className={`space-y-4 ${className}`}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      {showLogo && (
        <div className="flex items-center gap-4 mb-4">
          <LoadingSpinner size="sm" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-border-subtle/30 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-border-subtle/20 rounded animate-pulse w-1/2" />
          </div>
        </div>
      )}
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-border-subtle/20 rounded animate-pulse"
          style={{ width: `${100 - i * 12}%`, animationDelay: `${i * 0.1}s` }}
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
};

export default LoadingSpinner;
