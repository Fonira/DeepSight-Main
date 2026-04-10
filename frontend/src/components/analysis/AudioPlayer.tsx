/**
 * AudioPlayer — Full-featured audio player for analysis audio exports.
 * Fixed bottom bar with play/pause, skip, progress, speed, volume, download.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Volume1,
  VolumeX,
  Download,
  X,
} from 'lucide-react';
import { DeepSightSpinnerSmall } from '../ui/DeepSightSpinner';

interface AudioPlayerProps {
  audioUrl: string;
  title: string;
  onClose: () => void;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioUrl, title, onClose }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [prevVolume, setPrevVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(2); // 1x
  const [isDragging, setIsDragging] = useState(false);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (!isDragging) setCurrentTime(audio.currentTime);
    };
    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };
    const onCanPlay = () => setIsLoading(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };
    const onError = () => {
      setHasError(true);
      setIsLoading(false);
    };
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('playing', onPlaying);
    };
  }, [isDragging]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setHasError(true));
    }
  }, [isPlaying]);

  // Skip
  const skip = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, duration));
  }, [duration]);

  // Speed cycle
  const cycleSpeed = useCallback(() => {
    const nextIndex = (speedIndex + 1) % SPEED_OPTIONS.length;
    setSpeedIndex(nextIndex);
    if (audioRef.current) {
      audioRef.current.playbackRate = SPEED_OPTIONS[nextIndex];
    }
  }, [speedIndex]);

  // Volume
  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (audioRef.current) audioRef.current.volume = newVolume;
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      handleVolumeChange(prevVolume || 0.5);
      setIsMuted(false);
    } else {
      setPrevVolume(volume);
      handleVolumeChange(0);
      setIsMuted(true);
    }
  }, [isMuted, volume, prevVolume, handleVolumeChange]);

  // Progress bar seek
  const seekTo = useCallback((clientX: number) => {
    const bar = progressRef.current;
    const audio = audioRef.current;
    if (!bar || !audio || !duration) return;

    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = ratio * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  const handleProgressMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    seekTo(e.clientX);

    const handleMouseMove = (ev: MouseEvent) => seekTo(ev.clientX);
    const handleMouseUp = (ev: MouseEvent) => {
      setIsDragging(false);
      seekTo(ev.clientX);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [seekTo]);

  const handleProgressTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    seekTo(e.touches[0].clientX);

    const handleTouchMove = (ev: TouchEvent) => {
      ev.preventDefault();
      seekTo(ev.touches[0].clientX);
    };
    const handleTouchEnd = (ev: TouchEvent) => {
      setIsDragging(false);
      if (ev.changedTouches.length > 0) {
        seekTo(ev.changedTouches[0].clientX);
      }
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  }, [seekTo]);

  // Download
  const handleDownload = useCallback(async () => {
    try {
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DeepSight - ${title || 'analyse'}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab
      window.open(audioUrl, '_blank');
    }
  }, [audioUrl, title]);

  // Close handler
  const handleClose = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    onClose();
  }, [onClose]);

  // Retry on error
  const handleRetry = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    if (audioRef.current) {
      audioRef.current.load();
    }
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const currentSpeed = SPEED_OPTIONS[speedIndex];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="fixed bottom-0 left-0 right-0 z-[100] bg-bg-elevated border-t border-border-default shadow-2xl"
      >
        <audio ref={audioRef} src={audioUrl} preload="metadata" />

        {/* Mobile: 2-line layout. Desktop: 1-line */}
        <div className="max-w-screen-xl mx-auto px-3 sm:px-4">
          {/* Progress bar — always full width on top for mobile */}
          <div
            ref={progressRef}
            className="sm:hidden w-full h-2 mt-2 cursor-pointer group"
            onMouseDown={handleProgressMouseDown}
            onTouchStart={handleProgressTouchStart}
          >
            <div className="w-full h-full bg-border-subtle rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-primary rounded-full transition-[width] duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 py-2 sm:py-3">
            {/* Time — mobile */}
            <span className="sm:hidden text-xs text-text-muted tabular-nums w-20 text-center">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Skip back */}
            <button
              onClick={() => skip(-15)}
              className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
              title="-15s"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {/* Play/Pause */}
            <button
              onClick={hasError ? handleRetry : togglePlay}
              className="p-2 rounded-full bg-accent-primary text-white hover:bg-accent-primary-hover transition-colors"
              disabled={isLoading}
            >
              {isLoading || isBuffering ? (
                <DeepSightSpinnerSmall />
              ) : hasError ? (
                <span className="text-xs font-medium px-1">Retry</span>
              ) : isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </button>

            {/* Skip forward */}
            <button
              onClick={() => skip(15)}
              className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
              title="+15s"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            {/* Desktop: progress bar */}
            <div className="hidden sm:flex items-center gap-2 flex-1 min-w-0">
              <span className="text-xs text-text-muted tabular-nums w-10 text-right">
                {formatTime(currentTime)}
              </span>
              <div
                ref={progressRef}
                className="flex-1 h-2 cursor-pointer group"
                onMouseDown={handleProgressMouseDown}
                onTouchStart={handleProgressTouchStart}
              >
                <div className="w-full h-full bg-border-subtle rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-accent-primary rounded-full transition-[width] duration-100"
                    style={{ width: `${progress}%` }}
                  />
                  {/* Thumb */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-accent-primary rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ left: `calc(${progress}% - 6px)` }}
                  />
                </div>
              </div>
              <span className="text-xs text-text-muted tabular-nums w-10">
                {formatTime(duration)}
              </span>
            </div>

            {/* Speed */}
            <button
              onClick={cycleSpeed}
              className="px-2 py-1 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors tabular-nums"
              title="Vitesse de lecture"
            >
              {currentSpeed}x
            </button>

            {/* Volume — desktop only */}
            <div className="hidden sm:flex items-center gap-1 group/vol">
              <button
                onClick={toggleMute}
                className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
              >
                <VolumeIcon className="w-4 h-4" />
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-0 group-hover/vol:w-16 transition-all duration-200 accent-accent-primary h-1"
              />
            </div>

            {/* Download */}
            <button
              onClick={handleDownload}
              className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
              title="Télécharger"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              onClick={handleClose}
              className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
