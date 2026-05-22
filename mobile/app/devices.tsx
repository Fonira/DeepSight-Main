/**
 * DevicesScreen — Auth V2 Wave 1 Mobile Step 3.
 *
 * Mirror du DevicesPage web (frontend/src/pages/DevicesPage.tsx — PR #551)
 * en React Native. Consomme :
 *   GET    /api/auth/sessions       → list[UserSession]
 *   DELETE /api/auth/sessions/{id}  → MessageResponse
 *   DELETE /api/auth/sessions       → MessageResponse (révoque tout sauf current)
 *
 * UX :
 *  - FlatList des sessions, pull-to-refresh (RefreshControl)
 *  - Card par session : device_label / ip_hash / last_seen_at / badge "Cette session"
 *  - Bouton "Révoquer" (Alert confirmation) sur chaque session non-current
 *  - Bouton header "Déconnecter tous les autres" si >1 session active
 *  - Empty state si aucune session
 *  - Pas de re-auth modal (endpoints non protégés par require_recent_reauth)
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";
import { authApi, ApiError } from "@/services/api";
import type { UserSession } from "@/types/auth";
import { GlassCard } from "@/components/ui/GlassCard";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const seconds = Math.max(
      0,
      Math.floor((Date.now() - date.getTime()) / 1000),
    );
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (seconds < 60) return "à l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    if (hours < 24) return `il y a ${hours} h`;
    if (days < 30) return `il y a ${days} j`;
    return date.toLocaleDateString("fr-FR");
  } catch {
    return iso;
  }
}

function shortHash(value?: string | null): string {
  if (!value) return "—";
  return value.length > 12 ? `${value.slice(0, 12)}…` : value;
}

function pickDeviceIcon(
  session: UserSession,
): keyof typeof Ionicons.glyphMap {
  const haystack = `${session.device_label || ""} ${session.user_agent || ""}`
    .toLowerCase();
  if (/iphone|android|mobile|ipad|tablet/.test(haystack)) {
    return "phone-portrait-outline";
  }
  if (/chrome|firefox|safari|edge|windows|mac|linux/.test(haystack)) {
    return "desktop-outline";
  }
  return "globe-outline";
}

// ───────────────────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────────────────

export default function DevicesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();

  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      setError(null);
      const list = await authApi.listSessions();
      setSessions(list);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Erreur de chargement";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSessions();
  }, [fetchSessions]);

  const handleRevokeOne = useCallback(
    (session: UserSession) => {
      const label = session.device_label || "cet appareil";
      Alert.alert(
        "Révoquer la session",
        `Révoquer la session sur « ${label} » ? L'appareil devra se reconnecter.`,
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Révoquer",
            style: "destructive",
            onPress: async () => {
              setRevokingId(session.id);
              try {
                await authApi.revokeSession(session.id);
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
                await fetchSessions();
              } catch (err) {
                const message =
                  err instanceof ApiError
                    ? err.message
                    : "Échec de la révocation";
                Alert.alert("Erreur", message);
              } finally {
                setRevokingId(null);
              }
            },
          },
        ],
      );
    },
    [fetchSessions],
  );

  const handleRevokeAll = useCallback(() => {
    Alert.alert(
      "Déconnecter tous les autres",
      "Déconnecter TOUS les autres appareils ? Ta session courante restera active.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Déconnecter tout",
          style: "destructive",
          onPress: async () => {
            setRevokingAll(true);
            try {
              await authApi.revokeAllOtherSessions();
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              await fetchSessions();
            } catch (err) {
              const message =
                err instanceof ApiError
                  ? err.message
                  : "Échec de la révocation";
              Alert.alert("Erreur", message);
            } finally {
              setRevokingAll(false);
            }
          },
        },
      ],
    );
  }, [fetchSessions]);

  const otherSessionsCount = sessions.filter((s) => !s.current).length;

  // ───────────────────────────────────────────────────────────────────────────
  // Renderers
  // ───────────────────────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: UserSession }) => {
      const isCurrent = item.current;
      const isRevoking = revokingId === item.id;
      const iconName = pickDeviceIcon(item);
      return (
        <GlassCard
          style={[
            styles.card,
            isCurrent && {
              borderColor: colors.accentPrimary,
              borderWidth: 1.5,
            },
          ]}
        >
          <View
            style={styles.cardRow}
            testID={`session-card-${item.id}`}
          >
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: isCurrent
                    ? `${colors.accentPrimary}26`
                    : colors.bgElevated,
                },
              ]}
            >
              <Ionicons
                name={iconName}
                size={20}
                color={
                  isCurrent ? colors.accentPrimary : colors.textSecondary
                }
              />
            </View>

            <View style={styles.cardBody}>
              <View style={styles.titleRow}>
                <Text
                  style={[styles.deviceLabel, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {item.device_label || "Appareil inconnu"}
                </Text>
                {isCurrent && (
                  <View
                    style={[
                      styles.currentBadge,
                      { backgroundColor: `${colors.accentPrimary}26` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.currentBadgeText,
                        { color: colors.accentPrimary },
                      ]}
                    >
                      Cette session
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons
                    name="time-outline"
                    size={12}
                    color={colors.textTertiary}
                  />
                  <Text
                    style={[styles.metaText, { color: colors.textTertiary }]}
                  >
                    Vu {formatRelativeTime(item.last_seen_at)}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons
                    name="globe-outline"
                    size={12}
                    color={colors.textTertiary}
                  />
                  <Text
                    style={[
                      styles.metaText,
                      styles.mono,
                      { color: colors.textTertiary },
                    ]}
                  >
                    {shortHash(item.ip_hash)}
                  </Text>
                </View>
              </View>

              {item.user_agent ? (
                <Text
                  style={[
                    styles.userAgent,
                    { color: colors.textTertiary },
                  ]}
                  numberOfLines={1}
                >
                  {item.user_agent}
                </Text>
              ) : null}
            </View>

            {!isCurrent && (
              <Pressable
                onPress={() => handleRevokeOne(item)}
                disabled={isRevoking}
                accessibilityRole="button"
                accessibilityLabel="Révoquer cette session"
                testID={`revoke-btn-${item.id}`}
                style={({ pressed }) => [
                  styles.revokeBtn,
                  {
                    backgroundColor: `${colors.accentError}1a`,
                    borderColor: `${colors.accentError}4d`,
                    opacity: pressed || isRevoking ? 0.6 : 1,
                  },
                ]}
              >
                {isRevoking ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.accentError}
                  />
                ) : (
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={colors.accentError}
                  />
                )}
              </Pressable>
            )}
          </View>
        </GlassCard>
      );
    },
    [colors, handleRevokeOne, revokingId],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Mes appareils",
          headerStyle: { backgroundColor: colors.bgPrimary },
          headerTitleStyle: {
            color: colors.textPrimary,
            fontFamily: fontFamily.bodySemiBold,
          },
          headerTintColor: colors.accentPrimary,
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Retour"
              testID="devices-back-btn"
              style={({ pressed }) => [
                styles.headerBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={26}
                color={colors.accentPrimary}
              />
            </Pressable>
          ),
        }}
      />

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        testID="devices-list"
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + sp.xl },
        ]}
        ItemSeparatorComponent={() => <View style={{ height: sp.md }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accentPrimary}
            colors={[colors.accentPrimary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Liste des appareils connectés à ton compte. Révoque une session si
              tu ne la reconnais pas.
            </Text>

            {!loading && otherSessionsCount > 0 && (
              <GlassCard style={styles.bannerCard}>
                <View style={styles.bannerRow}>
                  <Ionicons
                    name="shield-outline"
                    size={20}
                    color={colors.accentWarning}
                  />
                  <View style={styles.bannerBody}>
                    <Text
                      style={[
                        styles.bannerTitle,
                        { color: colors.textPrimary },
                      ]}
                    >
                      {otherSessionsCount} autre
                      {otherSessionsCount > 1 ? "s" : ""} session
                      {otherSessionsCount > 1 ? "s" : ""} active
                      {otherSessionsCount > 1 ? "s" : ""}
                    </Text>
                    <Text
                      style={[
                        styles.bannerSub,
                        { color: colors.textTertiary },
                      ]}
                    >
                      Si tu suspectes une connexion non autorisée,
                      déconnecte-les toutes maintenant.
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={handleRevokeAll}
                  disabled={revokingAll}
                  accessibilityRole="button"
                  accessibilityLabel="Déconnecter tous les autres appareils"
                  testID="revoke-all-btn"
                  style={({ pressed }) => [
                    styles.revokeAllBtn,
                    {
                      backgroundColor: `${colors.accentWarning}1a`,
                      borderColor: `${colors.accentWarning}4d`,
                      opacity: pressed || revokingAll ? 0.6 : 1,
                    },
                  ]}
                >
                  {revokingAll ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.accentWarning}
                    />
                  ) : (
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={16}
                      color={colors.accentWarning}
                    />
                  )}
                  <Text
                    style={[
                      styles.revokeAllText,
                      { color: colors.accentWarning },
                    ]}
                  >
                    Déconnecter tous les autres
                  </Text>
                </Pressable>
              </GlassCard>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centered} testID="devices-loading">
              <ActivityIndicator
                size="large"
                color={colors.accentPrimary}
              />
              <Text
                style={[styles.centeredText, { color: colors.textSecondary }]}
              >
                Chargement…
              </Text>
            </View>
          ) : error ? (
            <View testID="devices-error">
            <GlassCard style={styles.errorCard}>
              <Ionicons
                name="alert-circle-outline"
                size={22}
                color={colors.accentError}
              />
              <Text
                style={[styles.errorTitle, { color: colors.accentError }]}
              >
                Erreur
              </Text>
              <Text
                style={[styles.errorText, { color: colors.textSecondary }]}
              >
                {error}
              </Text>
              <Pressable
                onPress={() => {
                  setLoading(true);
                  fetchSessions();
                }}
                accessibilityRole="button"
                accessibilityLabel="Réessayer"
                testID="devices-retry-btn"
                style={({ pressed }) => [
                  styles.retryBtn,
                  {
                    borderColor: colors.accentError,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Text
                  style={[styles.retryText, { color: colors.accentError }]}
                >
                  Réessayer
                </Text>
              </Pressable>
            </GlassCard>
            </View>
          ) : (
            <View testID="devices-empty">
              <GlassCard style={styles.emptyCard}>
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  Aucune session active trouvée.
                </Text>
              </GlassCard>
            </View>
          )
        }
      />
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Styles
// ───────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBtn: {
    paddingHorizontal: sp.sm,
    paddingVertical: sp.xs,
  },
  listContent: {
    paddingHorizontal: sp.lg,
    paddingTop: sp.lg,
    flexGrow: 1,
  },
  headerBlock: {
    marginBottom: sp.lg,
    gap: sp.md,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  bannerCard: {
    gap: sp.md,
  },
  bannerRow: {
    flexDirection: "row",
    gap: sp.md,
    alignItems: "flex-start",
  },
  bannerBody: {
    flex: 1,
    gap: sp.xs,
  },
  bannerTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
  bannerSub: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  revokeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sp.sm,
    paddingVertical: sp.md,
    paddingHorizontal: sp.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  revokeAllText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
  card: {
    padding: sp.md,
  },
  cardRow: {
    flexDirection: "row",
    gap: sp.md,
    alignItems: "flex-start",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
    gap: sp.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    flexWrap: "wrap",
  },
  deviceLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    flexShrink: 1,
  },
  currentBadge: {
    paddingHorizontal: sp.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  currentBadgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: sp.md,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },
  mono: {
    fontFamily: fontFamily.body,
  },
  userAgent: {
    fontFamily: fontFamily.body,
    fontSize: 10,
    marginTop: 2,
  },
  revokeBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: {
    paddingVertical: sp["3xl"],
    alignItems: "center",
    gap: sp.md,
  },
  centeredText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },
  errorCard: {
    alignItems: "center",
    gap: sp.sm,
    padding: sp.lg,
  },
  errorTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
  },
  errorText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: sp.sm,
    paddingVertical: sp.sm,
    paddingHorizontal: sp.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  retryText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
  emptyCard: {
    alignItems: "center",
    padding: sp.xl,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
});
