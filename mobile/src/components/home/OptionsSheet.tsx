import React, { forwardRef, useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAnalysisStore } from '@/stores/analysisStore';
import type { AnalysisOptionsV2 } from '@/types/v2';
import { palette } from '@/theme/colors';
import { sp, borderRadius } from '@/theme/spacing';
import { fontFamily, fontSize } from '@/theme/typography';

// ─── Chip component ───

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

const Chip: React.FC<ChipProps> = ({ label, selected, onPress }) => {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected
            ? `${palette.indigo}20`
            : colors.bgTertiary,
          borderColor: selected ? palette.indigo : colors.border,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text
        style={[
          styles.chipText,
          { color: selected ? palette.indigo : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

// ─── Option groups ───

interface ChipOption {
  value: string;
  label: string;
}

const MODE_OPTIONS: ChipOption[] = [
  { value: 'accessible', label: 'Accessible' },
  { value: 'standard', label: 'Standard' },
  { value: 'expert', label: 'Expert' },
];

const LANGUAGE_OPTIONS: ChipOption[] = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
];

// ─── OptionsSheet ───

interface OptionsSheetProps {
  onClose?: () => void;
}

export const OptionsSheet = forwardRef<BottomSheet, OptionsSheetProps>(
  ({ onClose }, ref) => {
    const { colors } = useTheme();
    const options = useAnalysisStore((s) => s.options);
    const setOptions = useAnalysisStore((s) => s.setOptions);

    const snapPoints = useMemo(() => ['40%'], []);

    const handleModeSelect = useCallback(
      (mode: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setOptions({ mode: mode as AnalysisOptionsV2['mode'] });
      },
      [setOptions],
    );

    const handleLanguageSelect = useCallback(
      (language: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setOptions({ language });
      },
      [setOptions],
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
        />
      ),
      [],
    );

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor: colors.bgSecondary,
          borderTopLeftRadius: borderRadius['2xl'],
          borderTopRightRadius: borderRadius['2xl'],
        }}
        handleIndicatorStyle={{ backgroundColor: colors.textMuted }}
      >
        <BottomSheetView style={styles.sheetContent}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
              Options
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityLabel="Fermer"
            >
              <Ionicons
                name="close"
                size={24}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

          {/* Mode */}
          <Text style={[styles.optionLabel, { color: colors.textSecondary }]}>
            Mode d&apos;analyse
          </Text>
          <View style={styles.chipRow}>
            {MODE_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                selected={options.mode === opt.value}
                onPress={() => handleModeSelect(opt.value)}
              />
            ))}
          </View>

          {/* Language */}
          <Text
            style={[
              styles.optionLabel,
              { color: colors.textSecondary, marginTop: sp.xl },
            ]}
          >
            Langue
          </Text>
          <View style={styles.chipRow}>
            {LANGUAGE_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                selected={options.language === opt.value}
                onPress={() => handleLanguageSelect(opt.value)}
              />
            ))}
          </View>
        </BottomSheetView>
      </BottomSheet>
    );
  },
);

OptionsSheet.displayName = 'OptionsSheet';

const styles = StyleSheet.create({
  sheetContent: {
    paddingHorizontal: sp.xl,
    paddingBottom: sp['3xl'],
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp.xl,
  },
  sheetTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xl,
  },
  optionLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    marginBottom: sp.md,
  },
  chipRow: {
    flexDirection: 'row',
    gap: sp.sm,
  },
  chip: {
    paddingHorizontal: sp.lg,
    paddingVertical: sp.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
});

export default OptionsSheet;
