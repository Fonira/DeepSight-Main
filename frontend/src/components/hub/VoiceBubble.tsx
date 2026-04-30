// frontend/src/components/hub/VoiceBubble.tsx
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause } from "lucide-react";
import { VoiceWaveformBars } from "./VoiceWaveformBars";

interface Props {
  durationSecs: number;
  /** Sampled bar heights in px, used by VoiceWaveformBars. */
  bars: number[];
  transcript?: string;
  /** Right side bubble (user PTT) vs left (AI voice). */
  side?: "user" | "ai";
}

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

export const VoiceBubble: React.FC<Props> = ({
  durationSecs,
  bars,
  transcript,
  side = "user",
}) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    startRef.current = performance.now() - progress * durationSecs * 1000;
    const tick = (t: number) => {
      const elapsed = (t - startRef.current) / 1000;
      const p = Math.min(elapsed / durationSecs, 1);
      setProgress(p);
      if (p >= 1) {
        setPlaying(false);
        setProgress(0);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, durationSecs, progress]);

  const cur = playing ? progress * durationSecs : durationSecs;
  const isUser = side === "user";

  const words = transcript ? transcript.split(/\s+/) : [];

  return (
    <div
      className={
        "flex flex-col max-w-[320px] " +
        (isUser ? "self-end items-end" : "self-start items-start")
      }
    >
      <div
        className={
          "flex items-center gap-2.5 px-3 py-2.5 min-w-[220px] border " +
          (isUser
            ? "bg-accent-primary/10 border-accent-primary/20 rounded-[14px_14px_4px_14px]"
            : "bg-white/5 border-white/10 rounded-[14px_14px_14px_4px]")
        }
      >
        <button
          type="button"
          aria-label={playing ? "pause" : "play"}
          onClick={() => setPlaying((p) => !p)}
          className="w-8 h-8 grid place-items-center rounded-full bg-accent-primary text-white"
        >
          {playing ? (
            <Pause className="w-3 h-3" />
          ) : (
            <Play className="w-3 h-3 ml-px" />
          )}
        </button>
        <VoiceWaveformBars bars={bars} progress={progress} playing={playing} />
        <span className="font-mono text-[10px] text-white/55">
          {formatTime(cur)}
        </span>
      </div>

      {transcript && (
        <button
          type="button"
          onClick={() => setShowTranscript((s) => !s)}
          className="mt-1 px-2 text-[11px] text-accent-primary hover:text-accent-primary-hover transition-colors"
        >
          {showTranscript
            ? "↑ masquer le transcript"
            : "↓ afficher le transcript"}
        </button>
      )}

      <AnimatePresence>
        {showTranscript && transcript && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden max-w-full"
          >
            <div
              data-testid="voice-transcript"
              className={
                "mt-1.5 px-3 py-2 rounded-[10px] bg-white/[0.03] border border-white/10 text-[13px] leading-snug " +
                (isUser
                  ? "text-right text-white/65"
                  : "text-left text-white/75")
              }
            >
              {words.map((w, i) => {
                const wp = i / words.length;
                const active =
                  playing &&
                  wp <= progress &&
                  (i + 1) / words.length > progress;
                const past = wp < progress;
                return (
                  <span
                    key={i}
                    className={
                      active
                        ? "text-white font-semibold transition-colors"
                        : past
                          ? "text-accent-primary transition-colors"
                          : "text-white/55"
                    }
                  >
                    {w}{" "}
                  </span>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
