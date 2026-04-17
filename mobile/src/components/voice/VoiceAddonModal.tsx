/**
 * VoiceAddonModal — Modal for purchasing ElevenLabs voice minute packs.
 *
 * Displays available packs from the backend and opens Stripe Checkout
 * in an in-app browser (PAGE_SHEET on iOS, default on Android).
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { voiceApi } from "../../services/api";
import { useTheme } from "../../contexts/ThemeContext";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";

// ─── Types ─────────────────────────────────────────────────────────────────

interface VoiceAddonPack {
  id: string;
  name: string;
  minutes: number;
  price_cents: number;
  description?: string;
}

export interface VoiceAddonModalProps {
  visible: boolean;
  onClose: () => void;
  onPurchaseStarted?: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

const VoiceAddonModalInner: React.FC<VoiceAddonModalProps> = ({
  visible,
  onClose,
  onPurchaseStarted,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [packs, setPacks] = useState<VoiceAddonPack[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  // ── Load packs ──────────────────────────────────────────────────────────
  const loadPacks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await voiceApi.getAddonPacks();
      setPacks(result.packs ?? []);
    } catch (err) {
      if (__DEV__) {
        console.warn("VoiceAddonModal: getAddonPacks failed", err);
      }
      setError("Impossible de charger les packs disponibles.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Auto-load when modal becomes visible ────────────────────────────────
  useEffect(() => {
    if (visible) {
      loadPacks();
    }
  }, [visible, loadPacks]);

  // ── Reset state when modal closes ───────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      setPurchasingId(null);
    }
  }, [visible]);

  // ── Handle pack purchase ────────────────────────────────────────────────
  const handlePurchase = useCallback(
    async (pack: VoiceAddonPack) => {
      if (purchasingId !== null) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setPurchasingId(pack.id);

      try {
        const { checkout_url } = await voiceApi.createAddonCheckout(pack.id);
        onPurchaseStarted?.();

        const presentationStyle =
          Platform.OS === "ios"
            ? WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET
            : undefined;

        await WebBrowser.openBrowserAsync(checkout_url, {
          ...(presentationStyle !== undefined ? { presentationStyle } : {}),
          controlsColor: colors.accentPrimary,
        });

        onClose();
      } catch (err) {
        if (__DEV__) {
          console.warn("VoiceAddonModal: createAddonCheckout failed", err);
        }
        setError("Impossible de démarrer le paiement. Veuillez réessayer.");
      } finally {
        setPurchasingId(null);
      }
    },
    [colors.accentPrimary, onClose, onPurchaseStarted, purchasingId],
  );

  // ── Handle close ────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    if (purchasingId !== null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onClose();
  }, [onClose, purchasingId]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.root}>
        {/* Backdrop */}
        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
        />

        {/* Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.bgSecondary,
              paddingBottom: Math.max(insets.bottom, sp.lg),
              borderColor: colors.border,
            },
          ]}
        >
          {/* Handle bar */}
          <View style={styles.handleBarContainer}>
            <View
              style={[styles.handleBar, { backgroundColor: colors.textMuted }]}
            />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextCol}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                Packs de minutes vocales
              </Text>
              <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                Prolongez votre conversation avec DeepSight
              </Text>
            </View>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [
                styles.closeBtn,
                {
                  backgroundColor: colors.bgTertiary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Fermer la fenêtre"
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Loading */}
            {loading && (
              <View style={styles.centerBlock}>
                <ActivityIndicator color={colors.accentPrimary} size="small" />
                <Text
                  style={[styles.centerText, { color: colors.textTertiary }]}
                >
                  Chargement des packs...
                </Text>
              </View>
            )}

            {/* Error */}
            {!loading && error && (
              <View style={styles.centerBlock}>
                <View
                  style={[
                    styles.errorBlock,
                    {
                      backgroundColor: `${colors.accentError}1A`,
                      borderColor: `${colors.accentError}40`,
                    },
                  ]}
                >
                  <Text
                    style={[styles.errorText, { color: colors.accentError }]}
                  >
                    {error}
                  </Text>
                </View>
                <Pressable
                  onPress={loadPacks}
                  style={({ pressed }) => [
                    styles.retryBtn,
                    {
                      backgroundColor: colors.accentPrimary,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Réessayer le chargement"
                >
                  <Text style={styles.retryBtnText}>Réessayer</Text>
                </Pressable>
              </View>
            )}

            {/* Empty */}
            {!loading && !error && packs.length === 0 && (
              <View style={styles.centerBlock}>
                <Ionicons
                  name="cube-outline"
                  size={32}
                  color={colors.textMuted}
                />
                <Text
                  style={[styles.centerText, { color: colors.textTertiary }]}
                >
                  Aucun pack disponible pour le moment.
                </Text>
              </View>
            )}

            {/* Packs */}
            {!loading && !error && packs.length > 0 && (
              <View style={styles.packsList}>
                {packs.map((pack, index) => {
                  const isPurchasing = purchasingId === pack.id;
                  const isDisabled =
                    purchasingId !== null && purchasingId !== pack.id;
                  const isPopular = packs.length === 3 && index === 1;
                  const priceEur = (pack.price_cents / 100).toFixed(2);

                  return (
                    <Pressable
                      key={pack.id}
                      onPress={() => handlePurchase(pack)}
                      disabled={isPurchasing || isDisabled}
                      style={({ pressed }) => [
                        styles.packCard,
                        {
                          backgroundColor: colors.bgTertiary,
                          borderColor: isPopular
                            ? colors.accentPrimary
                            : colors.border,
                          opacity: isDisabled ? 0.5 : pressed ? 0.88 : 1,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Acheter ${pack.name}, ${pack.minutes} minutes pour ${priceEur} euros`}
                      accessibilityState={{
                        disabled: isPurchasing || isDisabled,
                        busy: isPurchasing,
                      }}
                    >
                      {/* Popular badge */}
                      {isPopular && (
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: colors.accentPrimary },
                          ]}
                        >
                          <Text style={styles.badgeText}>POPULAIRE</Text>
                        </View>
                      )}

                      {/* Icon */}
                      <View
                        style={[
                          styles.iconContainer,
                          {
                            backgroundColor: `${colors.accentPrimary}1F`,
                          },
                        ]}
                      >
                        <Ionicons
                          name="time-outline"
                          size={22}
                          color={colors.accentPrimary}
                        />
                      </View>

                      {/* Info */}
                      <View style={styles.packInfo}>
                        <Text
                          style={[
                            styles.packName,
                            { color: colors.textPrimary },
                          ]}
                          numberOfLines={1}
                        >
                          {pack.name}
                        </Text>
                        {pack.description ? (
                          <Text
                            style={[
                              styles.packDescription,
                              { color: colors.textTertiary },
                            ]}
                            numberOfLines={2}
                          >
                            {pack.description}
                          </Text>
                        ) : null}
                        <Text
                          style={[
                            styles.packMinutes,
                            { color: colors.accentPrimary },
                          ]}
                        >
                          {pack.minutes} min
                        </Text>
                      </View>

                      {/* Price / loader */}
                      <View style={styles.priceContainer}>
                        {isPurchasing ? (
                          <ActivityIndicator
                            color={colors.accentPrimary}
                            size="small"
                          />
                        ) : (
                          <Text
                            style={[
                              styles.priceText,
                              { color: colors.textPrimary },
                            ]}
                          >
                            {priceEur} €
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Ionicons
              name="lock-closed-outline"
              size={12}
              color={colors.textMuted}
            />
            <Text style={[styles.footerText, { color: colors.textMuted }]}>
              Paiement sécurisé via Stripe
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  card: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    maxHeight: "88%",
    overflow: "hidden",
  },
  handleBarContainer: {
    alignItems: "center",
    paddingTop: sp.sm,
    paddingBottom: sp.xs,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: sp.lg,
    paddingTop: sp.sm,
    paddingBottom: sp.md,
    gap: sp.md,
  },
  headerTextCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    opacity: 0.6,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: sp.lg,
    paddingBottom: sp.md,
  },
  centerBlock: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sp["3xl"],
    gap: sp.md,
  },
  centerText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  errorBlock: {
    paddingVertical: sp.md,
    paddingHorizontal: sp.md,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    width: "100%",
  },
  errorText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  retryBtn: {
    paddingVertical: sp.sm,
    paddingHorizontal: sp.xl,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  retryBtnText: {
    color: "#ffffff",
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
  packsList: {
    gap: sp.md,
  },
  packCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: sp.lg,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: sp.md,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -8,
    right: sp.lg,
    paddingVertical: 2,
    paddingHorizontal: sp.sm,
    borderRadius: borderRadius.sm,
    zIndex: 1,
  },
  badgeText: {
    color: "#ffffff",
    fontFamily: fontFamily.bodyBold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  packInfo: {
    flex: 1,
    gap: 2,
  },
  packName: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
  },
  packDescription: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },
  packMinutes: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  priceContainer: {
    minWidth: 56,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  priceText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sp.xs,
    paddingVertical: sp.md,
    paddingHorizontal: sp.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },
});

const VoiceAddonModal = React.memo(VoiceAddonModalInner);
VoiceAddonModal.displayName = "VoiceAddonModal";

export default VoiceAddonModal;
