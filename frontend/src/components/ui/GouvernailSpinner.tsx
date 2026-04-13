import React from "react";
import { motion } from "framer-motion";

interface GouvernailSpinnerProps {
  size?: number;
  color?: string;
  variant?: "spin" | "pulse" | "progress";
  className?: string;
}

/**
 * GouvernailSpinner: Hand-drawn steering wheel spinner
 *
 * Features:
 * - SVG viewBox="0 0 48 48"
 * - 8 radial branches with hand-drawn aesthetic (feTurbulence filter)
 * - Outer circle + inner dot + intermediate ring
 * - 3 animation variants: spin (360° rotation), pulse (scale), progress (strokeDashoffset)
 * - Subtle sketchy effect via SVG displacement filter
 */
const GouvernailSpinner = React.forwardRef<
  SVGSVGElement,
  GouvernailSpinnerProps
>(
  (
    { size = 48, color = "currentColor", variant = "spin", className = "" },
    ref,
  ) => {
    // Animation variants
    const animationConfig = {
      spin: {
        rotateGroup: {
          initial: { rotate: 0 },
          animate: { rotate: 360 },
          transition: { duration: 2, repeat: Infinity, linear: true },
        },
      },
      pulse: {
        scaleGroup: {
          initial: { scale: 1 },
          animate: { scale: [1, 1.05, 1] },
          transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
        },
      },
      progress: {
        strokeGroup: {
          initial: { strokeDashoffset: 100 },
          animate: { strokeDashoffset: [100, 0, 100] },
          transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
        },
      },
    };

    const selectedAnimation =
      variant === "spin"
        ? animationConfig.spin.rotateGroup
        : variant === "pulse"
          ? animationConfig.pulse.scaleGroup
          : animationConfig.progress.strokeGroup;

    return (
      <motion.svg
        ref={ref}
        viewBox="0 0 48 48"
        width={size}
        height={size}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`gouvernail-spinner ${className}`}
        {...selectedAnimation}
      >
        {/* SVG Filter for sketchy/hand-drawn effect */}
        <defs>
          <filter id="sketchy">
            <feTurbulence
              type="turbulence"
              baseFrequency="0.02"
              numOctaves="3"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="0.5"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>

        {/* Outer circle (faint background) */}
        <circle cx="24" cy="24" r="20" opacity="0.3" filter="url(#sketchy)" />

        {/* Intermediate ring */}
        <circle cx="24" cy="24" r="12" opacity="0.2" filter="url(#sketchy)" />

        {/* 8 Radial branches (45° intervals) */}
        {/* Branch 1: top (0°) */}
        <line x1="24" y1="4" x2="24" y2="11" filter="url(#sketchy)" />
        {/* Branch 2: top-right (45°) */}
        <line
          x1="37.25"
          y1="10.75"
          x2="33.2"
          y2="14.8"
          filter="url(#sketchy)"
        />
        {/* Branch 3: right (90°) */}
        <line x1="44" y1="24" x2="37" y2="24" filter="url(#sketchy)" />
        {/* Branch 4: bottom-right (135°) */}
        <line
          x1="37.25"
          y1="37.25"
          x2="33.2"
          y2="33.2"
          filter="url(#sketchy)"
        />
        {/* Branch 5: bottom (180°) */}
        <line x1="24" y1="44" x2="24" y2="37" filter="url(#sketchy)" />
        {/* Branch 6: bottom-left (225°) */}
        <line
          x1="10.75"
          y1="37.25"
          x2="14.8"
          y2="33.2"
          filter="url(#sketchy)"
        />
        {/* Branch 7: left (270°) */}
        <line x1="4" y1="24" x2="11" y2="24" filter="url(#sketchy)" />
        {/* Branch 8: top-left (315°) */}
        <line
          x1="10.75"
          y1="10.75"
          x2="14.8"
          y2="14.8"
          filter="url(#sketchy)"
        />

        {/* Center dot */}
        <circle cx="24" cy="24" r="3" filter="url(#sketchy)" />
      </motion.svg>
    );
  },
);

GouvernailSpinner.displayName = "GouvernailSpinner";

export default GouvernailSpinner;
