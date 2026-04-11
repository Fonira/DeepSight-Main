/**
 * CollapsibleSection — Section pliable avec animation framer-motion
 * Utilisé par VoiceSettings pour les 6 sections de configuration.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
  icon: React.ElementType;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  gradient?: boolean;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  icon: Icon,
  title,
  isOpen,
  onToggle,
  children,
  gradient = false,
}) => {
  return (
    <section
      className={`rounded-2xl overflow-hidden ${
        gradient
          ? 'bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/20'
          : 'bg-white/5 border border-white/10'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-6 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-indigo-400" />
          <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-white/40"
        >
          <ChevronDown className="w-5 h-5" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
