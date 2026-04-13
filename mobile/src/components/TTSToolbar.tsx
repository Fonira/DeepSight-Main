/**
 * TTSToolbar — Mobile TTS controls (autoplay toggle, language, gender, speed)
 */

import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTTSContext } from "../contexts/TTSContext";
import { useTheme } from "../contexts/ThemeContext";
import { Spacing, Typography, BorderRadius } from "../constants/theme";

const SPEED_CYCLE = [1, 1.5, 2, 3];

interface TTSToolbarProps {
  onUpgradePress?: () => void;
}

export const TTSToolbar: React.FC<TTSToolbarProps> = ({ onUpgradePress }) => {
  const { colors } = useTheme();
  const {
    autoPlayEnabled,
    setAutoPlayEnabled,
    language,
    setLanguage,
    gender,
    setGender,
    speed,
    setSpeed,
    isPremium,
  } = useTTSContext();

  const handleToggleAutoPlay = () => {
    if (!isPremium) {
      onUpgradePress?.();
      return;
    }
    setAutoPlayEnabled(!autoPlayEnabled);
  };

  const handleSpeedCycle = () => {
    const idx = SPEED_CYCLE.indexOf(speed);
    setSpeed(SPEED_CYCLE[(idx + 1) % SPEED_CYCLE.length]);
  };

  return (
    <View style={styles.container}>
      {/* Auto-play toggle */}
      <TouchableOpacity
        onPress={handleToggleAutoPlay}
        style={[
          styles.button,
          {
            backgroundColor: !isPremium
              ? "transparent"
              : autoPlayEnabled
                ? colors.accentPrimary + "15"
                : "transparent",
            borderColor:
              autoPlayEnabled && isPremium
                ? colors.accentPrimary + "30"
                : "transparent",
            borderWidth: autoPlayEnabled && isPremium ? 1 : 0,
          },
        ]}
      >
        <Ionicons
          name={
            !isPremium
              ? "lock-closed"
              : autoPlayEnabled
                ? "volume-high"
                : "volume-mute"
          }
          size={14}
          color={
            autoPlayEnabled && isPremium
              ? colors.accentPrimary
              : colors.textTertiary
          }
        />
        <Text
          style={[
            styles.label,
            {
              color:
                autoPlayEnabled && isPremium
                  ? colors.accentPrimary
                  : colors.textTertiary,
            },
          ]}
        >
          Voix
        </Text>
        {!isPremium && (
          <Text style={[styles.proBadge, { color: colors.accentPrimary }]}>
            PRO
          </Text>
        )}
      </TouchableOpacity>

      {isPremium && (
        <>
          {/* Language toggle */}
          <TouchableOpacity
            onPress={() => setLanguage(language === "fr" ? "en" : "fr")}
            style={styles.smallButton}
          >
            <Text style={styles.flag}>{language === "fr" ? "🇫🇷" : "🇬🇧"}</Text>
          </TouchableOpacity>

          {/* Gender toggle */}
          <TouchableOpacity
            onPress={() => setGender(gender === "female" ? "male" : "female")}
            style={styles.smallButton}
          >
            <Text style={[styles.genderText, { color: colors.textTertiary }]}>
              {gender === "female" ? "♀" : "♂"}
            </Text>
          </TouchableOpacity>

          {/* Speed */}
          <TouchableOpacity
            onPress={handleSpeedCycle}
            style={[styles.speedButton, { backgroundColor: colors.bgTertiary }]}
          >
            <Text style={[styles.speedText, { color: colors.textSecondary }]}>
              {speed}x
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
  },
  label: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  proBadge: {
    fontSize: 9,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginLeft: 2,
  },
  smallButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  flag: {
    fontSize: 14,
  },
  genderText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  speedButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  speedText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
});

export default TTSToolbar;
