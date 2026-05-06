/**
 * VisualTab — Détail d'analyse, tab "Visuel" (Phase 2 Mistral Vision).
 *
 * Affiche les 6 sections de l'analyse visuelle multimodale :
 *   1. Hook visuel        — visual_hook
 *   2. Structure          — visual_structure (badge)
 *   3. Moments clés       — key_moments (timestamp MM:SS + description + type)
 *   4. Texte visible      — visible_text (italique si vide)
 *   5. Indicateurs SEO    — visual_seo_indicators (grille)
 *   6. Résumé visuel      — summary_visual (paragraphe)
 *
 * Si `analysis.visual_analysis` est absente (null/undefined) → empty state
 * avec icône + tagline phase 2 (« Maintenant, DeepSight regarde aussi. »).
 *
 * Décision design :
 *   - ScrollView (pas FlashList) : key_moments borné à 8, virtualisation inutile,
 *     scroll unifié sur toutes les sections.
 *   - StyleSheet.create + tokens du theme (palette/sp/fontFamily/borderRadius).
 *   - Compat iOS + Android, dark + light theme.
 *
 * Spec : 01-Projects/DeepSight/Sessions/2026-05-06-visual-analysis-phase-2-spec.md
 * Branche : feat/visual-analysis-phase-2 (PR #386)
 */

import React, { useMemo } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { sp, borderRadius as br } from "../../theme/spacing";
import { fontFamily, fontSize, lineHeight } from "../../theme/typography";
import { palette } from "../../theme/colors";
import type { VisualAnalysis, VisualKeyMoment } from "../../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** 3.5 → '00:03', 75.2 → '01:15', 3700 → '01:01:40'. */
function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Mapping label FR pour les structures vidéo connues. */
const STRUCTURE_LABELS: Record<string, string> = {
  talking_head: "Plan parlé",
  b_roll: "B-roll",
  gameplay: "Gameplay",
  slides: "Slides",
  tutorial: "Tutoriel",
  interview: "Interview",
  vlog: "Vlog",
  mixed: "Mixte",
  other: "Autre",
};

/** Mapping label FR pour les types de moments clés. */
const MOMENT_TYPE_LABELS: Record<string, string> = {
  hook: "Hook",
  transition: "Transition",
  reveal: "Révélation",
  cta: "CTA",
  peak: "Pic",
  demo: "Démo",
};

/** Mapping label FR + couleur sémantique pour le badge type. */
function getMomentTypeStyle(type: string): { label: string; color: string } {
  const norm = (type || "").toLowerCase().trim();
  const label = MOMENT_TYPE_LABELS[norm] || norm || "Moment";
  switch (norm) {
    case "hook":
      return { label, color: palette.violet };
    case "reveal":
      return { label, color: palette.cyan };
    case "cta":
      return { label, color: palette.amber };
    case "peak":
      return { label, color: palette.orange };
    case "demo":
      return { label, color: palette.blue };
    case "transition":
    default:
      return { label, color: palette.indigo };
  }
}

/** Friendly French label pour les valeurs SEO low/medium/high. */
function levelLabel(level?: "low" | "medium" | "high"): string {
  if (level === "low") return "Faible";
  if (level === "medium") return "Moyen";
  if (level === "high") return "Élevé";
  return "—";
}

// ── Props ───────────────────────────────────────────────────────────────────

export interface VisualTabProps {
  /** Données de l'analyse visuelle. null/undefined → empty state. */
  visualAnalysis?: VisualAnalysis | null;
  /** Padding bottom appliqué au ScrollView (footprint TabBar). */
  bottomPadding?: number;
}

// ── Empty State ─────────────────────────────────────────────────────────────

const EmptyState: React.FC = () => {
  const { colors } = useTheme();
  return (
    <View style={styles.emptyContainer}>
      <View
        style={[styles.emptyIconCircle, { backgroundColor: palette.violet + "1A" }]}
      >
        <Ionicons name="eye-outline" size={36} color={palette.violet} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        Maintenant, DeepSight regarde aussi.
      </Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        Cette analyse n'a pas encore de couche visuelle. Lance une nouvelle
        analyse avec l'option Visuel activée pour voir le hook, les moments clés
        et la structure de la vidéo.
      </Text>
    </View>
  );
};

// ── Section components ──────────────────────────────────────────────────────

const SectionHeader: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}> = ({ icon, title }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={18} color={palette.violet} />
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        {title}
      </Text>
    </View>
  );
};

