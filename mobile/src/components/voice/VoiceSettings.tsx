/**
 * VoiceSettings — Bottom sheet for voice chat configuration.
 *
 * Displays voice catalog + playback rate presets, persists via voiceApi.
 * Tolerant to `voiceApi.getCatalog`/`getPreferences` not existing yet
 * (added in a parallel commit) — falls back to empty state gracefully.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import BottomSheet, {
  BottomSheetScrollView,
  type BottomSheetProps,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../contexts/ThemeContext";
import { sp, borderRadius } from "../../theme/spacing";
import { fontSize } from "../../theme/typography";
// voiceApi is imported dynamically inside loadData() so that missing methods
// (added in a parallel commit) don't break the component at import time.
// We still need the types for local use.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { voiceApi } from "../../services/api";

// ─── Local types (avoid circular / missing import issues) ──────────────────

interface VoiceCatalogEntryLocal {
  voice_id: string;
  name: string;
  description_fr?: string;
  description_en?: string;
  gender?: string;
  accent?: string;
  language?: string;
  use_case?: string;
  recommended?: boolean;
  preview_url?: string;
}

interface VoiceCatalogLocal {
  voices: VoiceCatalogEntryLocal[];
}

interface VoicePrefsLocal {
  voice_id: string | null;
  voice_name: string | null;
  speed: number;
  // Remaining preference fields are irrelevant for this sheet but kept as
  // unknown to pass through untouched when we save back.
  [key: string]: unknown;
}

interface VoiceSettingsProps {
  bottomSheetRef: React.RefObject<BottomSheet | null>;
  onClose?: () => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const SNAP_POINTS: BottomSheetProps["snapPoints"] = ["65%", "90%"];

const SPEED_PRESETS = [
  { value: 0.9, label: "0.9x", hint: "Lent" },
  { value: 1.0, label: "1.0x", hint: "Normal" },
  { value: 1.2, label: "1.2x", hint: "Rapide" },
] as const;

// Typed shape for the partial voiceApi surface we might call.
interface VoiceApiMaybe {
  getCatalog?: () => Promise<VoiceCatalogLocal>;
  getPreferences?: () => Promise<VoicePrefsLocal>;
  updatePreferences?: (
    updates: Partial<VoicePrefsLocal>,
  ) => Promise<VoicePrefsLocal>;
}

// ─── Main component ────────────────────────────────────────────────────────

const VoiceSettingsInner: React.FC<VoiceSettingsProps> = ({
  bottomSheetRef,
  onClose,
}) => {
  const { colors } = useTheme();

  const [catalog, setCatalog] = useState<VoiceCatalogLocal | null>(null);
  const [prefs, setPrefs] = useState<VoicePrefsLocal | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load catalog + preferences (tolerant to missing API methods) ────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const api = voiceApi as unknown as VoiceApiMaybe;
    let fetchedCatalog: VoiceCatalogLocal = { voices: [] };
    let fetchedPrefs: VoicePrefsLocal | null = null;

    try {
      const [catResult, prefsResult] = await Promise.allSettled([
        api.getCatalog
          ? api.getCatalog()
          : Promise.resolve<VoiceCatalogLocal>({ voices: [] }),
        api.getPreferences
          ? api.getPreferences()
          : Promise.resolve<VoicePrefsLocal | null>(null),
      ]);

      if (catResult.status === "fulfilled" && catResult.value) {
        fetchedCatalog = catResult.value;
      } else if (catResult.status === "rejected") {
        if (__DEV__) {
          console.warn("VoiceSettings: getCatalog failed", catResult.reason);
        }
      }

      if (prefsResult.status === "fulfilled" && prefsResult.value) {
        fetchedPrefs = prefsResult.value;
      } else if (prefsResult.status === "rejected") {
        if (__DEV__) {
          console.warn(
            "VoiceSettings: getPreferences failed",
            prefsResult.reason,
          );
        }
      }

      setCatalog(fetchedCatalog);
      setPrefs(fetchedPrefs);
      setSelectedVoiceId(fetchedPrefs?.voice_id ?? null);
      const loadedSpeed =
        typeof fetchedPrefs?.speed === "number" ? fetchedPrefs.speed : 1.0;
      setPlaybackRate(loadedSpeed);

      if (
        fetchedCatalog.voices.length === 0 &&
        !api.getCatalog &&
        !api.getPreferences
      ) {
        setError(
          "Les paramètres vocaux ne sont pas encore disponibles sur mobile.",
        );
      }
    } catch (err) {
      if (__DEV__) {
        console.warn("VoiceSettings: unexpected load error", err);
      }
      setError("Impossible de charger les paramètres vocaux.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const api = voiceApi as unknown as VoiceApiMaybe;
    if (!api.updatePreferences) {
      if (__DEV__) {
        console.warn("VoiceSettings: updatePreferences not available yet");
      }
      onClose?.();
      bottomSheetRef.current?.close();
      return;
    }

    setSaving(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
        () => undefined,
      );
      await api.updatePreferences({
        voice_id: selectedVoiceId,
        speed: playbackRate,
      });
      onClose?.();
      bottomSheetRef.current?.close();
    } catch (err) {
      if (__DEV__) {
        console.warn("VoiceSettings: save failed", err);
      }
      setError("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }, [bottomSheetRef, onClose, playbackRate, selectedVoiceId]);

  const handleSelectVoice = useCallback((voiceId: string) => {
    Haptics.selectionAsync().catch(() => undefined);
    setSelectedVoiceId(voiceId);
  }, []);

  const handleSelectSpeed = useCallback((value: number) => {
    Haptics.selectionAsync().catch(() => undefined);
    setPlaybackRate(value);
  }, []);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose?.();
      }
    },
    [onClose],
  );

  // ── Derived ────────────────────────────────────────────────────────────
  const voices = useMemo<VoiceCatalogEntryLocal[]>(
    () => catalog?.voices ?? [],
    [catalog],
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      onChange={handleSheetChange}
      backgroundStyle={{ backgroundColor: colors.bgSecondary }}
      handleIndicatorStyle={{ backgroundColor: colors.textMuted }}
    >
      <BottomSheetScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { backgroundColor: colors.bgSecondary },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Paramètres vocaux
          </Text>
          <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
            Voix de l'assistant & vitesse
          </Text>
        </View>

        {/* Loading */}
        {loading && (
          <View style={styles.centerBlock}>
            <ActivityIndicator color={colors.accentPrimary} size="small" />
            <Text style={[styles.centerText, { color: colors.textTertiary }]}>
              Chargement...
            </Text>
          </View>
        )}

        {/* Error */}
        {!loading && error && (
          <View
            style={[
              styles.errorBlock,
              {
                backgroundColor: `${colors.accentError}1A`,
                borderColor: `${colors.accentError}40`,
              },
            ]}
          >
            <Text style={[styles.errorText, { color: colors.accentError }]}>
              {error}
            </Text>
          </View>
        )}

        {/* Voice list */}
        {!loading && voices.length > 0 && (
          <View style={styles.section}>
            <Text
              style={[styles.sectionLabel, { color: colors.textSecondary }]}
            >
              Choisir une voix
            </Text>
            <View style={styles.voiceList}>
              {voices.map((voice) => {
                const isSelected = voice.voice_id === selectedVoiceId;
                return (
                  <Pressable
                    key={voice.voice_id}
                    onPress={() => handleSelectVoice(voice.voice_id)}
                    style={[
                      styles.voiceItem,
                      {
                        backgroundColor: isSelected
                          ? `${colors.accentPrimary}1F`
                          : colors.bgTertiary,
                        borderColor: isSelected
                          ? colors.accentPrimary
                          : colors.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Voix ${voice.name}`}
                  >
                    <View style={styles.voiceItemTextCol}>
                      <Text
                        style={[
                          styles.voiceName,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {voice.name}
                      </Text>
                      {(voice.description_fr ?? voice.description_en) && (
                        <Text
                          style={[
                            styles.voiceDescription,
                            { color: colors.textTertiary },
                          ]}
                          numberOfLines={2}
                        >
                          {voice.description_fr ?? voice.description_en}
                        </Text>
                      )}
                    </View>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={colors.accentPrimary}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Empty state (no voices but no error) */}
        {!loading && !error && voices.length === 0 && (
          <View style={styles.centerBlock}>
            <Text style={[styles.centerText, { color: colors.textTertiary }]}>
              Aucune voix disponible pour le moment.
            </Text>
          </View>
        )}

        {/* Speed presets */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            Vitesse
          </Text>
          <View style={styles.speedRow}>
            {SPEED_PRESETS.map((preset) => {
              const isSelected = Math.abs(playbackRate - preset.value) < 0.01;
              return (
                <Pressable
                  key={preset.value}
                  onPress={() => handleSelectSpeed(preset.value)}
                  style={[
                    styles.speedBtn,
                    {
                      backgroundColor: isSelected
                        ? `${colors.accentPrimary}1F`
                        : colors.bgTertiary,
                      borderColor: isSelected
                        ? colors.accentPrimary
                        : colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`Vitesse ${preset.label}`}
                >
                  <Text
                    style={[
                      styles.speedLabel,
                      {
                        color: isSelected
                          ? colors.accentPrimary
                          : colors.textPrimary,
                      },
                    ]}
                  >
                    {preset.label}
                  </Text>
                  <Text
                    style={[styles.speedHint, { color: colors.textTertiary }]}
                  >
                    {preset.hint}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Save button */}
        <Pressable
          onPress={handleSave}
          disabled={saving || loading}
          style={({ pressed }) => [
            styles.saveBtn,
            {
              backgroundColor: colors.accentPrimary,
              opacity: saving || loading ? 0.5 : pressed ? 0.85 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Enregistrer les préférences vocales"
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Enregistrer</Text>
          )}
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheet>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: sp.lg,
    paddingBottom: sp["3xl"],
    gap: sp.lg,
  },
  header: {
    paddingTop: sp.xs,
    paddingBottom: sp.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: fontSize.sm,
    marginTop: 4,
  },
  centerBlock: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sp["2xl"],
    gap: sp.sm,
  },
  centerText: {
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  errorBlock: {
    paddingVertical: sp.md,
    paddingHorizontal: sp.md,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
  section: {
    gap: sp.sm,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  voiceList: {
    gap: sp.sm,
  },
  voiceItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: sp.md,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: sp.md,
  },
  voiceItemTextCol: {
    flex: 1,
    gap: 2,
  },
  voiceName: {
    fontSize: fontSize.base,
    fontWeight: "600",
  },
  voiceDescription: {
    fontSize: fontSize.xs,
  },
  speedRow: {
    flexDirection: "row",
    gap: sp.sm,
  },
  speedBtn: {
    flex: 1,
    paddingVertical: sp.md,
    paddingHorizontal: sp.sm,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    gap: 2,
  },
  speedLabel: {
    fontSize: fontSize.base,
    fontWeight: "700",
  },
  speedHint: {
    fontSize: fontSize.xs,
  },
  saveBtn: {
    marginTop: sp.md,
    paddingVertical: sp.md,
    paddingHorizontal: sp.lg,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  saveBtnText: {
    color: "#ffffff",
    fontSize: fontSize.base,
    fontWeight: "700",
  },
});

export const VoiceSettings = React.memo(VoiceSettingsInner);
VoiceSettings.displayName = "VoiceSettings";

export default VoiceSettings;
