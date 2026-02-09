/**
 * DEEP SIGHT v8.0 — Motion Components
 * Reusable Framer Motion animation wrappers.
 */

import { motion, AnimatePresence, type Variants, type HTMLMotionProps } from 'framer-motion';
import React from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION PRESETS
// ═══════════════════════════════════════════════════════════════════════════════

export const easings = {
  smooth: [0.4, 0, 0.2, 1] as const,
  spring: [0.34, 1.56, 0.64, 1] as const,
  decelerate: [0, 0, 0.2, 1] as const,
  accelerate: [0.4, 0, 1, 1] as const,
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: easings.smooth },
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.3, ease: easings.smooth },
  },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: easings.spring },
  },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.15 } },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: easings.smooth },
  },
  exit: { opacity: 0, x: -12, transition: { duration: 0.2 } },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: easings.smooth },
  },
  exit: { opacity: 0, x: 12, transition: { duration: 0.2 } },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: easings.smooth },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MOTION COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface MotionProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

/** Fade-in-up animation wrapper */
export const FadeInUp: React.FC<MotionProps> = ({ children, delay = 0, ...props }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: easings.smooth, delay }}
    {...props}
  >
    {children}
  </motion.div>
);

/** Fade-in animation wrapper */
export const FadeIn: React.FC<MotionProps> = ({ children, delay = 0, ...props }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.3, ease: easings.smooth, delay }}
    {...props}
  >
    {children}
  </motion.div>
);

/** Scale-in animation wrapper */
export const ScaleIn: React.FC<MotionProps> = ({ children, delay = 0, ...props }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.3, ease: easings.spring, delay }}
    {...props}
  >
    {children}
  </motion.div>
);

/** Stagger container — use with staggerItem variant on children */
export const StaggerContainer: React.FC<MotionProps> = ({ children, delay = 0, ...props }) => (
  <motion.div
    variants={staggerContainer}
    initial="hidden"
    animate="visible"
    transition={{ delayChildren: delay }}
    {...props}
  >
    {children}
  </motion.div>
);

/** Stagger item — use inside StaggerContainer */
export const StaggerItem: React.FC<MotionProps> = ({ children, ...props }) => (
  <motion.div variants={staggerItem} {...props}>
    {children}
  </motion.div>
);

/** Page transition wrapper */
export const PageTransition: React.FC<MotionProps> = ({ children, ...props }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -4 }}
    transition={{ duration: 0.3, ease: easings.smooth }}
    {...props}
  >
    {children}
  </motion.div>
);

/** Hover card effect — lifts on hover with glow */
export const HoverCard: React.FC<MotionProps> = ({ children, className, ...props }) => (
  <motion.div
    className={className}
    whileHover={{ y: -2, transition: { duration: 0.2 } }}
    whileTap={{ scale: 0.99 }}
    {...props}
  >
    {children}
  </motion.div>
);

/** Animated number display */
export const AnimatedNumber: React.FC<{ value: number; className?: string }> = ({ value, className }) => (
  <motion.span
    key={value}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className={className}
  >
    {value.toLocaleString()}
  </motion.span>
);

// Re-export framer-motion essentials
export { motion, AnimatePresence };
export type { Variants };
