/**
 * TTSToolbar — TTS controls in chat toolbar
 * Toggle autoplay, language, gender, speed
 */

import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Lock } from 'lucide-react';
import { useTTSContext } from '../contexts/TTSContext';

interface TTSToolbarProps {
  className?: string;
}

const SPEED_CYCLE = [1, 1.5, 2, 3];

export const TTSToolbar: React.FC<TTSToolbarProps> = ({ className = '' }) => {
  const {
    autoPlayEnabled, setAutoPlayEnabled,
    language, setLanguage,
    gender, setGender,
    speed, setSpeed,
    isPremium,
  } = useTTSContext();

  const [showUpgradeHint, setShowUpgradeHint] = useState(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, []);

  const handleToggleAutoPlay = () => {
    if (!isPremium) {
      setShowUpgradeHint(true);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      hintTimerRef.current = setTimeout(() => setShowUpgradeHint(false), 3000);
      return;
    }
    setAutoPlayEnabled(!autoPlayEnabled);
  };

  const handleSpeedCycle = () => {
    const idx = SPEED_CYCLE.indexOf(speed);
    setSpeed(SPEED_CYCLE[(idx + 1) % SPEED_CYCLE.length]);
  };

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* Auto-play toggle */}
      <div className="relative">
        <button
          onClick={handleToggleAutoPlay}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-all ${
            !isPremium
              ? 'text-white/25 cursor-not-allowed'
              : autoPlayEnabled
                ? 'text-cyan-400/80 bg-cyan-500/10 border border-cyan-500/20'
                : 'text-white/25 hover:text-white/40'
          }`}
          title={
            !isPremium
              ? 'Disponible à partir du plan Étudiant'
              : autoPlayEnabled ? 'Désactiver la lecture auto' : 'Activer la lecture auto'
          }
        >
          {!isPremium ? (
            <Lock className="w-3 h-3" />
          ) : autoPlayEnabled ? (
            <Volume2 className="w-3 h-3" />
          ) : (
            <VolumeX className="w-3 h-3" />
          )}
          <span className="hidden sm:inline">Voix</span>
          {!isPremium && <span className="text-[9px] text-indigo-400 font-medium ml-0.5">PRO</span>}
        </button>

        {/* Upgrade hint popover */}
        {showUpgradeHint && (
          <div className="absolute bottom-full mb-2 left-0 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap border border-white/10 shadow-xl max-w-[250px]">
              La lecture vocale est disponible à partir du plan Étudiant (2.99€/mois)
              <a href="/pricing" className="block text-indigo-400 hover:text-indigo-300 mt-1 underline">
                Voir les plans →
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Only show controls when premium */}
      {isPremium && (
        <>
          {/* Language toggle */}
          <button
            onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
            className="px-1.5 py-1 rounded text-[11px] text-white/40 hover:text-white/60 transition-colors"
            title={`Langue TTS : ${language === 'fr' ? 'Français' : 'English'}`}
          >
            {language === 'fr' ? '🇫🇷' : '🇬🇧'}
          </button>

          {/* Gender toggle */}
          <button
            onClick={() => setGender(gender === 'female' ? 'male' : 'female')}
            className="px-1.5 py-1 rounded text-[11px] text-white/40 hover:text-white/60 transition-colors"
            title={`Voix : ${gender === 'female' ? 'Féminine' : 'Masculine'}`}
          >
            {gender === 'female' ? '♀' : '♂'}
          </button>

          {/* Speed */}
          <button
            onClick={handleSpeedCycle}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono text-white/40 hover:text-white/60 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
            title="Vitesse de lecture"
          >
            {speed}x
          </button>
        </>
      )}
    </div>
  );
};
