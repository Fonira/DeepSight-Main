/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  DEEP SIGHT v6.1 — Sound Effects Hook (Bulletproof Version)                   ║
 * ║  Sons corporate doux et professionnels via Web Audio API                      ║
 * ║  🎵 Ne crash JAMAIS - toutes les erreurs sont gérées silencieusement         ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { useCallback, useRef, useEffect, useState, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// 🎵 Types
// ═══════════════════════════════════════════════════════════════════════════════

export type SoundType = 
  | 'success' | 'notification' | 'click' | 'toggle' | 'error' 
  | 'warning' | 'popup' | 'complete' | 'hover' | 'message';

interface SoundConfig {
  frequencies: number[];
  durations: number[];
  type: OscillatorType;
  volume: number;
  attack: number;
  decay: number;
  delay?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎹 Configuration des sons
// ═══════════════════════════════════════════════════════════════════════════════

const SOUND_CONFIGS: Record<SoundType, SoundConfig> = {
  success: { frequencies: [523.25, 659.25, 783.99], durations: [100, 100, 200], type: 'sine', volume: 0.15, attack: 10, decay: 150, delay: 80 },
  notification: { frequencies: [587.33, 880], durations: [120, 180], type: 'sine', volume: 0.12, attack: 15, decay: 200, delay: 100 },
  click: { frequencies: [800], durations: [30], type: 'sine', volume: 0.08, attack: 5, decay: 25 },
  toggle: { frequencies: [660], durations: [50], type: 'sine', volume: 0.1, attack: 5, decay: 45 },
  error: { frequencies: [440, 349.23], durations: [100, 200], type: 'sine', volume: 0.12, attack: 10, decay: 180, delay: 50 },
  warning: { frequencies: [493.88, 493.88], durations: [80, 120], type: 'triangle', volume: 0.1, attack: 10, decay: 100, delay: 150 },
  popup: { frequencies: [392, 523.25], durations: [60, 100], type: 'sine', volume: 0.08, attack: 10, decay: 90, delay: 30 },
  complete: { frequencies: [523.25, 659.25, 783.99, 1046.5], durations: [80, 80, 80, 250], type: 'sine', volume: 0.12, attack: 10, decay: 200, delay: 60 },
  hover: { frequencies: [1200], durations: [15], type: 'sine', volume: 0.03, attack: 3, decay: 12 },
  message: { frequencies: [698.46, 880], durations: [60, 120], type: 'sine', volume: 0.1, attack: 8, decay: 100, delay: 40 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔇 Vérifier le support audio (une seule fois)
// ═══════════════════════════════════════════════════════════════════════════════

const checkAudioSupport = (): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    return !!(window.AudioContext || (window as any).webkitAudioContext);
  } catch {
    return false;
  }
};

const getInitialEnabled = (): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem('deepsight_sounds') !== 'false';
  } catch {
    return true;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎧 Hook principal
// ═══════════════════════════════════════════════════════════════════════════════

export function useSounds() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [enabled, setEnabledState] = useState(getInitialEnabled);
  
  // Vérifier le support une seule fois
  const isSupported = useMemo(() => checkAudioSupport(), []);

  // Écouter les changements de localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkEnabled = () => {
      try {
        const value = localStorage.getItem('deepsight_sounds');
        setEnabledState(value !== 'false');
      } catch {
        // Ignore
      }
    };

    // Écouter les changements d'autres onglets
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'deepsight_sounds') {
        checkEnabled();
      }
    };

    window.addEventListener('storage', handleStorage);
    
    // Check périodique pour le même onglet
    const interval = setInterval(checkEnabled, 3000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  // Obtenir ou créer l'AudioContext
  const getContext = useCallback((): AudioContext | null => {
    if (!isSupported) return null;

    try {
      if (!audioContextRef.current) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (!AC) return null;
        audioContextRef.current = new AC();
      }

      // Reprendre si suspendu (politique autoplay)
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      return ctx;
    } catch {
      return null;
    }
  }, [isSupported]);

  // Jouer un son
  const play = useCallback((type: SoundType) => {
    // Vérifications rapides
    if (!enabled || !isSupported) return;

    try {
      const ctx = getContext();
      if (!ctx) return;

      const config = SOUND_CONFIGS[type];
      if (!config) return;

      let currentTime = ctx.currentTime;

      for (let i = 0; i < config.frequencies.length; i++) {
        const freq = config.frequencies[i];
        const duration = config.durations[i] || config.durations[0];

        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = config.type;
          osc.frequency.setValueAtTime(freq, currentTime);

          const attackEnd = currentTime + config.attack / 1000;
          const decayEnd = attackEnd + duration / 1000;
          const releaseEnd = decayEnd + config.decay / 1000;

          gain.gain.setValueAtTime(0, currentTime);
          gain.gain.linearRampToValueAtTime(config.volume, attackEnd);
          gain.gain.setValueAtTime(config.volume, decayEnd);
          gain.gain.exponentialRampToValueAtTime(0.001, releaseEnd);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(currentTime);
          osc.stop(releaseEnd);
        } catch {
          // Note individuelle échouée, continuer
        }

        currentTime += (config.delay || 0) / 1000;
      }
    } catch {
      // Silencieux
    }
  }, [enabled, isSupported, getContext]);

  // Activer/désactiver
  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    try {
      localStorage.setItem('deepsight_sounds', String(value));
    } catch {
      // Ignore
    }
  }, []);

  // Vérifier si activé
  const isEnabled = useCallback(() => enabled, [enabled]);

  // Démo des sons
  const playDemo = useCallback(async () => {
    if (!enabled || !isSupported) return;

    const sounds: SoundType[] = ['click', 'toggle', 'notification', 'success', 'complete'];
    for (const sound of sounds) {
      play(sound);
      await new Promise(r => setTimeout(r, 600));
    }
  }, [enabled, isSupported, play]);

  // Toujours retourner le même objet shape
  return useMemo(() => ({
    play,
    setEnabled,
    isEnabled,
    playDemo,
  }), [play, setEnabled, isEnabled, playDemo]);
}

export const AVAILABLE_SOUNDS = Object.keys(SOUND_CONFIGS) as SoundType[];
export default useSounds;
