/**
 * HubNavBadge — petit dot rouge à poser sur le NavItem Hub de la sidebar
 * quand une analyse vient de terminer (et l'user n'est pas sur /hub) ou
 * quand une analyse est en échec.
 *
 * À monter à l'intérieur d'un wrapper `relative`.
 */

import React from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useBackgroundAnalysis } from "../../contexts/BackgroundAnalysisContext";

export const HubNavBadge: React.FC = () => {
  const { tasks, hasNewCompletedTask } = useBackgroundAnalysis();
  const location = useLocation();
  const isOnHub = location.pathname.startsWith("/hub");
  const hasFailed = tasks.some((t) => t.status === "failed");

  const visible = (hasNewCompletedTask && !isOnHub) || hasFailed;
  if (!visible) return null;

  const color = hasFailed ? "bg-red-500" : "bg-emerald-400";

  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 18 }}
      aria-hidden="true"
      className={`absolute top-1 right-1 w-2 h-2 rounded-full ${color} ring-2 ring-bg-base`}
    />
  );
};

export default HubNavBadge;
