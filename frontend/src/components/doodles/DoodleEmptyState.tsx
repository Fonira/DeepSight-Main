import React from "react";
import { motion } from "framer-motion";
import DoodleIcon from "./DoodleIcon";

type EmptyStateType =
  | "no-analyses"
  | "no-flashcards"
  | "no-playlists"
  | "no-results"
  | "welcome";

interface DoodleEmptyStateProps {
  type: EmptyStateType;
  children?: React.ReactNode;
  className?: string;
}

/**
 * DoodleEmptyState: Empty state UI with animated doodles
 *
 * Features:
 * - Large main icon (72px) with idle floating animation
 * - 3-4 small accent icons rotating around main icon
 * - Type-specific icon configuration
 * - Children rendered below (for text content)
 */
const DoodleEmptyState: React.FC<DoodleEmptyStateProps> = ({
  type,
  children,
  className = "",
}) => {
  // Configuration: main icon + small accent icons
  const configMap: Record<
    EmptyStateType,
    {
      main: string;
      accents: string[];
    }
  > = {
    "no-analyses": {
      main: "play",
      accents: ["sparkles", "eye", "barChart"],
    },
    "no-flashcards": {
      main: "book",
      accents: ["brain", "pencil", "star"],
    },
    "no-playlists": {
      main: "layers",
      accents: ["play", "music", "grid"],
    },
    "no-results": {
      main: "search",
      accents: ["eye", "target", "compass"],
    },
    welcome: {
      main: "compass",
      accents: ["sparkles", "star", "paperPlane"],
    },
  };

  const config = configMap[type];

  // Main icon floating animation
  const mainVariants = {
    initial: { y: 0, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    float: {
      y: [-6, 0, -6],
      transition: { duration: 3, repeat: Infinity, ease: "easeInOut" as const },
    },
  };

  // Small accent icon rotating around main icon
  const accentVariants = {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
  };

  return (
    <motion.div
      className={`flex flex-col items-center justify-center p-8 ${className}`}
      initial="initial"
      animate="animate"
    >
      {/* Main icon container (relative for absolute positioning of accents) */}
      <motion.div
        className="relative w-32 h-32 flex items-center justify-center mb-8"
        variants={mainVariants}
        animate={["animate", "float"]}
      >
        {/* Primary icon */}
        <DoodleIcon
          name={config.main}
          size={72}
          color="var(--accent-primary)"
          animated={true}
        />

        {/* Rotating accent icons (4 positions: top-right, bottom-right, bottom-left, top-left) */}
        {config.accents.map((accentName, idx) => {
          const angle = (idx * 360) / config.accents.length;
          const radius = 60; // Distance from center
          const x = Math.cos((angle * Math.PI) / 180) * radius;
          const y = Math.sin((angle * Math.PI) / 180) * radius;

          return (
            <motion.div
              key={idx}
              className="absolute"
              variants={accentVariants}
              style={{
                left: `50%`,
                top: `50%`,
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              }}
              animate={{
                rotate: 360,
                transition: {
                  duration: 20,
                  repeat: Infinity,
                  ease: "linear" as const,
                },
              }}
            >
              <DoodleIcon
                name={accentName}
                size={20}
                color="var(--accent-primary)"
                className="opacity-40"
              />
            </motion.div>
          );
        })}
      </motion.div>

      {/* Children content (typically title + description) */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="text-center"
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

export default DoodleEmptyState;
