// mobile/src/components/tutor/TutorButton.tsx
//
// Bouton entry-point réutilisable pour ouvrir le Tuteur V2 mobile lite.
// Aligné sur le design system mobile (theme tokens dark first).

import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";

interface TutorButtonProps {
  onPress: () => void;
  disabled?: boolean;
  /** Override du label par défaut (FR). */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export const TutorButton: React.FC<TutorButtonProps> = ({
  onPress,
  disabled = false,
  label = "Approfondir avec le Tuteur",
  style,
}) => {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      testID="tutor-button"
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.glassBg,
          borderColor: colors.borderLight,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <View style={styles.iconWrap}>
        <Ionicons
          name="school-outline"
          size={20}
          color={colors.accentPrimary}
        />
      </View>
      <Text
        style={[styles.label, { color: colors.textPrimary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={colors.textTertiary}
        style={styles.chevron}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: sp.md,
    paddingHorizontal: sp.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: sp.md,
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
  },
  chevron: {
    marginLeft: sp.xs,
  },
});

export default TutorButton;
