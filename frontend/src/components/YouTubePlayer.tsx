/**
 * 🎬 YOUTUBE PLAYER v2.0 — Player intégré dans la zone thumbnail
 * ═══════════════════════════════════════════════════════════════════════════════
 * Version INLINE (pas flottant) - remplace la thumbnail quand actif
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { Play, Pause, X, ExternalLink, Volume2, VolumeX, RotateCcw } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface YouTubePlayerRef {
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  isPlaying: () => boolean;
  getCurrentTime: () => number;
}

interface YouTubePlayerProps {
  videoId: string;
  initialTime?: number;
  onClose?: () => void;
  onTimeUpdate?: (time: number) => void;
  className?: string;
}

// Déclaration globale pour l'API YouTube
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎬 YOUTUBE PLAYER COMPONENT (INLINE VERSION)
// ═══════════════════════════════════════════════════════════════════════════════

export const YouTubePlayer = forwardRef<YouTubePlayerRef, YouTubePlayerProps>(
  ({ videoId, initialTime = 0, onClose, onTimeUpdate, className = "" }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);
    const playerDivId = useRef(`yt-player-${videoId}-${Date.now()}`);
    const [isReady, setIsReady] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const timeUpdateInterval = useRef<NodeJS.Timeout | null>(null);

    // ═══════════════════════════════════════════════════════════════════════════
    // 🔧 YOUTUBE API SETUP
    // ═══════════════════════════════════════════════════════════════════════════

    const initPlayer = useCallback(() => {
      if (!containerRef.current || playerRef.current) return;

      // Créer un div pour le player
      const playerDiv = document.createElement("div");
      playerDiv.id = playerDivId.current;
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(playerDiv);

      playerRef.current = new window.YT.Player(playerDivId.current, {
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          start: Math.floor(initialTime),
          modestbranding: 1,
          rel: 0,
          enablejsapi: 1,
          origin: window.location.origin,
          playsinline: 1,
        },
        events: {
          onReady: (event: any) => {
            setIsReady(true);
            setDuration(event.target.getDuration());
            setIsPlaying(true);
            
            // Start time update interval
            timeUpdateInterval.current = setInterval(() => {
              if (playerRef.current && playerRef.current.getCurrentTime) {
                const time = playerRef.current.getCurrentTime();
                setCurrentTime(time);
                onTimeUpdate?.(time);
              }
            }, 500);
          },
          onStateChange: (event: any) => {
            setIsPlaying(event.data === window.YT.PlayerState.PLAYING);
          },
        },
      });
    }, [videoId, initialTime, onTimeUpdate]);

    useEffect(() => {
      // Charger l'API YouTube si pas déjà chargée
      if (!window.YT) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = initPlayer;
      } else if (window.YT.Player) {
        initPlayer();
      }

      return () => {
        if (timeUpdateInterval.current) {
          clearInterval(timeUpdateInterval.current);
        }
        if (playerRef.current) {
          try {
            playerRef.current.destroy();
          } catch (e) {
            // Player already destroyed
          }
          playerRef.current = null;
        }
      };
    }, [initPlayer]);

    // ═══════════════════════════════════════════════════════════════════════════
    // 🎮 PLAYER CONTROLS
    // ═══════════════════════════════════════════════════════════════════════════

    const seekTo = useCallback((seconds: number) => {
      if (playerRef.current && isReady) {
        playerRef.current.seekTo(seconds, true);
        setCurrentTime(seconds);
        if (!isPlaying) {
          playerRef.current.playVideo();
        }
      }
    }, [isReady, isPlaying]);

    const play = useCallback(() => {
      if (playerRef.current && isReady) {
        playerRef.current.playVideo();
      }
    }, [isReady]);

    const pause = useCallback(() => {
      if (playerRef.current && isReady) {
        playerRef.current.pauseVideo();
      }
    }, [isReady]);

    const toggleMute = useCallback(() => {
      if (playerRef.current && isReady) {
        if (isMuted) {
          playerRef.current.unMute();
        } else {
          playerRef.current.mute();
        }
        setIsMuted(!isMuted);
      }
    }, [isReady, isMuted]);

    const restart = useCallback(() => {
      seekTo(0);
    }, [seekTo]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      seekTo,
      play,
      pause,
      isPlaying: () => isPlaying,
      getCurrentTime: () => currentTime,
    }), [seekTo, play, pause, isPlaying, currentTime]);

    // ═══════════════════════════════════════════════════════════════════════════
    // 🔧 HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    const formatTime = (seconds: number): string => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      
      if (h > 0) {
        return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
      }
      return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    // ═══════════════════════════════════════════════════════════════════════════
    // 🎨 RENDER
    // ═══════════════════════════════════════════════════════════════════════════

    return (
      <div className={`relative w-full h-full ${className}`}>
        {/* Player Container - Takes full space */}
        <div 
          ref={containerRef}
          className="absolute inset-0 bg-black"
        />

        {/* Overlay Controls */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Top bar with close button */}
          <div 
            className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start pointer-events-auto"
            style={{
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-medium text-white/80">En lecture</span>
            </div>
            
            <div className="flex items-center gap-1">
              <a
                href={`https://youtube.com/watch?v=${videoId}&t=${Math.floor(currentTime)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-black/30 hover:bg-black/50 text-white/70 hover:text-white transition-all"
                title="Ouvrir sur YouTube"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-black/30 hover:bg-red-500/50 text-white/70 hover:text-white transition-all"
                title="Fermer le player"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bottom bar with controls */}
          <div 
            className="absolute bottom-0 left-0 right-0 p-3 pointer-events-auto"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
            }}
          >
            {/* Progress bar */}
            <div 
              className="h-1 rounded-full overflow-hidden mb-3 cursor-pointer group"
              style={{ background: "rgba(255,255,255,0.2)" }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                seekTo(percent * duration);
              }}
            >
              <div 
                className="h-full rounded-full transition-all"
                style={{ 
                  width: `${progressPercent}%`,
                  background: "linear-gradient(90deg, #00ffff 0%, #d4a853 100%)",
                }}
              />
            </div>
            
            {/* Controls row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Play/Pause */}
                <button
                  onClick={() => isPlaying ? pause() : play()}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </button>

                {/* Restart */}
                <button
                  onClick={restart}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
                  title="Recommencer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                {/* Mute */}
                <button
                  onClick={toggleMute}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                {/* Time */}
                <span className="text-xs font-mono text-white/80 ml-2">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {/* Timecode indicator */}
              <div 
                className="px-3 py-1 rounded-full text-xs font-mono"
                style={{
                  background: 'rgba(0, 255, 255, 0.2)',
                  color: '#00ffff',
                  border: '1px solid rgba(0, 255, 255, 0.4)',
                }}
              >
                ⏱️ {formatTime(currentTime)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

YouTubePlayer.displayName = "YouTubePlayer";

export default YouTubePlayer;
