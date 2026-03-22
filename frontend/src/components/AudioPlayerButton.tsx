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

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const btnSize = size === 'sm'
    ? 'w-8 h-8'
    : 'w-9 h-9';

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
            : 'bg-white/[0.06] text-white/50 hover:text-cyan-400 hover:bg-cyan-500/15 border border-white/[0.08] hover:border-cyan-500/30'
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
