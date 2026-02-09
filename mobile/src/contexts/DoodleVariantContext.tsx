/**
 * DoodleVariantContext — Per-screen doodle variant management
 *
 * Allows each screen to declare its preferred DoodleBackground variant on focus,
 * while keeping a single global DoodleBackground instance in App.tsx for performance.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

export type DoodleVariant = 'default' | 'video' | 'academic' | 'analysis' | 'tech' | 'creative';

interface DoodleVariantContextType {
  variant: DoodleVariant;
  setVariant: (v: DoodleVariant) => void;
}

const DoodleVariantContext = createContext<DoodleVariantContextType>({
  variant: 'default',
  setVariant: () => {},
});

export const DoodleVariantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [variant, setVariant] = useState<DoodleVariant>('default');

  return (
    <DoodleVariantContext.Provider value={{ variant, setVariant }}>
      {children}
    </DoodleVariantContext.Provider>
  );
};

export const useDoodleVariant = () => useContext(DoodleVariantContext);

/**
 * Hook for screens to set their doodle variant on focus.
 * Call once at the top of your screen component:
 *   useScreenDoodleVariant('analysis');
 */
export const useScreenDoodleVariant = (screenVariant: DoodleVariant) => {
  const { setVariant } = useDoodleVariant();
  useFocusEffect(
    useCallback(() => {
      setVariant(screenVariant);
    }, [screenVariant, setVariant])
  );
};
