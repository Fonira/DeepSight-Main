/**
 * Right Sidebar Store — Zustand State Management
 * Persists sidebar open/close preference to localStorage.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface RightSidebarState {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

export const useRightSidebarStore = create<RightSidebarState>()(
  persist(
    (set) => ({
      isOpen: true,
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    {
      name: 'deepsight-right-sidebar',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
