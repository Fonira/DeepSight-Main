/**
 * ConversationScreen — Wrapper Modal léger autour de `ConversationContent`.
 *
 * Préserve l'API publique pour les call-sites Modal existants
 * (ex: `analysis/[id].tsx` → Quick Chat + Voice FAB) :
 *   - prop `visible: boolean` contrôle l'ouverture
 *   - prop `onClose: () => void` câblée à `onRequestClose` + transmise à
 *     `ConversationContent` pour le bouton close du header
 *
 * Tout le contenu UI vit maintenant dans `ConversationContent` (réutilisable
 * embedded en tab Hub). Voir `ConversationContent.tsx` pour la logique.
 *
 * Spec : `docs/superpowers/specs/2026-05-04-mobile-hub-tab-unified-design.md` §4.2-4.3
 */

import React from "react";
import { Modal, StatusBar } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useTheme } from "../../contexts/ThemeContext";
import { duration } from "../../theme/animations";
import {
  ConversationContent,
  type ConversationContentProps,
} from "./ConversationContent";

export interface ConversationScreenProps extends Omit<
  ConversationContentProps,
  "onMenuPress" | "onClose"
> {
  /** Si false, le Modal n'est pas visible (parent contrôle). */
  visible: boolean;
  /** Callback close — câblé à `onRequestClose` + bouton close header. */
  onClose: () => void;
}

export const ConversationScreen: React.FC<ConversationScreenProps> = ({
  visible,
  onClose,
  ...contentProps
}) => {
  const { colors } = useTheme();
  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/*
        Edge-to-edge: la Modal `statusBarTranslucent` couvre toute la hauteur
        écran, status bar et home indicator inclus. On déclare son propre
        StatusBar pour conserver les icônes lisibles sur fond bgPrimary.
      */}
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <Animated.View
        entering={FadeIn.duration(duration.slow)}
        style={{ flex: 1, backgroundColor: colors.bgPrimary }}
      >
        <Animated.View
          entering={SlideInDown.duration(duration.slower).springify()}
          style={{ flex: 1 }}
        >
          <ConversationContent {...contentProps} onClose={onClose} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default ConversationScreen;
