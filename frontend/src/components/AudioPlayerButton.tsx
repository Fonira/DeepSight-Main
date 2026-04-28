/**
 * AudioPlayerButton v2 — Inline mini-player with progress, seek, speed
 * ┌──────────────────────────────────────────────────────┐
 * │  ▶️/⏸️  ────────●──── 1:23/2:45  ⏹️  1.5x   │
 * └──────────────────────────────────────────────────────┘
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Play, Pause, Square, Lock } from "lucide-react";
import { DeepSightSpinnerMicro } from "./ui/DeepSightSpinner";
import { useTTSContext } from "../contexts/TTSContext";

interface AudioPlayerButtonProps {
  text: string;
  size?: "sm" | "md";
  className?: string;
}

const SPEED_CYCLE = [1, 1.5, 2, 3];

function formatTime(t: number): string {
  if (!isFinite(t) || isNaN(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const AudioPlayerButtonInner: React.FC<AudioPlayerButtonProps> = ({
  text,
  size = "sm",
  className = "",
}) => {
  const { language, gender, speed: globalSpeed, isPremium } = useTTSContext();

  // Local player state (each bubble has its own player)
  const [localPlaying, setLocalPlaying] = useState(false);
  const [localPaused, setLocalPaused] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [localSpeed, setLocalSpeed] = useState(globalSpeed);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // Sync localSpeed with globalSpeed when not playing
  useEffect(() => {
    if (!localPlaying && !localPaused) {
      setLocalSpeed(globalSpeed);
    }
  }, [globalSpeed, localPlaying, localPaused]);

  // Bug 5: Stop when another AudioPlayerButton starts playing
  useEffect(() => {
    const handler = () => {
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setLocalPlaying(false);
        setLocalPaused(false);
      }
    };
    window.addEventListener("deepsight-stop-all-audio", handler);
    return () =>
      window.removeEventListener("deepsight-stop-all-audio", handler);
  }, []);

  // Bug 2: Revoke blobUrl on cleanup to prevent memory leaks
  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const handleStop = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      controllerRef.current?.abort();
      controllerRef.current = null;
      cleanup();
      setLocalPlaying(false);
      setLocalPaused(false);
      setLocalLoading(false);
      setCurrentTime(0);
      setDuration(0);
    },
    [cleanup],
  );

  const handlePlayPause = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();

      if (!isPremium) return;

      // Pause
      if (localPlaying && !localPaused) {
        audioRef.current?.pause();
        setLocalPaused(true);
        setLocalPlaying(false);
        return;
      }

      // Resume
      if (localPaused && audioRef.current) {
        await audioRef.current.play();
        setLocalPaused(false);
        setLocalPlaying(true);
        return;
      }

      // Bug 5: Stop all other audio players before starting
      window.dispatchEvent(new CustomEvent("deepsight-stop-all-audio"));

      // Bug 1: Abort any in-flight request
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      // Start new playback
      setLocalLoading(true);

      try {
        const { getAccessToken } = await import("../services/api");
        const { API_URL } = await import("../services/api");
        const token = getAccessToken();
        if (!token) throw new Error("Auth required");

        const response = await fetch(`${API_URL}/api/tts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            language,
            gender,
            speed: localSpeed,
            strip_questions: true,
          }),
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        // Bug 4: Handle 403 feature_locked
        if (response.status === 403) {
          const data = await response.json().catch(() => ({}));
          if (
            data?.detail?.error === "feature_locked" ||
            data?.error === "feature_locked"
          ) {
            throw new Error(
              "Fonctionnalité réservée aux abonnés. Passez au plan Étudiant.",
            );
          }
        }

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.detail?.message || `Error ${response.status}`);
        }

        const blob = await response.blob();
        if (blob.size === 0) throw new Error("Empty audio");

        if (controller.signal.aborted) return;

        cleanup();

        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;

        const audio = new Audio(blobUrl);
        audio.playbackRate = localSpeed;
        audioRef.current = audio;

        audio.onloadedmetadata = () => setDuration(audio.duration);
        audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
        audio.onended = () => handleStop();
        audio.onerror = () => handleStop();

        await audio.play();
        setLocalPlaying(true);
        setLocalPaused(false);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("[AudioPlayer]", err);
        cleanup();
      } finally {
        setLocalLoading(false);
      }
    },
    [
      localPlaying,
      localPaused,
      localSpeed,
      isPremium,
      text,
      language,
      gender,
      cleanup,
      handleStop,
    ],
  );

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const bar = progressRef.current;
      const audio = audioRef.current;
      if (!bar || !audio || !duration) return;

      const rect = bar.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      audio.currentTime = pct * duration;
    },
    [duration],
  );

  const handleSpeedCycle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const idx = SPEED_CYCLE.indexOf(localSpeed);
      const next = SPEED_CYCLE[(idx + 1) % SPEED_CYCLE.length];
      setLocalSpeed(next);
      if (audioRef.current) {
        audioRef.current.playbackRate = next;
      }
    },
    [localSpeed],
  );

  // Bug 1: Abort controller on unmount
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      cleanup();
    };
  }, [cleanup]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isActive = localPlaying || localPaused || localLoading;
  const isSm = size === "sm";
  const btnSize = isSm ? "w-7 h-7" : "w-8 h-8";
  const iconSize = isSm ? 14 : 16;

  // Premium lock state
  if (!isPremium) {
    return (
      <button
        className={`
          ${btnSize} rounded-lg flex items-center justify-center
          bg-white/[0.06] text-white/30 border border-white/[0.08]
          cursor-not-allowed relative group
          ${className}
        `}
        title="Disponible à partir du plan Étudiant"
        onClick={(e) => e.stopPropagation()}
      >
        <Lock className="w-3.5 h-3.5" />
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-50">
          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap border border-white/10 shadow-xl">
            <span className="text-indigo-400 font-medium">PRO</span> — Lecture
            vocale disponible dès le plan Étudiant (2.99€/mois)
            <a
              href="/pricing"
              className="block text-indigo-400 hover:text-indigo-300 mt-1 underline"
            >
              Voir les plans →
            </a>
          </div>
        </div>
      </button>
    );
  }

  // Compact play-only button when idle
  if (!isActive) {
    return (
      <button
        onClick={handlePlayPause}
        className={`
          ${btnSize} rounded-lg flex items-center justify-center transition-all duration-200 flex-shrink-0
          bg-white/[0.06] text-white/50 hover:text-cyan-400 hover:bg-cyan-500/15
          border border-white/[0.08] hover:border-cyan-500/30 cursor-pointer
          ${className}
        `}
        title="Écouter"
      >
        <Play
          className={`w-${isSm ? 3.5 : 4} h-${isSm ? 3.5 : 4}`}
          style={{ width: iconSize, height: iconSize }}
        />
      </button>
    );
  }

  // Active mini-player
  return (
    <div
      className={`
        flex items-center gap-2 rounded-lg px-2 py-1.5
        bg-white/[0.06] border border-cyan-500/20
        ${className}
      `}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Play/Pause button */}
      <button
        onClick={handlePlayPause}
        disabled={localLoading}
        className="w-7 h-7 rounded-md flex items-center justify-center bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors flex-shrink-0"
      >
        {localLoading ? (
          <DeepSightSpinnerMicro onLight />
        ) : localPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </button>
      {/* Progress bar */}
      <div
        ref={progressRef}
        onClick={handleSeek}
        className="flex-1 min-w-[60px] h-1.5 bg-white/10 rounded-full cursor-pointer group"
      >
        <div
          className="h-full bg-cyan-400 rounded-full relative transition-[width] duration-100"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-cyan-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
      {/* Time */}
      <span className="text-[10px] text-text-muted font-mono whitespace-nowrap">
        {formatTime(currentTime)}/{formatTime(duration)}
      </span>
      {/* Stop */}
      <button
        onClick={handleStop}
        className="w-6 h-6 rounded flex items-center justify-center text-text-tertiary hover:text-red-400 transition-colors"
        title="Stop"
      >
        <Square className="w-3 h-3" />
      </button>
      {/* Speed */}
      <button
        onClick={handleSpeedCycle}
        className="px-1.5 py-0.5 rounded text-[10px] font-mono text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
        title="Changer la vitesse"
      >
        {localSpeed}x
      </button>
    </div>
  );
};

// Bonus: Memoize to avoid re-renders in chat (20+ bubbles)
export const AudioPlayerButton = React.memo(
  AudioPlayerButtonInner,
  (prev, next) =>
    prev.text === next.text &&
    prev.size === next.size &&
    prev.className === next.className,
);
