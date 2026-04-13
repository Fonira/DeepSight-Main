import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../contexts/ThemeContext";
import { sp } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";

interface SectionHeaderProps {
  /** Section title */
  title: string;
  /** Optional icon before the title */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Optional icon color (defaults to accentPrimary) */
  iconColor?: string;
  /** "Voir tout" or similar action text */
  actionText?: string;
  /** Action callback */
  onAction?: () => void;
  /** Visual variant */
  variant?: "default" | "uppercase" | "large";
  /** Additional style */
  style?: object;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  icon,
  iconColor,
  actionText,
  onAction,
  variant = "default",
  style,
}) => {
  const { colors } = useTheme();

  const titleStyle = [
    variant === "uppercase"
      ? styles.titleUppercase
      : variant === "large"
        ? styles.titleLarge
        : styles.titleDefault,
    {
      color: variant === "uppercase" ? colors.textMuted : colors.textPrimary,
    },
  ];

  return (
    <View style={[styles.container, style]}>
      <View style={styles.leftRow}>
        {icon && (
          <Ionicons
            name={icon}
            size={variant === "large" ? 20 : 18}
            color={iconColor || colors.accentPrimary}
            style={styles.icon}
          />
        )}
        <Text style={titleStyle}>{title}</Text>
      </View>
      {actionText && onAction && (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onAction();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.actionButton}
        >
          <Text style={[styles.actionText, { color: colors.accentPrimary }]}>
            {actionText}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={colors.accentPrimary}
          />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: sp.md,
  },
  leftRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  icon: {
    marginRight: sp.xs,
  },
  titleDefault: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bodySemiBold,
  },
  titleUppercase: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bodySemiBold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  titleLarge: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.bodySemiBold,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: 44,
    paddingLeft: sp.sm,
  },
  actionText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bodyMedium,
  },
});

export default SectionHeader;
