import React from "react";
import { motion } from "framer-motion";
import { DOODLE_MAP } from "./doodlePaths";

interface DoodleIconProps {
  name: string;
  size?: number;
  color?: string;
  animated?: boolean;
  className?: string;
  strokeWidth?: number;
}

/**
 * DoodleIcon: Render a single SVG doodle by name
 *
 * @param name - Key from DOODLE_MAP (e.g., 'play', 'book', 'sparkles')
 * @param size - SVG size in pixels (default: 24)
 * @param color - Stroke color (default: 'currentColor')
 * @param animated - Add fadeIn + scale animation (default: false)
 * @param strokeWidth - Line thickness (default: 1.5)
 * @param className - Additional CSS classes
 */
const DoodleIcon = React.forwardRef<SVGSVGElement, DoodleIconProps>(
  (
    {
      name,
      size = 24,
      color = "currentColor",
      animated = false,
      className = "",
      strokeWidth = 1.5,
    },
    ref,
  ) => {
    const path = DOODLE_MAP[name];

    if (!path) {
      console.warn(`[DoodleIcon] Unknown doodle name: "${name}"`);
      return null;
    }

    const Component = animated ? motion.svg : "svg";
    const animationProps = animated
      ? {
          initial: { opacity: 0, scale: 0.9 },
          animate: { opacity: 1, scale: 1 },
          transition: { duration: 0.3, ease: "easeOut" },
        }
      : {};

    return (
      <Component
        ref={ref as any}
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`doodle-icon ${className}`}
        {...animationProps}
      >
        <path d={path} />
      </Component>
    );
  },
);

DoodleIcon.displayName = "DoodleIcon";

export default DoodleIcon;
