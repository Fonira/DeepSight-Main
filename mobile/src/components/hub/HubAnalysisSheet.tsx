/**
 * HubAnalysisSheet — Bottom sheet qui affiche l'analyse détaillée d'une
 * conversation depuis l'onglet Hub mobile, sans quitter le Hub.
 *
 * Affiche : header (titre vidéo + chaîne + thumbnail + plateforme + mots),
 * contenu markdown via AnalysisContentDisplay (disableScroll=true).
 *
 * États : loading (spinner), error (retry), empty (Quick Chat sans content).
 *
 * Le CTA "Ouvrir la vue complète" qui naviguait vers /(tabs)/analysis/[id]
 * a été retiré : il causait un crash de l'app. Toute l'analyse vit désormais
 * dans ce sheet, sans quitter le Hub.
 */

import React, { forwardRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Image,
} from "react-native";
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetProps,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { videoApi } from "@/services/api";
import { AnalysisContentDisplay } from "@/components/analysis/AnalysisContentDisplay";
import { useTheme } from "@/contexts/ThemeContext";
import { sp, borderRadius as br } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";
import { palette } from "@/theme/colors";

interface HubAnalysisSheetProps {
  /** ID de l'analyse à afficher. Si null, le sheet n'effectue aucun fetch. */
  summaryId: string | null;
  /** Callback quand le sheet se ferme (swipe down ou backdrop tap). */
  onClose: () => void;
}

const SNAP_POINTS: BottomSheetProps["snapPoints"] = ["65%", "92%"];

export const HubAnalysisSheet = forwardRef<BottomSheet, HubAnalysisSheetProps>(
  ({ summaryId, onClose }, ref) => {
    const { colors } = useTheme();

    const {
      data: summary,
      isLoading,
      error,
      refetch,
    } = useQuery({
      queryKey: ["video-summary", summaryId],
      queryFn: () => {
        if (!summaryId) throw new Error("no-summary-id");
        return videoApi.getSummary(summaryId);
      },
      enabled: !!summaryId,
      staleTime: 60_000,
    });

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
          pressBehavior="close"
        />
      ),
      [],
    );

    const platformLabel = useMemo(() => {
      if (!summary?.platform) return "YOUTUBE";
      return summary.platform.toUpperCase();
    }, [summary?.platform]);

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={SNAP_POINTS}
        enablePanDownToClose
        onClose={onClose}
        backdropComponent={renderBackdrop}
        backgroundStyle={[styles.bg, { backgroundColor: colors.bgPrimary }]}
        handleIndicatorStyle={{ backgroundColor: colors.textTertiary }}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.scrollContent}
          testID="hub-analysis-sheet"
        >
          {summary ? (
            <View
              style={[styles.headerCard, { borderBottomColor: colors.border }]}
            >
              {summary.thumbnail ? (
                <Image
                  source={{ uri: summary.thumbnail }}
                  style={styles.thumb}
                  accessibilityLabel="Miniature vidéo"
                />
              ) : (
                <View
                  style={[
                    styles.thumb,
                    styles.thumbFallback,
                    { backgroundColor: colors.bgCard },
                  ]}
                >
                  <Ionicons
                    name="videocam-outline"
                    size={22}
                    color={colors.textTertiary}
                  />
                </View>
              )}
              <View style={styles.headerText}>
                <Text
                  style={[styles.title, { color: colors.textPrimary }]}
                  numberOfLines={2}
                >
                  {summary.title}
                </Text>
                {summary.channel ? (
                  <Text
                    style={[styles.channel, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {summary.channel}
                  </Text>
                ) : null}
                <View style={styles.metaRow}>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: palette.indigo + "20" },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: palette.indigo }]}>
                      {platformLabel}
                    </Text>
                  </View>
                  {summary.wordCount ? (
                    <Text
                      style={[styles.metaText, { color: colors.textTertiary }]}
                    >
                      {summary.wordCount} mots
                    </Text>
                  ) : null}
                  {summary.mode ? (
                    <Text
                      style={[styles.metaText, { color: colors.textTertiary }]}
                    >
                      {summary.mode}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}

          {isLoading ? (
            <View style={styles.center} testID="hub-analysis-sheet-loading">
              <ActivityIndicator color={palette.indigo} />
              <Text
                style={[
                  styles.muted,
                  { color: colors.textTertiary, marginTop: sp.sm },
                ]}
              >
                Chargement du résumé…
              </Text>
            </View>
          ) : null}

          {error && !isLoading ? (
            <View style={styles.center} testID="hub-analysis-sheet-error">
              <Ionicons
                name="alert-circle-outline"
                size={32}
                color={palette.amber}
              />
              <Text
                style={[
                  styles.muted,
                  {
                    color: colors.textTertiary,
                    marginTop: sp.sm,
                    textAlign: "center",
                  },
                ]}
              >
                Impossible de charger l'analyse
              </Text>
              <Pressable
                onPress={() => refetch()}
                accessibilityLabel="Réessayer"
                testID="hub-analysis-sheet-retry"
                style={[
                  styles.retryButton,
                  {
                    borderColor: palette.indigo + "60",
                    backgroundColor: palette.indigo + "10",
                  },
                ]}
              >
                <Text style={[styles.retryText, { color: palette.indigo }]}>
                  Réessayer
                </Text>
              </Pressable>
            </View>
          ) : null}

          {!isLoading && !error && summary && !summary.content ? (
            <View style={styles.center} testID="hub-analysis-sheet-empty">
              <Ionicons
                name="document-text-outline"
                size={32}
                color={colors.textTertiary}
              />
              <Text
                style={[
                  styles.muted,
                  {
                    color: colors.textTertiary,
                    marginTop: sp.sm,
                    textAlign: "center",
                  },
                ]}
              >
                Aucun résumé disponible. Lance l'analyse complète pour générer
                le contenu détaillé.
              </Text>
            </View>
          ) : null}

          {!isLoading && !error && summary?.content ? (
            <View
              style={styles.contentWrapper}
              testID="hub-analysis-sheet-content"
            >
              <AnalysisContentDisplay
                content={summary.content}
                disableScroll
                bottomPadding={0}
              />
            </View>
          ) : null}
        </BottomSheetScrollView>
      </BottomSheet>
    );
  },
);

HubAnalysisSheet.displayName = "HubAnalysisSheet";

const styles = StyleSheet.create({
  bg: {
    borderTopLeftRadius: br.lg,
    borderTopRightRadius: br.lg,
  },
  scrollContent: {
    paddingBottom: 96,
  },
  headerCard: {
    flexDirection: "row",
    gap: sp.md,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.md,
    borderBottomWidth: 1,
  },
  thumb: {
    width: 92,
    height: 56,
    borderRadius: br.sm,
    backgroundColor: "#222",
  },
  thumbFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
  channel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    marginTop: 4,
    flexWrap: "wrap",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: br.sm,
  },
  badgeText: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    letterSpacing: 1,
  },
  metaText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize["2xs"],
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: sp.lg,
    paddingVertical: sp.xl,
  },
  muted: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },
  retryButton: {
    marginTop: sp.md,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.sm,
    borderRadius: br.full,
    borderWidth: 1,
  },
  retryText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
  },
  contentWrapper: {
    paddingHorizontal: sp.md,
    paddingTop: sp.md,
  },
});

export default HubAnalysisSheet;
