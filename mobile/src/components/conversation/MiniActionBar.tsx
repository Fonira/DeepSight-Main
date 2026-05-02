/**
 * MiniActionBar — 3 actions sticky au-dessus de l'input :
 * - 📊 Analyse complète (CTA principal, indigo) → onViewAnalysis
 * - ⭐ Favori (toggle) → onToggleFavorite
 * - ↗ Partager → onShare
 *
 * Refactor du `miniActionBar` existant de QuickChatScreen.tsx.
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { DeepSightSpinner } from "../ui/DeepSightSpinner";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";
import { palette } from "../../theme/colors";

interface MiniActionBarProps {
  isFavorite: boolean;
  isUpgrading?: boolean;
  canViewAnalysis?: boolean;
  onViewAnalysis: () => void;
  onToggleFavorite: () => void;
  onShare: () => void;
}

export const MiniActionBar: React.FC<MiniActionBarProps> = ({
  isFavorite,
  isUpgrading = false,
  canViewAnalysis = true,
  onViewAnalysis,
  onToggleFavorite,
  onShare,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.bar, { borderTopColor: colors.border }]}>
      <Pressable
        onPress={onToggleFavorite}
        style={styles.miniAction}
        accessibilityLabel="Favori"
        accessibilityRole="button"
      >
        <Ionicons
          name={isFavorite ? "star" : "star-outline"}
          size={18}
          color={isFavorite ? palette.amber : colors.textTertiary}
        />
        <Text style={[styles.miniActionText, { color: colors.textTertiary }]}>
          Favori
        </Text>
      </Pressable>

      <Pressable
        onPress={onViewAnalysis}
        disabled={isUpgrading || !canViewAnalysis}
        style={[
          styles.upgradeAction,
          {
            backgroundColor: palette.indigo + "20",
            borderColor: palette.indigo + "40",
            opacity: !canViewAnalysis ? 0.4 : 1,
          },
        ]}
        accessibilityLabel="Voir l'analyse complète"
        accessibilityRole="button"
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
      </Pressable>

      <Pressable
        onPress={onShare}
        style={styles.miniAction}
        accessibilityLabel="Partager"
        accessibilityRole="button"
      >
        <Ionicons
          name="share-outline"
          size={18}
          color={colors.textTertiary}
        />
        <Text style={[styles.miniActionText, { color: colors.textTertiary }]}>
          Partager
        </Text>
      </Pressable>
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
