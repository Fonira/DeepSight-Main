/**
 * DebateVSLayout — Layout principal du débat : 2 vidéos face à face avec VS au centre
 * Responsive : côte à côte desktop, empilé mobile
 */

import React from "react";
import { motion } from "framer-motion";
import { DebateVideoCard } from "./DebateVideoCard";
import type { DebateAnalysis } from "../../types/debate";

interface DebateVSLayoutProps {
  debate: DebateAnalysis;
}

export const DebateVSLayout: React.FC<DebateVSLayoutProps> = ({ debate }) => {
  return (
    <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 lg:gap-4 items-start">
      {/* Vidéo A — slide in from left */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      >
        <DebateVideoCard
          side="a"
          title={debate.video_a_title ?? "Vidéo A"}
          channel={debate.video_a_channel ?? ""}
          thumbnail={debate.video_a_thumbnail ?? ""}
          videoId={debate.video_a_id}
          platform={debate.platform_a ?? "youtube"}
          thesis={debate.thesis_a ?? ""}
          arguments={debate.arguments_a}
        />
      </motion.div>

      {/* VS Circle */}
      <div className="flex items-center justify-center lg:pt-24">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            delay: 0.3,
            duration: 0.5,
            type: "spring",
            stiffness: 200,
          }}
          className="relative"
        >
          {/* Pulse ring */}
          <motion.div
            className="absolute inset-0 rounded-full bg-white/10"
            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="relative w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-white/10">
            <span className="text-white font-bold text-lg lg:text-xl tracking-tight">
              VS
            </span>
          </div>
        </motion.div>
      </div>

      {/* Vidéo B — slide in from right */}
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      >
        <DebateVideoCard
          side="b"
          title={debate.video_b_title ?? "Vidéo B"}
          channel={debate.video_b_channel ?? ""}
          thumbnail={debate.video_b_thumbnail ?? ""}
          videoId={debate.video_b_id ?? ""}
          platform={debate.platform_b ?? "youtube"}
          thesis={debate.thesis_b ?? ""}
          arguments={debate.arguments_b}
        />
      </motion.div>
    </div>
  );
};
