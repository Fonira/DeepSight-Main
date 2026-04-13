import React from "react";
import { motion } from "framer-motion";
import DoodleIcon from "./DoodleIcon";
import { DOODLE_CATEGORIES } from "./doodlePaths";

type DoodleDividerVariant = "default" | "video" | "academic" | "analysis";
type Density = "sparse" | "normal" | "dense";

interface DoodleDividerProps {
  variant?: DoodleDividerVariant;
  density?: Density;
  className?: string;
}

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
  // Map variant to icon category
  const categoryMap: Record<
    DoodleDividerVariant,
    keyof typeof DOODLE_CATEGORIES
  > = {
    default: "shapes",
    video: "video",
    academic: "study",
    analysis: "analytics",
  };

  const category = DOODLE_CATEGORIES[categoryMap[variant]];

  // Density controls count: sparse=4, normal=6, dense=8
  const densityMap: Record<Density, number> = {
    sparse: 4,
    normal: 6,
    dense: 8,
  };
  const iconCount = densityMap[density];

  // Pick random icons from category
  const selectedIcons = React.useMemo(() => {
    const icons: string[] = [];
    for (let i = 0; i < iconCount; i++) {
      const randomPath = category[Math.floor(Math.random() * category.length)];
      // Find the name in DOODLE_MAP that corresponds to this path
      const doodleNames = Object.entries(DOODLE_CATEGORIES).flatMap(
        ([, paths]) => paths,
      );

      // For simplicity, pick by index from category
      const pathIndex = category.indexOf(randomPath);
      if (pathIndex !== -1) {
        const categoryName = categoryMap[variant];
        const baseIndex = Object.keys(DOODLE_CATEGORIES).indexOf(categoryName);
        icons.push(`${categoryName}-${pathIndex}`);
      }
    }
    return icons;
  }, [iconCount, variant, category]);

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
                name={iconName.split("-")[0] || "dot"}
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
