import React from "react";
import { motion } from "framer-motion";
import DoodleIcon from "./DoodleIcon";

type DoodleDividerVariant = "default" | "video" | "academic" | "analysis";
type Density = "sparse" | "normal" | "dense";

interface DoodleDividerProps {
  variant?: DoodleDividerVariant;
  density?: Density;
  className?: string;
}

// Noms d'icônes valides dans DOODLE_MAP (cf. doodlePaths.ts). Les anciens
// mappings pointaient vers des noms de catégories ("analytics", "shapes", …)
// qui ne sont PAS des clés de DOODLE_MAP — d'où les warnings
// `[DoodleIcon] Unknown doodle name: "analytics"` répétés en console.
const NAMES_BY_VARIANT: Record<DoodleDividerVariant, readonly string[]> = {
  default: [
    "dot",
    "cross",
    "ring",
    "smallStar",
    "smallTriangle",
    "zigzag",
    "fourSquares",
    "halfCircleArc",
    "squareOutline",
    "parallelDashes",
  ],
  video: [
    "play",
    "pause",
    "camera",
    "tv",
    "playCircle",
    "headphones",
    "waveform",
    "mic",
    "filmstrip",
    "fastForward",
  ],
  academic: [
    "book",
    "graduation",
    "pencil",
    "document",
    "lightbulb",
    "bookmark",
    "flask",
    "quill",
    "clipboard",
    "brain",
  ],
  analysis: [
    "barChart",
    "lineChart",
    "pieChart",
    "trendingUp",
    "activity",
    "target",
    "layers",
    "filter",
    "grid",
    "compass",
  ],
};

/**
 * DoodleDivider: Decorative divider with animated doodles
 *
 * Features:
 * - Flex row with fine lines on sides + icons in center
 * - Variant-based category selection
 * - Density controls icon count
 * - Staggered fadeIn animation on scroll
 * - Random rotation ±15° per icon
 * - 32px height (h-8)
 */
const DoodleDivider: React.FC<DoodleDividerProps> = ({
  variant = "default",
  density = "normal",
  className = "",
}) => {
  // Density controls count: sparse=4, normal=6, dense=8
  const densityMap: Record<Density, number> = {
    sparse: 4,
    normal: 6,
    dense: 8,
  };
  const iconCount = densityMap[density];

  // Pick random valid doodle names from the variant pool.
  const selectedIcons = React.useMemo(() => {
    const pool = NAMES_BY_VARIANT[variant];
    const icons: string[] = [];
    for (let i = 0; i < iconCount; i++) {
      icons.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    return icons;
  }, [iconCount, variant]);

  // Stagger animation: each icon animates in sequence with delay
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 4 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <motion.div
      className={`flex items-center justify-center gap-6 h-8 my-8 ${className}`}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: false, amount: 0.8 }}
    >
      {/* Left divider line */}
      <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[var(--accent-primary)] opacity-15" />

      {/* Center icons */}
      <div className="flex items-center justify-center gap-4">
        {selectedIcons.map((iconName, idx) => {
          const rotation = (Math.random() - 0.5) * 30; // ±15°
          return (
            <motion.div
              key={idx}
              variants={itemVariants}
              style={{
                rotate: `${rotation}deg`,
              }}
            >
              <DoodleIcon
                name={iconName}
                size={18}
                color="var(--accent-primary)"
                className="opacity-30 hover:opacity-50 transition-opacity"
              />
            </motion.div>
          );
        })}
      </div>

      {/* Right divider line */}
      <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[var(--accent-primary)] opacity-15" />
    </motion.div>
  );
};

export default DoodleDivider;
