/**
 * MiniActionBar — 3 actions sticky au-dessus de l'input :
 * - Favori (toggle filled/outlined) → onToggleFavorite
 * - Analyse complète (CTA principal, indigo) → onViewAnalysis
 * - Partager → onShare
 *
 * Refactor du `miniActionBar` existant de QuickChatScreen.tsx.
 *
 * Polish (mai 2026) :
 * - Press scale 0.95 + spring back sur chaque bouton
 * - Haptics light sur les actions secondaires (Favori, Partager)
 * - Haptics medium sur le CTA principal (Analyse complète)
 * - Loading state visible (DeepSightSpinner) quand isUpgrading
 * - Variant favori filled/outlined avec couleur amber sur filled
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { DeepSightSpinner } from "../ui/DeepSightSpinner";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";
import { palette } from "../../theme/colors";
import { haptics } from "../../utils/haptics";

interface MiniActionBarProps {
  isFavorite: boolean;
  isUpgrading?: boolean;
  canViewAnalysis?: boolean;
  onViewAnalysis: () => void;
  onToggleFavorite: () => void;
  onShare: () => void;
}

// ─── Reusable press-scale wrapper ───
interface PressScaleProps {
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  style?: object;
  children: React.ReactNode;
  testID?: string;
}

const PressScale: React.FC<PressScaleProps> = ({
  onPress,
  disabled,
  accessibilityLabel,
  style,
  children,
  testID,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    if (disabled) return;
    scale.value = withTiming(0.95, { duration: 80 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 240 });
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        testID={testID}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

export const MiniActionBar: React.FC<MiniActionBarProps> = ({
  isFavorite,
  isUpgrading = false,
  canViewAnalysis = true,
  onViewAnalysis,
  onToggleFavorite,
  onShare,
}) => {
  const { colors } = useTheme();

  const handleFavorite = () => {
    haptics.light();
    onToggleFavorite();
  };

  const handleViewAnalysis = () => {
    haptics.medium();
    onViewAnalysis();
  };

  const handleShare = () => {
    haptics.light();
    onShare();
  };

  return (
    <View style={[styles.bar, { borderTopColor: colors.border }]}>
      <PressScale
        onPress={handleFavorite}
        accessibilityLabel="Favori"
        style={styles.miniAction}
        testID="mini-action-favorite"
      >
        <Ionicons
          name={isFavorite ? "star" : "star-outline"}
          size={18}
          color={isFavorite ? palette.amber : colors.textTertiary}
        />
        <Text
          style={[
            styles.miniActionText,
            { color: isFavorite ? palette.amber : colors.textTertiary },
          ]}
        >
          {isFavorite ? "Favori" : "Favori"}
        </Text>
      </PressScale>

      <PressScale
        onPress={handleViewAnalysis}
        disabled={isUpgrading || !canViewAnalysis}
        accessibilityLabel="Voir l'analyse complète"
        testID="mini-action-view-analysis"
        style={[
          styles.upgradeAction,
          {
            backgroundColor: palette.indigo + "20",
            borderColor: palette.indigo + "40",
            opacity: !canViewAnalysis ? 0.4 : 1,
          },
        ]}
      >
        {isUpgrading ? (
          <DeepSightSpinner size="xs" speed="fast" />
        ) : (
          <Ionicons
            name="analytics-outline"
            size={16}
            color={palette.indigo}
          />
        )}
        <Text style={[styles.upgradeActionText, { color: palette.indigo }]}>
          {isUpgrading ? "Lancement..." : "Analyse complète"}
        </Text>
      </PressScale>

      <PressScale
        onPress={handleShare}
        accessibilityLabel="Partager"
        testID="mini-action-share"
        style={styles.miniAction}
      >
        <Ionicons
          name="share-outline"
          size={18}
          color={colors.textTertiary}
        />
        <Text style={[styles.miniActionText, { color: colors.textTertiary }]}>
          Partager
        </Text>
      </PressScale>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: sp.sm,
    borderTopWidth: 1,
  },
  miniAction: {
    alignItems: "center",
    gap: 2,
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs,
  },
  miniActionText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize["2xs"],
  },
  upgradeAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  upgradeActionText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize["2xs"],
  },
});

export default MiniActionBar;
