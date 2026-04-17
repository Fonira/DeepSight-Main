/**
 * CreditPacksModal — Modal d'achat de packs de crédits
 *
 * Permet à l'utilisateur d'acheter des packs de crédits supplémentaires
 * via Stripe Checkout, ouvert dans un WebBrowser en PAGE_SHEET.
 *
 * - Charge les packs disponibles via billingApi.getCreditPacks()
 * - Met en avant le meilleur ratio credits/price avec un badge "MEILLEURE OFFRE"
 * - Ouvre Stripe Checkout en PAGE_SHEET via expo-web-browser
 * - Gère loading, error, empty states + feedback haptique
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";

import { billingApi } from "../../services/api";
import { useTheme } from "../../contexts/ThemeContext";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
}

interface CreditPacksModalProps {
  visible: boolean;
  onClose: () => void;
  onPurchaseStarted?: () => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const GOLD_BADGE = "#C8903A";
const GOLD_BADGE_LIGHT = "#D4A054";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatPrice = (priceCents: number): string =>
  `${(priceCents / 100).toFixed(2)} €`;

/**
 * Retourne l'id du pack avec le meilleur ratio credits/price_cents.
 * Null si la liste est vide ou contient un seul pack.
 */
const computeBestOfferId = (packs: CreditPack[]): string | null => {
  if (packs.length <= 1) return null;
  let bestId: string | null = null;
  let bestRatio = -Infinity;
  for (const pack of packs) {
    if (pack.price_cents <= 0) continue;
    const ratio = pack.credits / pack.price_cents;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestId = pack.id;
    }
  }
  return bestId;
};

const triggerHaptic = async (
  style: Haptics.ImpactFeedbackStyle,
): Promise<void> => {
  try {
    await Haptics.impactAsync(style);
  } catch {
    // Haptics non disponibles (Android ancien, simulateur) → ignorer
  }
};

// ─── Composant ────────────────────────────────────────────────────────────────