const KeyMomentItem: React.FC<{ moment: VisualKeyMoment }> = ({ moment }) => {
  const { colors } = useTheme();
  const typeStyle = getMomentTypeStyle(moment.type);
  return (
    <View
      style={[
        styles.momentCard,
        { backgroundColor: colors.bgElevated, borderColor: colors.border },
      ]}
    >
      <View style={styles.momentHeader}>
        <View
          style={[
            styles.timestampBadge,
            { backgroundColor: palette.indigo + "20" },
          ]}
        >
          <Ionicons name="time-outline" size={12} color={palette.indigo} />
          <Text style={[styles.timestampText, { color: palette.indigo }]}>
            {formatTimestamp(moment.timestamp_s)}
          </Text>
        </View>
        <View
          style={[
            styles.typeBadge,
            { backgroundColor: typeStyle.color + "20" },
          ]}
        >
          <Text style={[styles.typeBadgeText, { color: typeStyle.color }]}>
            {typeStyle.label}
          </Text>
        </View>
      </View>
      <Text style={[styles.momentDescription, { color: colors.textSecondary }]}>
        {moment.description}
      </Text>
    </View>
  );
};

const SeoIndicator: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  highlight?: boolean;
}> = ({ icon, label, value, highlight }) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.seoCard,
        {
          backgroundColor: colors.bgElevated,
          borderColor: highlight ? palette.violet + "40" : colors.border,
        },
      ]}
    >
      <View style={styles.seoIconRow}>
        <Ionicons
          name={icon}
          size={16}
          color={highlight ? palette.violet : colors.textTertiary}
        />
        <Text style={[styles.seoLabel, { color: colors.textTertiary }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.seoValue, { color: colors.textPrimary }]}>
        {value}
      </Text>
    </View>
  );
};

// ── Main component ──────────────────────────────────────────────────────────

