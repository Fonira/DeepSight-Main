/**
 * TTSToggle — Re-exports TTSToolbar for backward compatibility
 */

import React from 'react';
import { TTSToolbar } from './TTSToolbar';

interface TTSToggleProps {
  onUpgradePress?: () => void;
}

export const TTSToggle: React.FC<TTSToggleProps> = ({ onUpgradePress }) => {
  return <TTSToolbar onUpgradePress={onUpgradePress} />;
};
