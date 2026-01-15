/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  DEEP SIGHT v6.0 — Sound Effects Hook                                         ║
 * ║  Sons corporate doux et professionnels via Web Audio API                      ║
 * ║  🎵 Synthèse audio en temps réel - pas de fichiers externes                   ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { useCallback, useRef, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// 🎵 Types de sons disponibles
// ═══════════════════════════════════════════════════════════════════════════════

export type SoundType = 
  | 'success'      // Analyse terminée, action réussie
  | 'notification' // Nouvelle notification
  | 'click'        // Clic sur bouton
  | 'toggle'       // Toggle switch
  | 'error'        // Erreur
  | 'warning'      // Avertissement
  | 'popup'        // Ouverture modal/popup
  | 'complete'     // Tâche complète (plus élaboré)
  | 'hover'        // Survol (très subtil)
  | 'message';     // Nouveau message chat

// ═══════════════════════════════════════════════════════════════════════════════
// 🎹 Configuration des sons (fréquences et durées)
// ═══════════════════════════════════════════════════════════════════════════════

interface SoundConfig {
  frequencies: number[];      // Notes à jouer (Hz)
  durations: number[];        // Durée de chaque note (ms)
  type: OscillatorType;       // Type d'onde
  volume: number;             // Volume (0-1)
  attack: number;             // Temps d'attaque (ms)
  decay: number;              // Temps de decay (ms)
  delay?: number;             // Délai entre notes (ms)
}

const SOUND_CONFIGS: Record<SoundType, SoundConfig> = {
  // ✅ Succès - Accord majeur ascendant doux
  success: {
    frequencies: [523.25, 659.25, 783.99], // C5, E5, G5
    durations: [100, 100, 200],
    type: 'sine',
    volume: 0.15,
    attack: 10,
    decay: 150,
    delay: 80,
  },
  
  // 🔔 Notification - Deux notes douces
  notification: {
    frequencies: [587.33, 880], // D5, A5
    durations: [120, 180],
    type: 'sine',
    volume: 0.12,
    attack: 15,
    decay: 200,
    delay: 100,
  },
  
  // 👆 Clic - Note courte et subtile
  click: {
    frequencies: [800],
    durations: [30],
    type: 'sine',
    volume: 0.08,
    attack: 5,
    decay: 25,
  },
  
  // 🔘 Toggle - Petite note de confirmation
  toggle: {
    frequencies: [660],
    durations: [50],
    type: 'sine',
    volume: 0.1,
    attack: 5,
    decay: 45,
  },
  
  // ❌ Erreur - Note descendante douce
  error: {
    frequencies: [440, 349.23], // A4, F4
    durations: [100, 200],
    type: 'sine',
    volume: 0.12,
    attack: 10,
    decay: 180,
    delay: 50,
  },
  
  // ⚠️ Avertissement - Deux notes identiques
  warning: {
    frequencies: [493.88, 493.88], // B4, B4
    durations: [80, 120],
    type: 'triangle',
    volume: 0.1,
    attack: 10,
    decay: 100,
    delay: 150,
  },
  
  // 📱 Popup - Note montante douce
  popup: {
    frequencies: [392, 523.25], // G4, C5
    durations: [60, 100],
    type: 'sine',
    volume: 0.08,
    attack: 10,
    decay: 90,
    delay: 30,
  },
  
  // 🎉 Complété - Mélodie de célébration
  complete: {
    frequencies: [523.25, 659.25, 783.99, 1046.5], // C5, E5, G5, C6
    durations: [80, 80, 80, 250],
    type: 'sine',
    volume: 0.12,
    attack: 10,
    decay: 200,
    delay: 60,
  },
  
  // 🖱️ Hover - Ultra subtil
  hover: {
    frequencies: [1200],
    durations: [15],
    type: 'sine',
    volume: 0.03,
    attack: 3,
    decay: 12,
  },
  
  // 💬 Message - Notification chat
  message: {
    frequencies: [698.46, 880], // F5, A5
    durations: [60, 120],
    type: 'sine',
    volume: 0.1,
    attack: 8,
    decay: 100,
    delay: 40,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎧 Hook principal
// ═══════════════════════════════════════════════════════════════════════════════

export function useSounds() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const enabledRef = useRef<boolean>(true);
  
  // Initialiser AudioContext au premier usage (nécessite interaction utilisateur)
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Reprendre si suspendu (politique autoplay des navigateurs)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    return audioContextRef.current;
  }, []);
  
  // Vérifier si les sons sont activés dans les préférences
  useEffect(() => {
    const checkEnabled = () => {
      enabledRef.current = localStorage.getItem('deepsight_sounds') !== 'false';
    };
    
    checkEnabled();
    
    // Écouter les changements de localStorage
    window.addEventListener('storage', checkEnabled);
    
    // Vérifier périodiquement (pour les changements dans le même onglet)
    const interval = setInterval(checkEnabled, 1000);
    
    return () => {
      window.removeEventListener('storage', checkEnabled);
      clearInterval(interval);
    };
  }, []);
  
  // ─────────────────────────────────────────────────────────────────────────────
  // 🎵 Jouer une note
  // ─────────────────────────────────────────────────────────────────────────────
  
  const playNote = useCallback((
    ctx: AudioContext,
    frequency: number,
    duration: number,
    config: SoundConfig,
    startTime: number
  ) => {
    // Oscillateur
    const oscillator = ctx.createOscillator();
    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    
    // Gain (volume) avec envelope ADSR simplifiée
    const gainNode = ctx.createGain();
    const attackEnd = startTime + config.attack / 1000;
    const decayEnd = attackEnd + duration / 1000;
    const releaseEnd = decayEnd + config.decay / 1000;
    
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(config.volume, attackEnd);
    gainNode.gain.setValueAtTime(config.volume, decayEnd);
    gainNode.gain.exponentialRampToValueAtTime(0.001, releaseEnd);
    
    // Connexions
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Jouer
    oscillator.start(startTime);
    oscillator.stop(releaseEnd);
    
    return releaseEnd - startTime;
  }, []);
  
  // ─────────────────────────────────────────────────────────────────────────────
  // 🔊 Jouer un son
  // ─────────────────────────────────────────────────────────────────────────────
  
  const play = useCallback((type: SoundType) => {
    // Vérifier si les sons sont activés
    if (!enabledRef.current) return;
    
    try {
      const ctx = getAudioContext();
      const config = SOUND_CONFIGS[type];
      
      if (!config) {
        console.warn(`[useSounds] Unknown sound type: ${type}`);
        return;
      }
      
      let currentTime = ctx.currentTime;
      
      // Jouer chaque note de la séquence
      config.frequencies.forEach((freq, index) => {
        const duration = config.durations[index] || config.durations[0];
        const noteLength = playNote(ctx, freq, duration, config, currentTime);
        currentTime += (config.delay || 0) / 1000;
      });
    } catch (error) {
      // Silencieux en cas d'erreur (navigateur non supporté, etc.)
      console.debug('[useSounds] Audio playback failed:', error);
    }
  }, [getAudioContext, playNote]);
  
  // ─────────────────────────────────────────────────────────────────────────────
  // 🎛️ Contrôles
  // ─────────────────────────────────────────────────────────────────────────────
  
  const setEnabled = useCallback((enabled: boolean) => {
    enabledRef.current = enabled;
    localStorage.setItem('deepsight_sounds', String(enabled));
  }, []);
  
  const isEnabled = useCallback(() => enabledRef.current, []);
  
  // Test tous les sons (pour la page de paramètres)
  const playDemo = useCallback(async () => {
    const sounds: SoundType[] = ['click', 'toggle', 'notification', 'success', 'complete'];
    for (const sound of sounds) {
      play(sound);
      await new Promise(resolve => setTimeout(resolve, 600));
    }
  }, [play]);
  
  return {
    play,
    setEnabled,
    isEnabled,
    playDemo,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎵 Export des types de sons pour usage externe
// ═══════════════════════════════════════════════════════════════════════════════

export const AVAILABLE_SOUNDS = Object.keys(SOUND_CONFIGS) as SoundType[];

export default useSounds;
