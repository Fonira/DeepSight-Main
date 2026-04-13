/**
 * AudioSummaryPlayer — Floating audio player for podcast-style summaries
 * v1.0 — Play/pause, progress bar, speed control, download
 *
 * Usage:
 *   <AudioSummaryPlayer
 *     audioUrl="https://r2.../audio.mp3"
 *     title="Titre de la vidéo"
 *     durationEstimate={180}
 *     onClose={() => setShowPlayer(false)}
 *   />
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AudioSummaryPlayerProps {
  audioUrl: string;
  title?: string;
  durationEstimate?: number;
  onClose?: () => void;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const AudioSummaryPlayer: React.FC<AudioSummaryPlayerProps> = ({
  audioUrl,
  title,
  durationEstimate = 0,
  onClose,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationEstimate);
  const [speed, setSpeed] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // ── Audio event handlers ────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onCanPlay = () => {
      setIsLoading(false);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("canplay", onCanPlay);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("canplay", onCanPlay);
    };
  }, [audioUrl]);

  // ── Play / Pause ────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // ── Speed control ───────────────────────────────────────────────────
  const cycleSpeed = useCallback(() => {
    const currentIndex = SPEED_OPTIONS.indexOf(speed);
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    const newSpeed = SPEED_OPTIONS[nextIndex];
    setSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  }, [speed]);

  // ── Seek ────────────────────────────────────────────────────────────
  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current;
      if (!audio || !duration) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = x / rect.width;
      audio.currentTime = ratio * duration;
    },
    [duration],
  );

  // ── Download ────────────────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `deepsight-audio-summary${title ? "-" + title.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "_") : ""}.mp3`;
    a.click();
  }, [audioUrl, title]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-lg"
      >
        <div className="bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
          {/* Hidden audio element */}
          <audio ref={audioRef} src={audioUrl} preload="metadata" />

          {/* Title */}
          {title && (
            <div className="text-xs text-white/50 truncate mb-2 flex items-center gap-2">
              <span className="text-indigo-400">🎧</span>
              <span className="truncate">{title}</span>
            </div>
          )}

          {/* Progress bar */}
          <div
            className="w-full h-1.5 bg-white/10 rounded-full cursor-pointer mb-3 group"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            {/* Time */}
            <span className="text-xs text-white/40 font-mono w-20">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Center controls */}
            <div className="flex items-center gap-3">
              {/* Rewind 15s */}
              <button
                onClick={() => {
                  if (audioRef.current) audioRef.current.currentTime -= 15;
                }}
                className="text-white/50 hover:text-white transition-colors"
                title="-15s"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M1 4v6h6" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  <text
                    x="9"
                    y="16"
                    fontSize="8"
                    fill="currentColor"
                    stroke="none"
                    textAnchor="middle"
                  >
                    15
                  </text>
                </svg>
              </button>

              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                disabled={isLoading}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-indigo-500 hover:bg-indigo-400 disabled:bg-white/10 transition-colors"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isPlaying ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                )}
              </button>

              {/* Forward 15s */}
              <button
                onClick={() => {
                  if (audioRef.current) audioRef.current.currentTime += 15;
                }}
                className="text-white/50 hover:text-white transition-colors"
                title="+15s"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M23 4v6h-6" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  <text
                    x="9"
                    y="16"
                    fontSize="8"
                    fill="currentColor"
                    stroke="none"
                    textAnchor="middle"
                  >
                    15
                  </text>
                </svg>
              </button>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2 w-20 justify-end">
              {/* Speed */}
              <button
                onClick={cycleSpeed}
                className="text-xs font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-colors"
              >
                {speed}x
              </button>

              {/* Download */}
              <button
                onClick={handleDownload}
                className="text-white/40 hover:text-white transition-colors"
                title="Télécharger"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7,10 12,15 17,10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>

              {/* Close */}
              {onClose && (
                <button
                  onClick={() => {
                    audioRef.current?.pause();
                    onClose();
                  }}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AudioSummaryPlayer;
