/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🔊 AUDIO PLAYER — TTS Playback Component                                          ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Features:                                                                          ║
 * ║  - Play/Pause controls with keyboard support                                        ║
 * ║  - Progress bar with seek functionality                                             ║
 * ║  - Playback speed control (0.5x - 2x)                                              ║
 * ║  - Volume control with mute toggle                                                  ║
 * ║  - Accessible with ARIA labels                                                      ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play as PlayIcon,
  Pause as PauseIcon,
  Volume2 as SpeakerWaveIcon,
  VolumeX as SpeakerXMarkIcon,
} from 'lucide-react';

interface AudioPlayerProps {
  /** Audio source URL */
  src: string;
  /** Optional title for accessibility */
  title?: string;
  /** Compact mode for inline use */
  compact?: boolean;
  /** Auto-play when loaded */
  autoPlay?: boolean;
  /** Callback when playback ends */
  onEnded?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
  /** Additional CSS classes */
  className?: string;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  title = 'Audio',
  compact = false,
  autoPlay = false,
  onEnded,
  onError,
  className = '',
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Format time as MM:SS
  const formatTime = useCallback((time: number): string => {
    if (!isFinite(time) || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Play/Pause toggle
  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        audio.pause();
      } else {
        await audio.play();
      }
    } catch (err) {
      console.error('Playback error:', err);
      setError('Failed to play audio');
      onError?.('Failed to play audio');
    }
  }, [isPlaying, onError]);

  // Seek to position
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const progressBar = progressRef.current;
    if (!audio || !progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    if (isFinite(newTime)) {
      audio.currentTime = newTime;
    }
  }, [duration]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Cycle through playback speeds
  const cycleSpeed = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    const newSpeed = PLAYBACK_SPEEDS[nextIndex];
    
    audio.playbackRate = newSpeed;
    setPlaybackSpeed(newSpeed);
  }, [playbackSpeed]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
      if (autoPlay) {
        audio.play().catch(() => {});
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };

    const handleError = () => {
      const errorMsg = 'Failed to load audio';
      setError(errorMsg);
      setIsLoading(false);
      onError?.(errorMsg);
    };

    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [autoPlay, onEnded, onError]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          if (audioRef.current) {
            audioRef.current.currentTime = Math.max(0, currentTime - 10);
          }
          break;
        case 'ArrowRight':
          if (audioRef.current) {
            audioRef.current.currentTime = Math.min(duration, currentTime + 10);
          }
          break;
        case 'KeyM':
          toggleMute();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleMute, currentTime, duration]);

  if (error) {
    return (
      <div className={`flex items-center gap-2 text-red-400 text-sm ${className}`}>
        <span>⚠️ {error}</span>
      </div>
    );
  }

  // Compact mode - just play button
  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <audio ref={audioRef} src={src} preload="metadata" />
        
        <button
          onClick={togglePlay}
          disabled={isLoading}
          className={`
            w-10 h-10 rounded-full flex items-center justify-center
            bg-gradient-to-br from-gold-primary/20 to-gold-highlight/10
            border border-gold-primary/40 hover:border-gold-primary/60
            text-gold-primary hover:text-gold-highlight
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-gold-primary/50
          `}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          title={title}
        >
          {isLoading ? (
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <PauseIcon className="w-5 h-5" />
          ) : (
            <PlayIcon className="w-5 h-5 ml-0.5" />
          )}
        </button>
        
        {!isLoading && (
          <span className="text-xs text-gold-muted font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        )}
      </div>
    );
  }

  // Full player
  return (
    <div
      className={`
        glass-panel p-4 rounded-xl
        border border-gold-primary/20
        bg-gradient-to-br from-deep-bg/80 to-black/40
        backdrop-blur-sm
        ${className}
      `}
      role="region"
      aria-label={`Audio player: ${title}`}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Main controls row */}
      <div className="flex items-center gap-4">
        {/* Play/Pause button */}
        <button
          onClick={togglePlay}
          disabled={isLoading}
          className={`
            w-12 h-12 rounded-full flex items-center justify-center
            bg-gradient-to-br from-gold-primary to-gold-highlight
            text-deep-bg font-bold
            shadow-[0_0_20px_rgba(212,165,116,0.3)]
            hover:shadow-[0_0_30px_rgba(212,165,116,0.5)]
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-gold-primary focus:ring-offset-2 focus:ring-offset-deep-bg
          `}
          aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
        >
          {isLoading ? (
            <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <PauseIcon className="w-6 h-6" />
          ) : (
            <PlayIcon className="w-6 h-6 ml-0.5" />
          )}
        </button>

        {/* Progress section */}
        <div className="flex-1 flex flex-col gap-1">
          {/* Progress bar */}
          <div
            ref={progressRef}
            onClick={handleSeek}
            className="h-2 bg-gold-primary/20 rounded-full cursor-pointer group"
            role="slider"
            aria-label="Audio progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
          >
            <div
              className="h-full bg-gradient-to-r from-gold-primary to-gold-highlight rounded-full relative transition-all"
              style={{ width: `${progress}%` }}
            >
              {/* Seek handle */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-gold-highlight rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
            </div>
          </div>

          {/* Time display */}
          <div className="flex justify-between text-xs text-gold-muted font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Speed control */}
        <button
          onClick={cycleSpeed}
          className={`
            px-2 py-1 rounded-md text-sm font-mono
            bg-gold-primary/10 border border-gold-primary/30
            text-gold-primary hover:text-gold-highlight hover:border-gold-primary/50
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-gold-primary/50
          `}
          aria-label={`Playback speed: ${playbackSpeed}x. Click to change.`}
          title="Click to change speed"
        >
          {playbackSpeed}x
        </button>

        {/* Volume control */}
        <button
          onClick={toggleMute}
          className={`
            w-10 h-10 rounded-lg flex items-center justify-center
            text-gold-primary hover:text-gold-highlight
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-gold-primary/50
          `}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <SpeakerXMarkIcon className="w-5 h-5" />
          ) : (
            <SpeakerWaveIcon className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Keyboard hints */}
      <div className="mt-3 flex gap-4 text-xs text-gold-muted/60">
        <span>Space: Play/Pause</span>
        <span>←/→: Seek 10s</span>
        <span>M: Mute</span>
      </div>
    </div>
  );
};

export default AudioPlayer;
