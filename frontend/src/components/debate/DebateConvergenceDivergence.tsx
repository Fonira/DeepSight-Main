/**
 * DebateConvergenceDivergence — Points de convergence et divergence entre les 2 vidéos
 */

import React from "react";
import { motion } from "framer-motion";
import { Handshake, Swords } from "lucide-react";
import type { DivergencePoint } from "../../types/debate";

interface DebateConvergenceDivergenceProps {
  convergencePoints: string[];
  divergencePoints: DivergencePoint[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export const DebateConvergenceDivergence: React.FC<
  DebateConvergenceDivergenceProps
> = ({ convergencePoints, divergencePoints }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Convergences */}
      <div className="rounded-xl bg-white/5 border border-emerald-500/20 backdrop-blur-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <Handshake className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Points de convergence
            </h3>
            <p className="text-xs text-white/40">
              Ce sur quoi les deux vidéos s'accordent
            </p>
          </div>
        </div>

        <motion.div
          className="space-y-2"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {convergencePoints.map((point, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              className="flex items-start gap-2.5 rounded-lg bg-emerald-500/[0.05] border border-emerald-500/10 p-3"
            >
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-emerald-400 text-[10px] font-bold">
                  {i + 1}
                </span>
              </div>
              <p className="text-sm text-white/80 leading-relaxed">{point}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Divergences */}
      <div className="rounded-xl bg-white/5 border border-orange-500/20 backdrop-blur-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
            <Swords className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Points de divergence
            </h3>
            <p className="text-xs text-white/40">
              Là où les positions s'opposent
            </p>
          </div>
        </div>

        <motion.div
          className="space-y-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {divergencePoints.map((point, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              className="rounded-lg bg-orange-500/[0.05] border border-orange-500/10 p-3 space-y-2"
            >
              <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
                {point.topic}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="rounded-md bg-indigo-500/[0.06] border border-indigo-500/15 p-2">
                  <span className="text-[10px] font-semibold text-indigo-400 uppercase">
                    Vidéo A
                  </span>
                  <p className="text-xs text-white/70 mt-1 leading-relaxed">
                    {point.position_a}
                  </p>
                </div>
                <div className="rounded-md bg-violet-500/[0.06] border border-violet-500/15 p-2">
                  <span className="text-[10px] font-semibold text-violet-400 uppercase">
                    Vidéo B
                  </span>
                  <p className="text-xs text-white/70 mt-1 leading-relaxed">
                    {point.position_b}
                  </p>
                </div>
              </div>
              {point.fact_check_verdict && (
                <p className="text-[11px] text-white/40 italic">
                  Verdict : {point.fact_check_verdict}
                </p>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};