export const VisualTab: React.FC<VisualTabProps> = ({
  visualAnalysis,
  bottomPadding = sp["2xl"],
}) => {
  const { colors } = useTheme();

  // Empty state si pas de données visuelles
  if (!visualAnalysis) {
    return (
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <EmptyState />
      </ScrollView>
    );
  }

  const {
    visual_hook,
    visual_structure,
    key_moments,
    visible_text,
    visual_seo_indicators,
    summary_visual,
    model_used,
    frames_analyzed,
    frames_downsampled,
  } = visualAnalysis;

  const structureLabel = useMemo(() => {
    const norm = (visual_structure || "").toLowerCase().trim();
    return STRUCTURE_LABELS[norm] || norm || "—";
  }, [visual_structure]);

  const seo = visual_seo_indicators || {};
  const seoEntries = useMemo(
    () => [
      {
        key: "hook_brightness",
        icon: "sunny-outline" as const,
        label: "Luminosité du hook",
        value: levelLabel(seo.hook_brightness),
        highlight: seo.hook_brightness === "high",
      },
      {
        key: "thumbnail_quality_proxy",
        icon: "image-outline" as const,
        label: "Qualité miniature",
        value: levelLabel(seo.thumbnail_quality_proxy),
        highlight: seo.thumbnail_quality_proxy === "high",
      },
      {
        key: "face_visible_in_hook",
        icon: "person-outline" as const,
        label: "Visage dans le hook",
        value:
          seo.face_visible_in_hook === undefined
            ? "—"
            : seo.face_visible_in_hook
              ? "Oui"
              : "Non",
        highlight: seo.face_visible_in_hook === true,
      },
      {
        key: "burned_in_subtitles",
        icon: "text-outline" as const,
        label: "Sous-titres incrustés",
        value:
          seo.burned_in_subtitles === undefined
            ? "—"
            : seo.burned_in_subtitles
              ? "Oui"
              : "Non",
        highlight: seo.burned_in_subtitles === true,
      },
      {
        key: "high_motion_intro",
        icon: "flash-outline" as const,
        label: "Intro dynamique",
        value:
          seo.high_motion_intro === undefined
            ? "—"
            : seo.high_motion_intro
              ? "Oui"
              : "Non",
        highlight: seo.high_motion_intro === true,
      },
    ],
    [seo],
  );

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: bottomPadding },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* En-tête meta : modèle + frames analysées */}
      <View style={styles.metaRow}>
        <View
          style={[
            styles.metaPill,
            { backgroundColor: palette.violet + "1A", borderColor: palette.violet + "30" },
          ]}
        >
          <Ionicons name="eye-outline" size={12} color={palette.violet} />
          <Text style={[styles.metaPillText, { color: palette.violet }]}>
            Couche visuelle
          </Text>
        </View>
        {!!model_used && (
          <Text style={[styles.metaText, { color: colors.textTertiary }]}>
            {model_used}
          </Text>
        )}
        {frames_analyzed > 0 && (
          <Text style={[styles.metaText, { color: colors.textTertiary }]}>
            • {frames_analyzed} frames{frames_downsampled ? " (downsampled)" : ""}
          </Text>
        )}
      </View>

      {/* 1. Hook visuel */}
      {!!visual_hook && (
        <View style={styles.section}>
          <SectionHeader icon="rocket-outline" title="Hook visuel" />
          <View
            style={[
              styles.hookCard,
              { backgroundColor: colors.bgElevated, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.hookText, { color: colors.textPrimary }]}>
              {visual_hook}
            </Text>
          </View>
        </View>
      )}

      {/* 2. Structure */}
      {!!visual_structure && (
        <View style={styles.section}>
          <SectionHeader icon="grid-outline" title="Structure visuelle" />
          <View
            style={[
              styles.structureBadge,
              {
                backgroundColor: palette.indigo + "1A",
                borderColor: palette.indigo + "30",
              },
            ]}
          >
            <Ionicons name="film-outline" size={14} color={palette.indigo} />
            <Text style={[styles.structureBadgeText, { color: palette.indigo }]}>
              {structureLabel}
            </Text>
          </View>
        </View>
      )}

      {/* 3. Moments clés */}
      <View style={styles.section}>
        <SectionHeader icon="bookmark-outline" title="Moments clés" />
        {key_moments && key_moments.length > 0 ? (
          <View style={styles.momentsList}>
            {key_moments.map((moment, idx) => (
              <KeyMomentItem
                key={`${moment.timestamp_s}-${idx}`}
                moment={moment}
              />
            ))}
          </View>
        ) : (
          <Text style={[styles.emptyInline, { color: colors.textTertiary }]}>
            Aucun moment clé détecté.
          </Text>
        )}
      </View>

      {/* 4. Texte visible */}
      <View style={styles.section}>
        <SectionHeader icon="text-outline" title="Texte visible à l'écran" />
        {visible_text && visible_text.trim().length > 0 ? (
          <View
            style={[
              styles.textCard,
              { backgroundColor: colors.bgElevated, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.textCardContent, { color: colors.textPrimary }]}>
              {visible_text}
            </Text>
          </View>
        ) : (
          <Text style={[styles.emptyInline, { color: colors.textTertiary }]}>
            Aucun texte détecté.
          </Text>
        )}
      </View>

      {/* 5. Indicateurs SEO visuels */}
      <View style={styles.section}>
        <SectionHeader icon="analytics-outline" title="Indicateurs SEO visuels" />
        <View style={styles.seoGrid}>
          {seoEntries.map((entry) => (
            <SeoIndicator
              key={entry.key}
              icon={entry.icon}
              label={entry.label}
              value={entry.value}
              highlight={entry.highlight}
            />
          ))}
        </View>
      </View>

      {/* 6. Résumé visuel */}
      {!!summary_visual && (
        <View style={styles.section}>
          <SectionHeader icon="sparkles-outline" title="Résumé visuel" />
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: palette.violet + "12",
                borderColor: palette.violet + "30",
              },
            ]}
          >
            <Text style={[styles.summaryText, { color: colors.textPrimary }]}>
              {summary_visual}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

export default VisualTab;

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: sp.lg,
    paddingTop: sp.md,
    gap: sp.lg,
  },
  // Meta header
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: sp.sm,
    marginBottom: sp.xs,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.xs,
    paddingHorizontal: sp.sm,
    paddingVertical: 4,
    borderRadius: br.full,
    borderWidth: 1,
  },
  metaPillText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize["2xs"],
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  metaText: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize["2xs"],
  },
  // Sections
  section: {
    gap: sp.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
  },
  sectionTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
  },
  emptyInline: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    fontStyle: "italic",
    paddingHorizontal: sp.sm,
  },
  // Hook
  hookCard: {
    padding: sp.lg,
    borderRadius: br.lg,
    borderWidth: 1,
  },
  hookText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.normal,
  },
  // Structure
  structureBadge: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: sp.xs,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    borderRadius: br.md,
    borderWidth: 1,
  },
  structureBadgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
  // Moments
  momentsList: {
    gap: sp.sm,
  },
  momentCard: {
    padding: sp.md,
    borderRadius: br.md,
    borderWidth: 1,
    gap: sp.sm,
  },
  momentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
  },
  timestampBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: sp.sm,
    paddingVertical: 4,
    borderRadius: br.sm,
  },
  timestampText: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
  },
  typeBadge: {
    paddingHorizontal: sp.sm,
    paddingVertical: 4,
    borderRadius: br.sm,
  },
  typeBadgeText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize["2xs"],
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  momentDescription: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
  },
  // Texte visible
  textCard: {
    padding: sp.md,
    borderRadius: br.md,
    borderWidth: 1,
  },
  textCardContent: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
  },
  // SEO grid
  seoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: sp.sm,
  },
  seoCard: {
    flexBasis: "48%",
    flexGrow: 1,
    padding: sp.md,
    borderRadius: br.md,
    borderWidth: 1,
    gap: sp.xs,
  },
  seoIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.xs,
  },
  seoLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    flexShrink: 1,
  },
  seoValue: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
  },
  // Résumé
  summaryCard: {
    padding: sp.lg,
    borderRadius: br.lg,
    borderWidth: 1,
  },
  summaryText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.relaxed,
  },
  // Empty state global
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sp["4xl"],
    paddingHorizontal: sp.xl,
    gap: sp.md,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: sp.sm,
  },
  emptyTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    textAlign: "center",
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.relaxed,
    textAlign: "center",
  },
});
