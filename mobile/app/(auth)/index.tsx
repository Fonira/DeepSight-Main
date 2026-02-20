import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { sp, borderRadius } from '@/theme/spacing';
import { fontFamily, fontSize, textStyles } from '@/theme/typography';
import { palette } from '@/theme/colors';
import { springs } from '@/theme/animations';
import { DoodleBackground } from '@/components/ui/DoodleBackground';

const NUM_SLIDES = 3;

interface SlideData {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  description: string;
}

const slides: SlideData[] = [
  {
    icon: 'link-outline',
    iconColor: palette.blue,
    title: 'Colle un lien YouTube',
    description: 'Copie-colle simplement le lien de ta vidéo et laisse DeepSight faire le reste.',
  },
  {
    icon: 'sparkles-outline',
    iconColor: palette.violet,
    title: "L'IA analyse pour toi",
    description: 'Résumés intelligents, vérification des faits et analyse épistémique en quelques secondes.',
  },
  {
    icon: 'book-outline',
    iconColor: palette.cyan,
    title: 'Révise avec des flashcards',
    description: 'Quiz, cartes mentales et flashcards générés automatiquement pour mieux retenir.',
  },
];

function Dot({ index, activeIndex }: { index: number; activeIndex: SharedValue<number> }) {
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

function SlideItem({ data, index, activeIndex }: { data: SlideData; index: number; activeIndex: SharedValue<number> }) {
  const { colors } = useTheme();

  const iconAnimatedStyle = useAnimatedStyle(() => {
    const offset = activeIndex.value - index;
    const translateX = interpolate(offset, [-1, 0, 1], [-30, 0, 30], Extrapolation.CLAMP);
    const scale = interpolate(offset, [-1, 0, 1], [0.8, 1, 0.8], Extrapolation.CLAMP);
    return {
      transform: [{ translateX }, { scale }],
    };
  });

  return (
    <View style={styles.slide}>
      <Animated.View style={[styles.iconContainer, { backgroundColor: `${data.iconColor}15` }, iconAnimatedStyle]}>
        <Ionicons name={data.icon} size={48} color={data.iconColor} />
      </Animated.View>
      <Text style={[styles.slideTitle, { color: colors.textPrimary }]}>{data.title}</Text>
      <Text style={[styles.slideDescription, { color: colors.textSecondary }]}>{data.description}</Text>
    </View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
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
    router.push('/(auth)/login');
  }, [router]);

  const handleRegister = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(auth)/register');
  }, [router]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <DoodleBackground variant="creative" density="low" />
      {/* Logo */}
      <View style={styles.logoSection}>
        <Text style={[styles.logo, { color: colors.textPrimary }]}>DeepSight</Text>
        <Text style={[styles.tagline, { color: colors.textTertiary }]}>
          Analyse vidéo par IA
        </Text>
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
    alignItems: 'center',
    paddingTop: sp['3xl'],
    marginBottom: sp.xl,
  },
  logo: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['4xl'],
    marginBottom: sp.xs,
  },
  tagline: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    letterSpacing: 0.5,
  },
  pager: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: sp['3xl'],
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: borderRadius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sp['3xl'],
  },
  slideTitle: {
    ...textStyles.headingLg,
    textAlign: 'center',
    marginBottom: sp.md,
  },
  slideDescription: {
    ...textStyles.bodyMd,
    textAlign: 'center',
    lineHeight: fontSize.base * 1.6,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: sp.sm,
    marginBottom: sp['3xl'],
  },
  dot: {
    height: 8,
    borderRadius: borderRadius.full,
  },
  buttonSection: {
    paddingHorizontal: sp.lg,
    paddingBottom: sp['3xl'],
    gap: sp.md,
  },
});
