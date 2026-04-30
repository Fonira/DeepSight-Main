// frontend/src/components/hub/VideoPiPPlayer.tsx
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Maximize2, Minimize2, Play } from "lucide-react";

interface Props {
  thumbnailUrl: string | null;
  title: string;
  durationSecs: number;
  expanded: boolean;
  onExpand: () => void;
  onShrink: () => void;
  /** Optional jump-to-timestamp callback (used by SummaryCollapsible). */
  onSeek?: (secs: number) => void;
  /** Imperative seek API exposed via ref pattern is overkill — parent passes seekTo prop via key/state instead. */
  seekTo?: number | null;
}

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

export const VideoPiPPlayer: React.FC<Props> = ({
  thumbnailUrl,
  title,
  durationSecs,
  expanded,
  onExpand,
  onShrink,
}) => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ x: 0, y: 0, mx: 0, my: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    if (expanded) return;
    setDragging(true);
    startRef.current = { x: pos.x, y: pos.y, mx: e.clientX, my: e.clientY };
    e.preventDefault();
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setPos({
        x: startRef.current.x + (e.clientX - startRef.current.mx),
        y: startRef.current.y + (e.clientY - startRef.current.my),
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  if (expanded) {
    return (
      <motion.div
        layoutId="hub-pip"
        data-testid="hub-pip"
        className="absolute inset-4 z-30 rounded-2xl overflow-hidden bg-gradient-to-br from-[#1a1410] to-[#2a1c14] border border-white/15 shadow-2xl"
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 grid place-items-center">
          <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-md grid place-items-center">
            <Play className="w-10 h-10 text-white ml-1" />
          </div>
        </div>
        <button
          type="button"
          aria-label="Réduire"
          onClick={onShrink}
          className="absolute top-3 right-3 w-9 h-9 rounded-[10px] bg-black/55 border border-white/15 backdrop-blur-md text-white grid place-items-center"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
        <div className="absolute bottom-6 left-6 right-6 px-4 py-3 bg-black/50 backdrop-blur-xl rounded-xl border border-white/10">
          <p className="text-sm text-white">{title}</p>
          <p className="font-mono text-[11px] text-white/65 mt-1">
            00:00 / {fmt(durationSecs)}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layoutId="hub-pip"
      data-testid="hub-pip"
      onMouseDown={onMouseDown}
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: dragging
          ? "none"
          : "transform .25s cubic-bezier(.4,0,.2,1)",
      }}
      className={
        "relative w-[112px] h-[64px] rounded-lg overflow-hidden bg-gradient-to-br from-[#1a1410] to-[#2a1c14] border border-white/15 flex-shrink-0 " +
        (dragging ? "cursor-grabbing shadow-2xl" : "cursor-grab shadow-md")
      }
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover opacity-90"
        />
      ) : null}
      <div className="absolute inset-0 grid place-items-center">
        <div className="w-6 h-6 rounded-full bg-black/40 grid place-items-center">
          <Play className="w-3 h-3 text-white ml-px" />
        </div>
      </div>
      <button
        type="button"
        aria-label="Agrandir"
        onClick={(e) => {
          e.stopPropagation();
          onExpand();
        }}
        className="absolute top-1 right-1 w-[18px] h-[18px] rounded bg-black/55 text-white grid place-items-center"
      >
        <Maximize2 className="w-2.5 h-2.5" />
      </button>
      <span className="absolute bottom-0.5 right-1 font-mono text-[8px] text-white/70 bg-black/55 px-1 rounded">
        {fmt(durationSecs)}
      </span>
    </motion.div>
  );
};
