/**
 * tabBarStore — Contrôle global de la visibilité de la TabBar custom.
 *
 * Le `<CustomTabBar>` (rendu via `<Tabs tabBar={...}>` dans `(tabs)/_layout.tsx`)
 * lit `useTabBarStore` pour décider s'il s'affiche. En mode fullscreen analyse,
 * un écran (`analysis/[id].tsx`) appelle `setTabBarHidden(true)` au montage et
 * `setTabBarHidden(false)` au démontage / sortie du fullscreen.
 *
 * NB : on ne peut pas passer par `useNavigation().setOptions({ tabBarStyle })`
 * car notre TabBar custom ne lit pas `descriptors[].options.tabBarStyle`. Un
 * store global Zustand est la voie la plus simple et explicite.
 */

import { create } from "zustand";

export interface TabBarStore {
  hidden: boolean;
  setTabBarHidden: (hidden: boolean) => void;
}

export const useTabBarStore = create<TabBarStore>((set) => ({
  hidden: false,
  setTabBarHidden: (hidden) => set({ hidden }),
}));
