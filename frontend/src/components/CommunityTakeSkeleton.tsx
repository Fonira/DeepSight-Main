/**
 * DEEP SIGHT — CommunityTakeSkeleton
 *
 * Placeholder pendant que le pipeline v6 génère le verdict communauté.
 * Non utilisé pour V1 (le take est polled avec le reste du Summary)
 * mais exporté pour les contextes où il pourrait être utile (Hub live).
 */

import React from "react";
import { Users } from "lucide-react";

export const CommunityTakeSkeleton: React.FC = () => (
  <div
    className="rounded-xl bg-white/5 border border-violet-500/15 backdrop-blur-xl p-5 animate-pulse"
    data-testid="community-take-skeleton"
  >
    <div className="flex items-start gap-3 mb-4">
      <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
        <Users className="w-5 h-5 text-violet-400/50" />
      </div>
      <div className="flex-1">
        <div className="h-4 w-40 bg-white/10 rounded mb-2" />
        <div className="h-3 w-28 bg-white/5 rounded" />
      </div>
      <div className="h-6 w-24 rounded-full bg-white/5" />
    </div>
    <div className="space-y-2">
      <div className="h-3 w-full bg-white/5 rounded" />
      <div className="h-3 w-5/6 bg-white/5 rounded" />
      <div className="h-3 w-4/6 bg-white/5 rounded" />
    </div>
  </div>
);

export default CommunityTakeSkeleton;
