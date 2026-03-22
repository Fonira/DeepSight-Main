/**
 * TTSToggle — Compact toggle for auto TTS playback
 */

import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useTTSContext } from '../contexts/TTSContext';

interface TTSToggleProps {
  className?: string;
}

export const TTSToggle: React.FC<TTSToggleProps> = ({ className = '' }) => {
  const { autoPlayEnabled, setAutoPlayEnabled } = useTTSContext();

  return (
    <button
      onClick={() => setAutoPlayEnabled(!autoPlayEnabled)}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-all ${
        autoPlayEnabled
          ? 'text-blue-400/80 bg-blue-500/10 border border-blue-500/20'
          : 'text-white/25 hover:text-white/40'
      } ${className}`}
      title={autoPlayEnabled ? 'Disable auto voice' : 'Enable auto voice'}
    >
      {autoPlayEnabled ? (
        <Volume2 className="w-3 h-3" />
      ) : (
        <VolumeX className="w-3 h-3" />
      )}
      <span className="hidden sm:inline">Voix</span>
    </button>
  );
};
