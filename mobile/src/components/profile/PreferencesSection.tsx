import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  SimpleBottomSheet,
  type SimpleBottomSheetRef,
} from "@/components/ui/SimpleBottomSheet";
import { storage } from "@/utils/storage";
import { STORAGE_KEYS } from "@/constants/config";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";
import type { ThemeMode } from "@/types";

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "Automatique (système)" },
  { value: "dark", label: "Sombre" },
  { value: "light", label: "Clair" },
];

const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
];

export const PreferencesSection: React.FC = () => {
  const { colors, theme, setTheme } = useTheme();
  const [language, setLanguage] = useState("fr");
  const [activeSheet, setActiveSheet] = useState<"theme" | "language" | null>(
    null,
  );

  const sheetRef = useRef<SimpleBottomSheetRef>(null);

  // Charger la langue depuis AsyncStorage
  useEffect(() => {
    storage.getItem(STORAGE_KEYS.LANGUAGE).then((saved) => {
      if (saved) setLanguage(saved);
    });
  }, []);

  const openSheet = (type: "theme" | "language") => {
    setActiveSheet(type);
    sheetRef.current?.snapToIndex(0);
  };

  const handleThemeSelect = (value: ThemeMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTheme(value);
    sheetRef.current?.close();
  };

  const handleLanguageSelect = async (value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLanguage(value);
    await storage.setItem(STORAGE_KEYS.LANGUAGE, value);
    sheetRef.current?.close();
  };

  const themeLabel =
    THEME_OPTIONS.find((o) => o.value === theme)?.label ?? "Auto";
  const languageLabel =
    LANGUAGE_OPTIONS.find((o) => o.value === language)?.label ?? "Français";

  const renderRow = (label: string, value: string, onPress: () => void) => (
    <Pressable
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
        {label}
      </Text>
      <View style={styles.rowRight}>
        <Text style={[styles.rowValue, { color: colors.textTertiary }]}>
          {value}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Pressable>
  );

  return (
    <>
      <GlassCard style={styles.container}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          Préférences
        </Text>

        {renderRow("Thème", themeLabel, () => openSheet("theme"))}
        {renderRow("Langue", languageLabel, () => openSheet("language"))}
      </GlassCard>

      <SimpleBottomSheet
        ref={sheetRef}
        snapPoint="35%"
        backgroundStyle={{ backgroundColor: colors.bgSecondary }}
        handleIndicatorStyle={{ backgroundColor: colors.textMuted }}
      >
        <View style={styles.sheetContent}>
          <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
            {activeSheet === "theme" ? "Thème" : "Langue"}
          </Text>

          {activeSheet === "theme" &&
            THEME_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.optionRow,
                  { borderBottomColor: colors.border },
                  theme === option.value && {
                    backgroundColor: `${colors.accentPrimary}15`,
                  },
                ]}
                onPress={() => handleThemeSelect(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: theme === option.value }}
              >
                <Text
                  style={[styles.optionLabel, { color: colors.textPrimary }]}
                >
                  {option.label}
                </Text>
                {theme === option.value && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={colors.accentPrimary}
                  />
                )}
              </Pressable>
            ))}

          {activeSheet === "language" &&
            LANGUAGE_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.optionRow,
                  { borderBottomColor: colors.border },
                  language === option.value && {
                    backgroundColor: `${colors.accentPrimary}15`,
                  },
                ]}
                onPress={() => handleLanguageSelect(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: language === option.value }}
              >
                <Text
                  style={[styles.optionLabel, { color: colors.textPrimary }]}
                >
                  {option.label}
                </Text>
                {language === option.value && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={colors.accentPrimary}
                  />
                )}
              </Pressable>
            ))}
        </View>
      </SimpleBottomSheet>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: sp.lg,
  },
  sectionTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    marginBottom: sp.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: sp.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.xs,
  },
  rowLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
  },
  rowHelp: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  toggleLabelWrap: {
    flex: 1,
    paddingRight: sp.md,
  },
  rowValue: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },
  sheetContent: {
    paddingHorizontal: sp.xl,
    paddingBottom: sp["3xl"],
  },
  sheetTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    marginBottom: sp.lg,
    textAlign: "center",
  },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: sp.lg,
    paddingHorizontal: sp.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: borderRadius.md,
  },
  optionLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
  },
});

export default PreferencesSection;
