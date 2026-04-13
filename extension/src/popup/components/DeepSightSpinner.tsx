import React from "react";

type SpinnerSize = "xs" | "sm" | "md" | "lg";

interface DeepSightSpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
  showLabel?: boolean;
  speed?: "slow" | "normal" | "fast";
  showLogos?: boolean;
}

const sizeConfig: Record<SpinnerSize, { container: number; wheel: number }> = {
  xs: { container: 24, wheel: 22 },
  sm: { container: 40, wheel: 36 },
  md: { container: 64, wheel: 58 },
  lg: { container: 96, wheel: 88 },
};

const speedMap: Record<string, number> = {
  slow: 8,
  normal: 5,
  fast: 2,
};

interface PlatformLogo {
  src: string;
  alt: string;
  size: number;
  position: { top?: number; bottom?: number; left?: number; right?: number };
  delay: number;
}

const PLATFORM_LOGOS: PlatformLogo[] = [
  {
    src: "platforms/youtube-icon-red.png",
    alt: "YouTube",
    size: 18,
    position: { top: -8, left: "50%" as unknown as number },
    delay: 0,
  },
  {
    src: "platforms/tiktok-note-white.png",
    alt: "TikTok",
    size: 16,
    position: { top: "50%" as unknown as number, right: -8 },
    delay: 0.5,
  },
  {
    src: "platforms/mistral-logo-white.png",
    alt: "Mistral",
    size: 14,
    position: { bottom: -8, left: "50%" as unknown as number },
    delay: 1,
  },
  {
    src: "platforms/tournesol-logo.png",
    alt: "Tournesol",
    size: 16,
    position: { top: "50%" as unknown as number, left: -8 },
    delay: 1.5,
  },
];

export const DeepSightSpinner: React.FC<DeepSightSpinnerProps> = ({
  size = "md",
  className = "",
  label = "Chargement...",
  showLabel = false,
  speed = "normal",
  showLogos = false,
}) => {
  const { container: containerPx, wheel: wheelPx } = sizeConfig[size];
  const duration = speedMap[speed];
  const showFlames = containerPx >= 36;
  const canShowLogos = showLogos && containerPx >= 64;

  const cosmicUrl = chrome.runtime.getURL("assets/spinner-cosmic.jpg");
  const wheelUrl = chrome.runtime.getURL("assets/spinner-wheel.jpg");

  const outerSize = canShowLogos ? containerPx + 40 : containerPx;

  return (
    <div
      className={`ds-spinner-wrapper ${className}`}
      role="status"
      aria-label={label}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: outerSize,
          height: outerSize,
        }}
      >
        {/* Platform logos orbiting */}
        {canShowLogos &&
          PLATFORM_LOGOS.map((logo, i) => {
            const logoUrl = chrome.runtime.getURL(logo.src);
            const cx = outerSize / 2;
            const cy = outerSize / 2;
            const orbitR = containerPx / 2 + 14;
            const angle = (i * 90 - 90) * (Math.PI / 180);
            const lx = cx + Math.cos(angle) * orbitR - logo.size / 2;
            const ly = cy + Math.sin(angle) * orbitR - logo.size / 2;

            return (
              <img
                key={logo.alt}
                src={logoUrl}
                alt={logo.alt}
                style={{
                  position: "absolute",
                  width: logo.size,
                  height: logo.size,
                  left: lx,
                  top: ly,
                  objectFit: "contain",
                  zIndex: 20,
                  filter: "drop-shadow(0 0 6px rgba(200,144,58,0.4))",
                  animation: `logoPulse 3s ease-in-out ${logo.delay}s infinite`,
                }}
              />
            );
          })}

        {/* Cosmic background with color cycling */}
        {showFlames && (
          <img
            src={cosmicUrl}
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              width: containerPx,
              height: containerPx,
              left: canShowLogos ? 20 : 0,
              top: canShowLogos ? 20 : 0,
              objectFit: "cover",
              maskImage:
                "radial-gradient(circle at center, transparent 0%, transparent 38%, rgba(0,0,0,0.4) 45%, black 52%, black 100%)",
              WebkitMaskImage:
                "radial-gradient(circle at center, transparent 0%, transparent 38%, rgba(0,0,0,0.4) 45%, black 52%, black 100%)",
              zIndex: 1,
              mixBlendMode: "screen",
              borderRadius: "50%",
              animation: "colorCycle 12s ease-in-out infinite",
            }}
          />
        )}

        {/* Spinning wheel / gouvernail */}
        <img
          src={wheelUrl}
          alt=""
          aria-hidden="true"
          style={{
            width: wheelPx,
            height: wheelPx,
            position: "relative",
            zIndex: 10,
            mixBlendMode: "screen",
            opacity: 0.85,
            filter: "brightness(1.2) contrast(1.25) saturate(1.1)",
            animation: `gouvernailSpin ${duration}s linear infinite`,
            willChange: "transform",
          }}
        />
      </div>
      {showLabel && (
        <span
          style={{
            fontSize: 13,
            color: "var(--text-tertiary)",
            animation: "glowPulse 2s ease-in-out infinite",
          }}
        >
          {label}
        </span>
      )}
      <span
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          border: 0,
        }}
      >
        {label}
      </span>
    </div>
  );
};

export default DeepSightSpinner;
