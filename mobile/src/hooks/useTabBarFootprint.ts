/**
 * useTabBarFootprint — Hauteur effective réservée par la TabBar globale
 * (CustomTabBar) au bas de chaque écran tabbed.
 *
 * Calcul : TAB_BAR_HEIGHT (56) + safe-area bottom + un peu de marge (`sp.md`).
 *
 * À utiliser comme `paddingBottom` du `ScrollView`/`FlatList` racine d'un
 * écran de l'onglet `(tabs)/...` pour que le dernier élément de la liste
 * ne soit jamais caché derrière la barre.
 *
 * En mode fullscreen (TabBar cachée via `tabBarStore`), n'appelle pas ce
 * hook : utilise simplement `insets.bottom`.
 */

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_HEIGHT } from "../components/navigation/CustomTabBar";
import { sp } from "../theme/spacing";

export function useTabBarFootprint(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, sp.sm) + sp.md;
}
