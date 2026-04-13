import React, { useCallback, useRef } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PagerView from "react-native-pager-view";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  SharedValue,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/contexts/ThemeContext";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize, textStyles } from "@/theme/typography";
import { palette } from "@/theme/colors";
import { springs } from "@/theme/animations";
import { DoodleBackground } from "@/components/ui/DoodleBackground";

const NUM_SLIDES = 4;

interface SlideData {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  description: string;
}

const slides: SlideData[] = [
  {
    icon: "logo-deepsight" as any, // replaced by logo image in SlideItem
    iconColor: palette.blue,
    title: "Colle un lien YouTube ou TikTok",
    description:
      "Copie-colle simplement le lien de ta vidéo et laisse DeepSight faire le reste.",
  },
  {
    icon: "sparkles-outline",
    iconColor: palette.violet,
    title: "L'IA comprend et vérifie",
    description:
      "Résumés sourcés, vérification des faits et analyse critique. DeepSight ne répète pas, il vérifie.",
  },
  {
    icon: "book-outline",
    iconColor: palette.cyan,
    title: "Révise efficacement",
    description:
      "Quiz, cartes mentales et flashcards générés automatiquement pour mieux retenir.",
  },
  {
    icon: "chatbubbles-outline",
    iconColor: palette.indigo,
    title: "Discute avec le contenu",
    description:
      "Pose des questions sur la vidéo et obtiens des réponses précises avec références. Ton assistant d'étude personnel.",
  },
];

