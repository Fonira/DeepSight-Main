/**
 * DEEP SIGHT — ExternalSourceCard (Mobile)
 *
 * Card individuelle dans <ExternalSourcesSection>. Affiche favicon + host +
 * titre + résumé Mistral + 2 key_claims max + lien "Ouvrir".
 *
 * Status gating (valeurs backend canoniques, voir
 * `videos/external_pages/orchestrator.py` + `summarizer.py` + `scraper.py`) :
 *  - ok                                    → résumé + claims complet
 *  - paywall                               → notice "Article payant"
 *  - http_error / non_html                 → notice "Page introuvable"
 *  - error / timeout / empty               → notice "Contenu non extractible"
 *
 * Mirror du frontend `ExternalSourceCard.tsx` (PR #503).
 */

import React, { useState } from "react";
import { View, Text, Image, Pressable, Linking, StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { sp, borderRadius } from "../theme/spacing";
import { fontFamily, fontSize } from "../theme/typography";
import type { ExternalPageCitation } from "../types";

interface Props {
  page: ExternalPageCitation;
  index: number;
  language: "fr" | "en";
}

const SAFE_HOST = (rawUrl: string): string => {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return rawUrl.slice(0, 60);
  }
};

export const ExternalSourceCard: React.FC<Props> = ({
  page,
  index,
  language,
}) => {
  const { colors } = useTheme();
  const host = SAFE_HOST(page.final_url);
  const [faviconError, setFaviconError] = useState(false);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;

  const handleOpen = () => {
    Linking.openURL(page.final_url).catch(() => {
      // Silently fail — best-effort link open.
    });
  };

  const renderBody = () => {
    if (page.status === "paywall") {
      return (
        <View style={styles.noticeRow}>
          <Ionicons name="lock-closed-outline" size={14} color="#fbbf24" />
          <Text style={[styles.noticeText, { color: "#fbbf24" }]}>
            {language === "fr"
              ? "Article payant non accessible"
              : "Paywalled article"}
          </Text>
        </View>
      );
    }
    if (page.status === "http_error" || page.status === "non_html") {
      return (
        <View style={styles.noticeRow}>
          <Ionicons name="document-outline" size={14} color="#fb7185" />
          <Text style={[styles.noticeText, { color: "#fb7185" }]}>
            {language === "fr" ? "Page introuvable" : "Page not found"}
          </Text>
        </View>
      );
    }
    if (
      page.status === "error" ||
      page.status === "timeout" ||
      page.status === "empty"
    ) {
      return (
        <View style={styles.noticeRow}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.noticeText, { color: colors.textMuted }]}>
            {language === "fr"
              ? "Contenu non extractible"
              : "Content unavailable"}
          </Text>
        </View>
      );
    }
    return (
      <>
        <Text
          style={[styles.summary, { color: colors.textSecondary }]}
          numberOfLines={3}
        >
          {page.summary}
        </Text>
        {page.key_claims.length > 0 && (
          <View style={styles.claimsList}>
            {page.key_claims.slice(0, 2).map((claim, i) => (
              <View key={i} style={styles.claimRow}>
                <Text style={[styles.claimBullet, { color: colors.textMuted }]}>
                  •
                </Text>
                <Text
                  style={[styles.claimText, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {claim}
                </Text>
              </View>
            ))}
          </View>
        )}
      </>
    );
  };

  return (
    <Animated.View
      entering={FadeIn.duration(250).delay(index * 40)}
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceSecondary,
          borderColor: colors.border,
        },
      ]}
      testID="external-source-card-mobile"
    >
      {/* Header : favicon + host */}
      <View style={styles.header}>
        {!faviconError ? (
          <Image
            source={{ uri: faviconUrl }}
            style={styles.favicon}
            onError={() => setFaviconError(true)}
          />
        ) : (
          <View
            style={[
              styles.faviconFallback,
              { backgroundColor: colors.accentSecondary + "33" },
            ]}
          />
        )}
        <Text
          style={[styles.host, { color: colors.textMuted }]}
          numberOfLines={1}
        >
          {host}
        </Text>
      </View>

      {/* Title */}
      <Text
        style={[styles.title, { color: colors.textPrimary }]}
        numberOfLines={2}
      >
        {page.title || page.final_url}
      </Text>

      {/* Body */}
      <View style={styles.body}>{renderBody()}</View>

      {/* Footer link */}
      <Pressable
        onPress={handleOpen}
        style={({ pressed }) => [
          styles.openLink,
          { opacity: pressed ? 0.6 : 1 },
        ]}
        accessibilityLabel={`${language === "fr" ? "Ouvrir" : "Open"} ${page.title || host}`}
        accessibilityRole="link"
      >
        <Text style={[styles.openLinkText, { color: colors.accentSecondary }]}>
          {language === "fr" ? "Ouvrir" : "Open"}
        </Text>
        <Ionicons
          name="open-outline"
          size={12}
          color={colors.accentSecondary}
        />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 280,
    padding: sp.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginRight: sp.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.xs,
    marginBottom: sp.xs,
  },
  favicon: {
    width: 16,
    height: 16,
    borderRadius: 2,
  },
  faviconFallback: {
    width: 16,
    height: 16,
    borderRadius: 2,
  },
  host: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: 11,
  },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    marginBottom: sp.xs,
  },
  body: {
    flex: 1,
    minHeight: 60,
  },
  summary: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 19,
  },
  claimsList: {
    marginTop: sp.xs,
    gap: 2,
  },
  claimRow: {
    flexDirection: "row",
    gap: 4,
  },
  claimBullet: {
    fontFamily: fontFamily.body,
    fontSize: 11,
  },
  claimText: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: 11,
  },
  noticeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  noticeText: {
    fontFamily: fontFamily.body,
    fontSize: 12,
  },
  openLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: sp.sm,
    alignSelf: "flex-start",
  },
  openLinkText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
  },
});

export default ExternalSourceCard;
