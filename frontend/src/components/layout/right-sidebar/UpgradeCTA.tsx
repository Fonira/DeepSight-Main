/**
 * UpgradeCTA — Conditional upgrade prompt for free-plan users.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Zap, BarChart3, MessageSquare } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';

interface UpgradeCTAProps {
  plan: string;
}

export const UpgradeCTA: React.FC<UpgradeCTAProps> = ({ plan }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();

  // Only show for free users
  if (plan !== 'free' && plan !== 'discovery') return null;

  const features = language === 'fr'
    ? [
        { icon: Zap, text: '30 analyses/mois' },
        { icon: MessageSquare, text: 'Chat illimité' },
        { icon: BarChart3, text: 'Mind maps & exports' },
      ]
    : [
        { icon: Zap, text: '30 analyses/month' },
        { icon: MessageSquare, text: 'Unlimited chat' },
        { icon: BarChart3, text: 'Mind maps & exports' },
      ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.3 }}
      className="rounded-xl border border-accent-primary/20 bg-gradient-to-br from-accent-primary/[0.06] to-transparent p-3 space-y-2.5"
    >
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-accent-primary" />
        <span className="text-xs font-semibold text-accent-primary">
          {language === 'fr' ? 'Passez à Pro' : 'Go Pro'}
        </span>
      </div>

      {/* Feature highlights */}
      <div className="space-y-1">
        {features.map(({ icon: Icon, text }, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px] text-text-secondary">
            <Icon className="w-3 h-3 text-accent-primary/70 flex-shrink-0" />
            <span>{text}</span>
          </div>
        ))}
      </div>

      {/* CTA button */}
      <button
        onClick={() => navigate('/upgrade')}
        className="w-full py-1.5 rounded-lg bg-accent-primary text-white text-xs font-medium hover:brightness-110 transition-all shadow-sm shadow-accent-primary/20"
      >
        {language === 'fr' ? 'Débloquer' : 'Unlock'} →
      </button>
    </motion.div>
  );
};