const CreditPacksModal: React.FC<CreditPacksModalProps> = ({
  visible,
  onClose,
  onPurchaseStarted,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  const fetchPacks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await billingApi.getCreditPacks();
      setPacks(result.packs ?? []);
    } catch {
      setError("Impossible de charger les packs. Vérifiez votre connexion.");
      setPacks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchPacks();
    } else {
      // Reset au close pour éviter l'état obsolète au prochain open
      setPurchasingId(null);
      setError(null);
    }
  }, [visible, fetchPacks]);

  const handlePurchase = useCallback(
    async (pack: CreditPack): Promise<void> => {
      if (purchasingId !== null) return; // prévient double-tap
      await triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      setPurchasingId(pack.id);
      try {
        const { checkout_url } = await billingApi.createCreditPackCheckout(
          pack.id,
        );
        onPurchaseStarted?.();
        await WebBrowser.openBrowserAsync(checkout_url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          controlsColor: GOLD_BADGE,
        });
        onClose();
      } catch {
        setError("Paiement impossible. Réessayez dans quelques instants.");
      } finally {
        setPurchasingId(null);
      }
    },
    [purchasingId, onClose, onPurchaseStarted],
  );

  const handleBackdropPress = useCallback((): void => {
    if (purchasingId !== null) return;
    onClose();
  }, [onClose, purchasingId]);

  const bestOfferId = computeBestOfferId(packs);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        {/* Backdrop cliquable */}
        <Pressable
          style={styles.backdrop}
          onPress={handleBackdropPress}
          accessibilityRole="button"
          accessibilityLabel="Fermer la modale"
        />

        {/* Card content */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.bgSecondary,
              borderColor: colors.borderLight,
              paddingBottom: Math.max(insets.bottom + sp.md, sp.lg),
            },
          ]}
          accessibilityViewIsModal
        >
          {/* Handle bar */}
          <View style={styles.handleBarWrapper}>
            <View
              style={[
                styles.handleBar,
                { backgroundColor: colors.borderLight },
              ]}
            />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextWrapper}>
              <Text
                style={[styles.title, { color: colors.textPrimary }]}
                accessibilityRole="header"
              >
                Packs de crédits
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Continuez à analyser sans limite
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                {
                  backgroundColor: colors.bgTertiary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Body */}
          <View style={styles.body}>
            {loading ? (
              <View style={styles.centerState}>
                <ActivityIndicator size="large" color={colors.accentPrimary} />
                <Text
                  style={[styles.stateText, { color: colors.textSecondary }]}
                >
                  Chargement des packs...
                </Text>
              </View>
            ) : error ? (
              <View style={styles.centerState}>
                <Ionicons
                  name="alert-circle-outline"
                  size={40}
                  color={colors.accentError}
                />
                <Text
                  style={[styles.stateText, { color: colors.textSecondary }]}
                >
                  {error}
                </Text>
                <Pressable
                  onPress={fetchPacks}
                  style={({ pressed }) => [
                    styles.retryButton,
                    {
                      backgroundColor: colors.accentPrimary,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Réessayer le chargement"
                >
                  <Ionicons name="refresh" size={16} color="#FFFFFF" />
                  <Text style={styles.retryButtonText}>Réessayer</Text>
                </Pressable>
              </View>
            ) : packs.length === 0 ? (
              <View style={styles.centerState}>
                <Ionicons
                  name="cube-outline"
                  size={40}
                  color={colors.textTertiary}
                />
                <Text
                  style={[styles.stateText, { color: colors.textSecondary }]}
                >
                  Aucun pack disponible.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {packs.map((pack) => {
                  const isBest = pack.id === bestOfferId;
                  const isPurchasing = purchasingId === pack.id;
                  const disabled = purchasingId !== null && !isPurchasing;
                  return (
                    <Pressable
                      key={pack.id}
                      onPress={() => handlePurchase(pack)}
                      disabled={purchasingId !== null}
                      style={({ pressed }) => [
                        styles.packCard,
                        {
                          backgroundColor: colors.bgCard,
                          borderColor: isBest ? GOLD_BADGE : colors.borderLight,
                          borderWidth: isBest ? 1.5 : 1,
                          opacity: disabled ? 0.5 : 1,
                        },
                        pressed && { transform: [{ scale: 0.98 }] },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Acheter ${pack.name}, ${pack.credits} crédits pour ${formatPrice(pack.price_cents)}${isBest ? ", meilleure offre" : ""}`}
                      accessibilityState={{
                        disabled: purchasingId !== null,
                        busy: isPurchasing,
                      }}
                    >
                      {isBest && (
                        <View
                          style={[
                            styles.bestBadge,
                            { backgroundColor: GOLD_BADGE },
                          ]}
                        >
                          <Text style={styles.bestBadgeText}>
                            MEILLEURE OFFRE
                          </Text>
                        </View>
                      )}

                      <View
                        style={[
                          styles.iconWrapper,
                          {
                            backgroundColor: isBest
                              ? `${GOLD_BADGE}22`
                              : `${colors.accentPrimary}15`,
                          },
                        ]}
                      >
                        <Ionicons
                          name="sparkles-outline"
                          size={22}
                          color={isBest ? GOLD_BADGE : colors.accentPrimary}
                        />
                      </View>

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
                        <Text
                          style={[
                            styles.packCredits,
                            { color: colors.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {pack.credits} crédits
                        </Text>
                      </View>

                      <View style={styles.priceWrapper}>
                        {isPurchasing ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.accentPrimary}
                          />
                        ) : (
                          <Text
                            style={[
                              styles.packPrice,
                              {
                                color: isBest
                                  ? GOLD_BADGE_LIGHT
                                  : colors.textPrimary,
                              },
                            ]}
                          >
                            {formatPrice(pack.price_cents)}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.borderLight }]}>
            <Ionicons
              name="lock-closed-outline"
              size={14}
              color={colors.textTertiary}
            />
            <Text style={[styles.footerText, { color: colors.textTertiary }]}>
              Paiement sécurisé via Stripe
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    width: "100%",
    maxHeight: "85%",
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: sp.lg,
    paddingTop: sp.sm,
  },
  handleBarWrapper: {
    alignItems: "center",
    paddingVertical: sp.sm,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: borderRadius.full,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: sp.md,
    paddingBottom: sp.lg,
  },
  headerTextWrapper: {
    flex: 1,
  },
  title: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize["2xl"],
    marginBottom: sp.xs,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    minHeight: 200,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: sp.md,
    paddingBottom: sp.md,
  },
  packCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.md,
    padding: sp.lg,
    borderRadius: borderRadius.lg,
    position: "relative",
  },
  bestBadge: {
    position: "absolute",
    top: -10,
    right: sp.md,
    paddingHorizontal: sp.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  bestBadgeText: {
    color: "#FFFFFF",
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize["2xs"],
    letterSpacing: 0.5,
  },
  iconWrapper: {
    width: 44,
    height: 44,
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
  packCredits: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },
  priceWrapper: {
    minWidth: 70,
    alignItems: "flex-end",
  },
  packPrice: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.lg,
  },
  centerState: {
    paddingVertical: sp["3xl"],
    alignItems: "center",
    justifyContent: "center",
    gap: sp.md,
  },
  stateText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: "center",
    paddingHorizontal: sp.lg,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.xs,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.sm,
    borderRadius: borderRadius.md,
    marginTop: sp.xs,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sp.xs,
    paddingTop: sp.md,
    marginTop: sp.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },
});

export default React.memo(CreditPacksModal);
