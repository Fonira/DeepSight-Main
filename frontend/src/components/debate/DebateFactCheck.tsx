/**
 * DebateFactCheck — Grille de résultats de vérification factuelle
 */

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, ExternalLink } from 'lucide-react';
import type { FactCheckItem } from '../../types/debate';

interface DebateFactCheckProps {
  results: FactCheckItem[];
}

const VERDICT_CONFIG: Record<FactCheckItem['verdict'], {
  label: string;
  icon: React.ElementType;
  className: string;
  bgClassName: string;
}> = {
  confirmed: {
    label: 'Confirmé',
    icon: CheckCircle2,
    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    bgClassName: 'border-emerald-500/15',
  },
  nuanced: {
    label: 'Nuancé',
    icon: AlertTriangle,
    className: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    bgClassName: 'border-amber-500/15',
  },
  disputed: {
    label: 'Contesté',
    icon: XCircle,
    className: 'bg-red-500/15 text-red-400 border-red-500/25',
    bgClassName: 'border-red-500/15',
  },
  unverifiable: {
    label: 'Invérifiable',
    icon: HelpCircle,
    className: 'bg-white/10 text-white/50 border-white/15',
    bgClassName: 'border-white/10',
  },
};

export const DebateFactCheck: React.FC<DebateFactCheckProps> = ({ results }) => {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Vérification factuelle</h3>
          <p className="text-xs text-white/40">
            {results.length} affirmation{results.length > 1 ? 's' : ''} vérifiée{results.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {results.map((item, i) => {
          const verdict = VERDICT_CONFIG[item.verdict] ?? VERDICT_CONFIG.unverifiable;
          const VerdictIcon = verdict.icon;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i, duration: 0.3 }}
              className={`rounded-lg bg-white/[0.03] border ${verdict.bgClassName} p-3.5 space-y-2`}
            >
              {/* Header: verdict badge */}
              <div className="flex items-center justify-end gap-2">
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${verdict.className}`}
                >
                  <VerdictIcon className="w-3 h-3" />
                  {verdict.label}
                </span>
              </div>

              {/* Claim */}
              <p className="text-sm text-white/90 font-medium leading-snug">
                &laquo; {item.claim} &raquo;
              </p>

              {/* Explanation */}
              <p className="text-xs text-white/55 leading-relaxed">
                {item.explanation}
              </p>

              {/* Source */}
              {item.source && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <a
                    href={item.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-cyan-400/70 hover:text-cyan-400 transition-colors"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    Source
                  </a>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
