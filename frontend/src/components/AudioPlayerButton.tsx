/**
 * AudioPlayerButton — Small TTS toggle button
 * Click to play/stop text-to-speech via ElevenLabs
 */

import React from 'react';
import { Volume2, Loader2, VolumeX } from 'lucide-react';
import { useTTS } from '../hooks/useTTS';

interface AudioPlayerButtonProps {
  text: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const AudioPlayerButton: React.FC<AudioPlayerButtonProps> = ({
  text,
  size = 'sm',
  className = '',
}) => {
  const { isPlaying, isLoading, error, play, stop } = useTTS();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      stop();
    } else {
      play(text);
    }
  };

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const btnSize = size === 'sm'
    ? 'w-7 h-7'
    : 'w-8 h-8';

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      title={error || (isPlaying ? 'Stop' : 'Listen')}
      className={`
        ${btnSize} rounded-lg flex items-center justify-center
        transition-all duration-200 flex-shrink-0
        ${isPlaying
          ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
          : error
            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
            : 'bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.08]'
        }
        ${isLoading ? 'animate-pulse cursor-wait' : 'cursor-pointer'}
        ${className}
      `}
    >
      {isLoading ? (
        <Loader2 className={`${iconSize} animate-spin`} />
      ) : isPlaying ? (
        <VolumeX className={iconSize} />
      ) : (
        <Volume2 className={iconSize} />
      )}
    </button>
  );
};