function Dot({
  index,
  activeIndex,
}: {
  index: number;
  activeIndex: SharedValue<number>;
}) {
  const { colors } = useTheme();

  const animatedStyle = useAnimatedStyle(() => {
    const isActive = Math.round(activeIndex.value) === index;
    return {
      width: withSpring(isActive ? 24 : 8, springs.button),
      opacity: withSpring(isActive ? 1 : 0.4, springs.button),
      backgroundColor: isActive ? palette.indigo : colors.textMuted,
    };
  });

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

function SlideItem({
  data,
  index,
  activeIndex,
}: {
  data: SlideData;
  index: number;
  activeIndex: SharedValue<number>;
}) {
  const { colors } = useTheme();

  const iconAnimatedStyle = useAnimatedStyle(() => {
    const offset = activeIndex.value - index;
    const translateX = interpolate(
      offset,
      [-1, 0, 1],
      [-30, 0, 30],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      offset,
      [-1, 0, 1],
      [0.8, 1, 0.8],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ translateX }, { scale }],
    };
  });

  const isFirstSlide = index === 0;

  return (
    <View style={styles.slide}>
      <Animated.View
        style={[
          styles.iconContainer,
          { backgroundColor: `${data.iconColor}15` },
          iconAnimatedStyle,
        ]}
      >
        {isFirstSlide ? (
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.logoIcon}
            resizeMode="contain"
          />
        ) : (
          <Ionicons name={data.icon} size={48} color={data.iconColor} />
        )}
      </Animated.View>
      <Text style={[styles.slideTitle, { color: colors.textPrimary }]}>
        {data.title}
      </Text>
      <Text style={[styles.slideDescription, { color: colors.textSecondary }]}>
        {data.description}
      </Text>
    </View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const activeIndex = useSharedValue(0);
  const pagerRef = useRef<PagerView>(null);

  const handlePageSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      activeIndex.value = e.nativeEvent.position;
    },
    [activeIndex],
  );

  const handleLogin = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(auth)/login");
  }, [router]);

  const handleRegister = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(auth)/register");
  }, [router]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bgPrimary }]}
    >
      <DoodleBackground variant="creative" density="low" />
      {/* Logo */}
      <View style={styles.logoSection}>
        <Text style={[styles.logo, { color: colors.textPrimary }]}>
          DeepSight
        </Text>
        <Text style={[styles.tagline, { color: colors.textTertiary }]}>
          Analyse vidéo par IA
        </Text>
        {/* Platform logos — YouTube & TikTok prominent */}
        <View style={styles.platformRow}>
          <View style={styles.platformBadge}>
            <Image
              source={require("@/assets/platforms/youtube-icon-red.png")}
              style={styles.platformIconYt}
              resizeMode="contain"
            />
            <Text style={styles.platformLabelYt}>YouTube</Text>
          </View>
          <View
            style={[styles.platformSep, { backgroundColor: colors.border }]}
          />
          <View style={styles.platformBadge}>
            <Image
              source={require("@/assets/platforms/tiktok-note-color.png")}
              style={styles.platformIconTk}
              resizeMode="contain"
            />
            <Text style={styles.platformLabelTk}>TikTok</Text>
          </View>
        </View>
        {/* Mistral + Tournesol — smaller, separate row */}
        <View style={styles.poweredRow}>
          <Text style={[styles.poweredText, { color: colors.textMuted }]}>
            Propulsé par
          </Text>
          <Image
            source={require("@/assets/platforms/mistral-logo-white.png")}
            style={[styles.mistralLogo, !isDark && { tintColor: "#1a1a2e" }]}
            resizeMode="contain"
          />
          <View
            style={[styles.poweredSep, { backgroundColor: colors.border }]}
          />
          <Image
            source={require("@/assets/platforms/tournesol-logo.png")}
            style={styles.tournesolLogo}
            resizeMode="contain"
          />
          <Text style={[styles.tournesolLabel, { color: colors.textMuted }]}>
            Tournesol
          </Text>
        </View>
      </View>

      {/* Pager */}
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={handlePageSelected}
      >
        {slides.map((slide, i) => (
          <View key={i} collapsable={false}>
            <SlideItem data={slide} index={i} activeIndex={activeIndex} />
          </View>
        ))}
      </PagerView>

      {/* Dots */}
      <View style={styles.dotsContainer}>
        {slides.map((_, i) => (
          <Dot key={i} index={i} activeIndex={activeIndex} />
        ))}
      </View>

      {/* CTA Buttons */}
      <View style={styles.buttonSection}>
        <Button
          title="Se connecter"
          variant="primary"
          size="lg"
          fullWidth
          onPress={handleLogin}
        />
        <Button
          title="Créer un compte"
          variant="outline"
          size="lg"
          fullWidth
          onPress={handleRegister}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  logoSection: {
    alignItems: "center",
    paddingTop: sp["3xl"],
    marginBottom: sp.xl,
  },
  logo: {
    fontFamily: fontFamily.display,
    fontSize: fontSize["4xl"],
    marginBottom: sp.xs,
  },
  tagline: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    letterSpacing: 0.5,
  },
  platformRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sp["2xl"],
    marginTop: sp.xl,
  },
  platformBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
  },
  platformIconYt: {
    width: 30,
    height: 30,
  },
  platformLabelYt: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    color: "#FF0000",
  },
  platformIconTk: {
    width: 26,
    height: 26,
  },
  platformLabelTk: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    color: "#69C9D0",
  },
  platformSep: {
    width: 1,
    height: 24,
    opacity: 0.3,
  },
  poweredRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sp.sm,
    marginTop: sp.md,
    opacity: 0.5,
  },
  poweredText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  mistralLogo: {
    height: 18,
    width: 70,
  },
  poweredSep: {
    width: 1,
    height: 14,
    opacity: 0.3,
  },
  tournesolLogo: {
    width: 18,
    height: 18,
  },
  tournesolLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },
  pager: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: sp["3xl"],
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: borderRadius["2xl"],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: sp["3xl"],
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.xl,
  },
  slideTitle: {
    ...textStyles.headingLg,
    textAlign: "center",
    marginBottom: sp.md,
  },
  slideDescription: {
    ...textStyles.bodyMd,
    textAlign: "center",
    lineHeight: fontSize.base * 1.6,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: sp.sm,
    marginBottom: sp["3xl"],
  },
  dot: {
    height: 8,
    borderRadius: borderRadius.full,
  },
  buttonSection: {
    paddingHorizontal: sp.lg,
    paddingBottom: sp["3xl"],
    gap: sp.md,
  },
});
