/**
 * VoiceWaveform — Real-time audio waveform visualization
 *
 * Displays animated vertical bars representing audio activity.
 * Supports three modes: idle (minimal movement), user (natural speech),
 * and ai (fluid, dynamic response).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface VoiceWaveformProps {
  /** Qui parle actuellement */
  mode: 'user' | 'ai' | 'idle';
  /** Intensité audio (0 à 1) — peut être simulée si pas de données réelles */
  intensity?: number;
  /** Couleur de l'onde */
  color?: 'indigo' | 'violet' | 'cyan';
  /** Taille */
  size?: 'sm' | 'md' | 'lg';
}

const BAR_COUNT = 20;

const SIZE_CONFIG = {
  sm: { maxHeight: 24, barWidth: 2, gap: 2 },
  md: { maxHeight: 48, barWidth: 3, gap: 3 },
  lg: { maxHeight: 80, barWidth: 4, gap: 4 },
} as const;

const COLOR_MAP = {
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  cyan: 'bg-cyan-500',
} as const;

const MIN_BAR_HEIGHT = 4;

const VoiceWaveformInner: React.FC<VoiceWaveformProps> = ({
  mode,
  intensity = 0.5,
  color = 'indigo',
  size = 'md',
}) => {
  const [barHeights, setBarHeights] = useState<number[]>(() =>
    Array(BAR_COUNT).fill(MIN_BAR_HEIGHT)
  );
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  const clampedIntensity = Math.max(0, Math.min(1, intensity));
  const config = SIZE_CONFIG[size];
  const colorClass = COLOR_MAP[color];

  const computeHeights = useCallback(
    (timestamp: number) => {
      // Throttle updates to ~100ms intervals for performance
      if (timestamp - lastUpdateRef.current < 100) {
        rafRef.current = requestAnimationFrame(computeHeights);
        return;
      }
      lastUpdateRef.current = timestamp;

      setBarHeights((prev) => {
        const next = new Array<number>(BAR_COUNT);

        for (let i = 0; i < BAR_COUNT; i++) {
          if (mode === 'idle') {
            // Subtle minimal movement around the minimum height
            const jitter = Math.random() * 3;
            next[i] = MIN_BAR_HEIGHT + jitter;
          } else if (mode === 'user') {
            // Natural speech: random heights scaled by intensity, with some
            // smoothing from the previous value to avoid harsh jumps
            const target =
              MIN_BAR_HEIGHT +
              Math.random() * (config.maxHeight - MIN_BAR_HEIGHT) * clampedIntensity * 0.7;
            next[i] = prev[i] * 0.3 + target * 0.7;
          } else {
            // AI: fluid sine-based pattern with intensity scaling
            const phase = (timestamp / 300 + i * 0.5) % (Math.PI * 2);
            const sine = (Math.sin(phase) + 1) / 2; // 0-1
            const noise = Math.random() * 0.2;
            const factor = (sine + noise) * clampedIntensity;
            next[i] =
              MIN_BAR_HEIGHT +
              factor * (config.maxHeight - MIN_BAR_HEIGHT) * 0.9;
          }
        }

        return next;
      });

      rafRef.current = requestAnimationFrame(computeHeights);
    },
    [mode, clampedIntensity, config.maxHeight]
  );

  useEffect(() => {
    rafRef.current = requestAnimationFrame(computeHeights);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [computeHeights]);

  return (
    <div
      className="flex items-center justify-center"
      style={{
        height: config.maxHeight,
        gap: config.gap,
      }}
      role="img"
      aria-label={
        mode === 'idle'
          ? 'Audio idle'
          : mode === 'user'
            ? 'User speaking'
            : 'AI speaking'
      }
    >
      {barHeights.map((height, index) => (
        <div
          key={index}
          className={`rounded-full transition-all duration-100 ease-out ${colorClass}`}
          style={{
            width: config.barWidth,
            height: Math.max(MIN_BAR_HEIGHT, Math.round(height)),
          }}
        />
      ))}
    </div>
  );
};

export const VoiceWaveform = React.memo(VoiceWaveformInner);
