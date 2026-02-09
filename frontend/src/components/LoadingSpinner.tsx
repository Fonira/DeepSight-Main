/**
 * 🔄 LOADING SPINNER v4.0 — Deep Sight
 * Spinner de chargement avec vidéo du logo animé
 * Inclut une barre de progression optionnelle
 * 🆕 v4.0: Intégration du widget "Le Saviez-Vous"
 */

import React, { useRef, useEffect, useState } from 'react';
import { LoadingWordCompact } from './LoadingWord';

// ═══════════════════════════════════════════════════════════════════════════════
// 🎬 VIDEO LOADING SPINNER — Composant principal
// ═══════════════════════════════════════════════════════════════════════════════

interface LoadingSpinnerProps {
  /** Taille du spinner */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero' | number;
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
  variant?: 'nautical' | 'gold' | 'video';
  /** 🆕 Afficher le widget "Le Saviez-Vous" */
  showWord?: boolean;
}

const sizeMap = {
  xs: 32,
  sm: 48,
  md: 64,
  lg: 96,
  xl: 128,
  hero: 200,
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  message,
  fullScreen = false,
  progress,
  showProgress = false,
  className = '',
  label = 'Chargement en cours...',
  showWord = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);
  const pixelSize = typeof size === 'number' ? size : sizeMap[size];

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const playVideo = async () => {
      try {
        await video.play();
      } catch {
        // Autoplay bloqué, on continue
      }
    };

    video.addEventListener('canplay', playVideo);
    video.addEventListener('error', () => setVideoError(true));
    
    if (video.readyState >= 3) playVideo();

    return () => {
      video.removeEventListener('canplay', playVideo);
    };
  }, []);

  const hasProgress = showProgress || typeof progress === 'number';

  const spinner = (
    <div 
      className={`flex flex-col items-center justify-center gap-4 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Conteneur vidéo/logo */}
      <div 
        className="relative"
        style={{ width: pixelSize, height: pixelSize }}
      >
        {/* Glow effect */}
        <div 
          className="absolute inset-0 rounded-full opacity-50"
          style={{
            background: 'radial-gradient(circle, rgba(74, 144, 217, 0.3) 0%, rgba(212, 165, 116, 0.2) 50%, transparent 70%)',
            filter: 'blur(20px)',
            transform: 'scale(1.4)',
          }}
        />
        
        {/* Vidéo ou fallback SVG */}
        {!videoError ? (
          <video
            ref={videoRef}
            className="w-full h-full object-contain relative z-10"
            src="/logo-animation.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            style={{
              filter: 'drop-shadow(0 0 15px rgba(74, 144, 217, 0.3))'
            }}
          />
        ) : (
          <FallbackSpinner size={pixelSize} />
        )}
      </div>

      {/* Barre de progression */}
      {hasProgress && (
        <div className="w-full max-w-xs">
          <div className="h-1.5 bg-border-subtle/30 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{ 
                width: `${progress ?? 0}%`,
                background: 'linear-gradient(90deg, #4A7BA7, #C4935A, #6B4380)'
              }}
            />
          </div>
          {typeof progress === 'number' && (
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

      {/* 🆕 Widget "Le Saviez-Vous" */}
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
// 🎯 FALLBACK SVG SPINNER
// ═══════════════════════════════════════════════════════════════════════════════

const FallbackSpinner: React.FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 200 200" width={size} height={size} className="relative z-10">
    <defs>
      <linearGradient id="spinnerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#5B8DB8" />
        <stop offset="50%" stopColor="#C4935A" />
        <stop offset="100%" stopColor="#6B4380" />
      </linearGradient>
    </defs>
    <g style={{ transformOrigin: '100px 100px', animation: 'spin 2s linear infinite' }}>
      <path
        d="M 100 30 C 145 30, 175 55, 180 100 C 175 145, 145 170, 100 170 C 55 170, 25 145, 20 100 C 25 55, 55 30, 100 30 Z"
        fill="none" stroke="url(#spinnerGradient)" strokeWidth="8" strokeLinecap="round"
      />
    </g>
    <circle cx="100" cy="100" r="35" fill="#1a1a2e"/>
    <polygon points="90,80 90,120 115,100" fill="white" opacity="0.9"/>
    <circle cx="125" cy="75" r="8" fill="white" opacity="0.9"/>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </svg>
);

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
          <LoadingSpinner size="lg" message={message} progress={progress} showProgress={typeof progress === 'number'} />
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
}> = ({ message = 'Chargement...', progress, showWord = true }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary dark:bg-[#0a0a1a]">
      <LoadingSpinner
        size="hero"
        message={message}
        progress={progress}
        showProgress={typeof progress === 'number'}
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
              background: 'linear-gradient(90deg, #4A7BA7, #C4935A, #6B4380)'
            }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-text-tertiary">
          <span>{Math.round(progress)}%</span>
          <span>{progress < 100 ? 'En cours...' : 'Terminé !'}</span>
        </div>
      </div>

      {/* 🆕 Widget "Le Saviez-Vous" */}
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
  className = '',
  showLogo = true,
  label = 'Chargement du contenu...',
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
          style={{ width: `${100 - (i * 12)}%`, animationDelay: `${i * 0.1}s` }}
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
};

export default LoadingSpinner;
