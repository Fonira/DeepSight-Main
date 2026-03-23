/**
 * DebateStatusTracker — Barre de progression en 5 étapes pour le débat
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Check, Search, BarChart3, Scale, ShieldCheck, Loader2 } from 'lucide-react';
import type { DebateStatus } from '../../types/debate';

interface DebateStatusTrackerProps {
  status: DebateStatus;
}

interface Step {
  key: DebateStatus;
  label: string;
  icon: React.ElementType;
}

const STEPS: Step[] = [
  { key: 'pending', label: 'Analyse A', icon: BarChart3 },
  { key: 'searching', label: 'Recherche opposée', icon: Search },
  { key: 'analyzing_b', label: 'Analyse B', icon: BarChart3 },
  { key: 'comparing', label: 'Comparaison', icon: Scale },
  { key: 'fact_checking', label: 'Fact-check', icon: ShieldCheck },
];

const STATUS_ORDER: DebateStatus[] = [
  'pending',
  'searching',
  'analyzing_b',
  'comparing',
  'fact_checking',
  'completed',
];

function getStepState(
  stepKey: DebateStatus,
  currentStatus: DebateStatus
): 'completed' | 'active' | 'pending' {
  const stepIdx = STATUS_ORDER.indexOf(stepKey);
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);

  if (currentStatus === 'completed') return 'completed';
  if (currentStatus === 'failed') {
    return stepIdx < currentIdx ? 'completed' : stepIdx === currentIdx ? 'active' : 'pending';
  }
  if (stepIdx < currentIdx) return 'completed';
  if (stepIdx === currentIdx) return 'active';
  return 'pending';
}

export const DebateStatusTracker: React.FC<DebateStatusTrackerProps> = ({ status }) => {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Progression du débat</h3>

      <div className="flex items-center gap-2">
        {STEPS.map((step, i) => {
          const state = getStepState(step.key, status);
          const StepIcon = step.icon;

          return (
            <React.Fragment key={step.key}>
              {/* Step dot */}
              <div className="flex flex-col items-center gap-1.5 min-w-0 flex-1">
                <motion.div
                  className={`relative w-9 h-9 rounded-full flex items-center justify-center border transition-colors ${
                    state === 'completed'
                      ? 'bg-emerald-500/20 border-emerald-500/40'
                      : state === 'active'
                        ? 'bg-indigo-500/20 border-indigo-500/40'
                        : 'bg-white/5 border-white/10'
                  }`}
                >
                  {state === 'completed' ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : state === 'active' ? (
                    <>
                      {/* Pulse */}
                      <motion.div
                        className="absolute inset-0 rounded-full bg-indigo-500/20"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                    </>
                  ) : (
                    <StepIcon className="w-4 h-4 text-white/30" />
                  )}
                </motion.div>
                <span
                  className={`text-[10px] text-center leading-tight font-medium ${
                    state === 'completed'
                      ? 'text-emerald-400/80'
                      : state === 'active'
                        ? 'text-indigo-400'
                        : 'text-white/30'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className="flex-shrink-0 h-px w-6 lg:w-10 mt-[-18px]">
                  <div
                    className={`h-full rounded-full transition-colors ${
                      getStepState(STEPS[i + 1].key, status) !== 'pending'
                        ? 'bg-emerald-500/40'
                        : 'bg-white/10'
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
