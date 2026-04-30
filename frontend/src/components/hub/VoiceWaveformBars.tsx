// frontend/src/components/hub/VoiceWaveformBars.tsx
import React from "react";

interface Props {
  /** Heights in px, sampled. */
  bars: number[];
  /** 0..1 — playback progress. */
  progress: number;
  playing: boolean;
  className?: string;
}

export const VoiceWaveformBars: React.FC<Props> = ({
  bars,
  progress,
  playing,
  className,
}) => {
  return (
    <div
      className={
        "flex-1 flex items-center gap-[2px] " +
        (className ?? "") +
        " h-7"
      }
    >
      {bars.map((h, i) => {
        const played = i / bars.length <= progress;
        const isHead =
          playing && Math.abs(i / bars.length - progress) < 0.04;
        return (
          <i
            key={i}
            data-played={played ? "true" : "false"}
            className={
              "block w-[2px] rounded-[1px] transition-[transform,background] duration-150 " +
              (played ? "bg-indigo-500" : "bg-white/30") +
              (isHead ? " scale-y-125" : "")
            }
            style={{ height: h }}
          />
        );
      })}
    </div>
  );
};
