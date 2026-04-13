/**
 * TTSToggle — Re-exports TTSToolbar for backward compatibility
 * Existing imports of TTSToggle will now use the full TTSToolbar
 */

import React from "react";
import { TTSToolbar } from "./TTSToolbar";

interface TTSToggleProps {
  className?: string;
}

export const TTSToggle: React.FC<TTSToggleProps> = ({ className = "" }) => {
  return <TTSToolbar className={className} />;
};
