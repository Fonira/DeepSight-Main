// frontend/src/components/hub/SourcesShelf.tsx
import React from "react";

interface Props {
  /** Compact = mobile/extension (smaller logos & padding). */
  compact?: boolean;
  label?: string;
  className?: string;
}

const SOURCES: Array<{
  src: string;
  alt: string;
  rounded?: boolean;
  widthBoost?: number;
}> = [
  { src: "/platforms/youtube-icon-red.svg", alt: "YouTube" },
  { src: "/platforms/tiktok-note-color.svg", alt: "TikTok", rounded: true },
  {
    src: "/platforms/tournesol-icon.svg",
    alt: "Tournesol",
    rounded: true,
  },
  { src: "/mistral-logo.svg", alt: "Mistral", widthBoost: 4 },
];

export const SourcesShelf: React.FC<Props> = ({
  compact,
  label = "Plateformes supportées",
  className,
}) => {
  const sz = compact ? 14 : 16;
  const gap = compact ? "gap-2" : "gap-2.5";
  const pad = compact ? "px-2.5 py-1.5" : "px-3 py-2";
  return (
    <div
      className={
        "inline-flex items-center rounded-full bg-white/[0.03] border border-white/10 " +
        gap +
        " " +
        pad +
        " " +
        (className ?? "")
      }
    >
      <span
        className="font-mono uppercase tracking-[.14em] text-white/45"
        style={{ fontSize: 9 }}
      >
        {label}
      </span>
      {SOURCES.map((s) => (
        <img
          key={s.alt}
          src={s.src}
          alt={s.alt}
          width={sz + (s.widthBoost ?? 0)}
          height={sz}
          className={s.rounded ? "rounded-[3px] opacity-90" : "opacity-90"}
          style={{ width: sz + (s.widthBoost ?? 0), height: sz }}
        />
      ))}
    </div>
  );
};
