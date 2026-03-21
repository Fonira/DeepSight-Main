import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';
import { useScreenDoodleVariant } from '../contexts/DoodleVariantContext';
import { Button } from '../components/ui';
import { GlassCard } from '../components/ui/GlassCard';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import type { RootStackParamList } from '../types';

type LandingScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Landing'>;

const { width } = Dimensions.get('window');

interface FeatureCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  delay: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description, delay }) => {
  const { colors } = useTheme();

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(600)}
      style={styles.featureCard}
    >
      <GlassCard padding="md" borderRadius="lg">
        <View style={styles.featureContent}>
          <View style={[styles.featureIcon, { backgroundColor: `${colors.accentPrimary}20` }]}>
            <Ionicons name={icon} size={24} color={colors.accentPrimary} />
          </View>
          <View style={styles.featureText}>
            <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>
              {title}
            </Text>
            <Text style={[styles.featureDescription, { color: colors.textSecondary }]}>
              {description}
            </Text>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
};

export const LandingScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<LandingScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  useScreenDoodleVariant('creative');

  // Floating animation for logo
  const floatY = useSharedValue(0);
  const glowOpacity = useSharedValue(0.5);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(8, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1500 }),
        withTiming(0.4, { duration: 1500 })
      ),
      -1,
      true
    );
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const handleLogin = () => {
    navigation.navigate('Login');
  };

  const handleRegister = () => {
    navigation.navigate('Register');
  };

  const features = [
    {
      icon: 'videocam' as const,
      title: 'Analyse YouTube & TikTok',
      description: 'Transformez n\'importe quelle vidéo en résumé intelligent',
    },
    {
      icon: 'chatbubbles' as const,
      title: 'Chat IA',
      description: 'Posez des questions sur le contenu analysé',
    },
    {
      icon: 'school' as const,
      title: 'Outils d\'étude',
      description: 'Quiz, flashcards et cartes mentales générés',
    },
    {
      icon: 'globe' as const,
      title: 'Multi-langues',
      description: 'Analysez et exportez dans plusieurs langues',
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          {/* Animated Logo */}
          <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
            <Animated.View style={[styles.logoGlow, glowAnimatedStyle]}>
              <LinearGradient
                colors={[...Colors.gradientPrimary, 'transparent']}
                style={styles.glowGradient}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
              />
            </Animated.View>
            <Image
              source={require('../assets/images/icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>

          {/* Title */}
          <Animated.View entering={FadeInDown.delay(200).duration(600)}>
            <View style={styles.titleContainer}>
              <Text style={[styles.titleDeep, { color: colors.accentPrimary }]}>Deep</Text>
              <Text style={[styles.titleSight, { color: colors.textPrimary }]}>Sight</Text>
            </View>
            <Text style={[styles.tagline, { color: colors.textSecondary }]}>
              L'IA qui transforme les vidéos en savoir
            </Text>
          </Animated.View>

          {/* Platform logos — YouTube & TikTok prominent, Mistral smaller */}
          <Animated.View entering={FadeInDown.delay(350).duration(500)} style={styles.platformRow}>
            <View style={styles.platformBadge}>
              <Image
                source={require('../assets/platforms/youtube-icon-red.png')}
                style={styles.platformIconYt}
                resizeMode="contain"
              />
              <Text style={styles.platformLabelYt}>YouTube</Text>
            </View>
            <View style={[styles.platformSep, { backgroundColor: colors.border }]} />
            <View style={styles.platformBadge}>
              <Image
                source={require('../assets/platforms/tiktok-note-color.png')}
                style={styles.platformIconTk}
                resizeMode="contain"
              />
              <Text style={styles.platformLabelTk}>TikTok</Text>
            </View>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.poweredRow}>
            <Text style={[styles.poweredText, { color: colors.textMuted }]}>Propulsé par</Text>
            <Image
              source={require('../assets/platforms/mistral-logo-white.png')}
              style={[styles.platformMistral, !isDark && { tintColor: '#1a1a2e' }]}
              resizeMode="contain"
            />
            <View style={[styles.poweredSep, { backgroundColor: colors.border }]} />
            <Image
              source={require('../assets/platforms/tournesol-logo.png')}
              style={styles.platformTournesol}
              resizeMode="contain"
            />
            <Text style={[styles.tournesolLabel, { color: colors.textMuted }]}>
              Tournesol
            </Text>
          </Animated.View>
        </View>

        {/* Features Section */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(600)}
          style={styles.featuresSection}
        >
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Fonctionnalités
          </Text>
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              delay={500 + index * 100}
            />
          ))}
        </Animated.View>

        {/* Stats Section */}
        <Animated.View
          entering={FadeInDown.delay(900).duration(600)}
          style={styles.statsSection}
        >
          <GlassCard padding="lg" borderRadius="xl">
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: colors.accentPrimary }]}>100K+</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Vidéos analysées</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: colors.accentPrimary }]}>50K+</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Utilisateurs</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: colors.accentPrimary }]}>4.9</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Note App</Text>
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        {/* CTA Section */}
        <Animated.View
          entering={FadeInUp.delay(1100).duration(600)}
          style={styles.ctaSection}
        >
          <Button
            title="Commencer gratuitement"
            onPress={handleRegister}
            fullWidth
            style={styles.primaryButton}
          />
          <Button
            title="J'ai déjà un compte"
            variant="outline"
            onPress={handleLogin}
            fullWidth
            style={styles.secondaryButton}
          />
        </Animated.View>

        {/* Footer */}
        <Animated.View
          entering={FadeInUp.delay(1300).duration(600)}
          style={styles.footer}
        >
          <Text style={[styles.footerText, { color: colors.textTertiary }]}>
            En continuant, vous acceptez nos conditions d'utilisation
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  logoContainer: {
    position: 'relative',
    marginBottom: Spacing.xl,
  },
  logoGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    top: -30,
    left: -30,
  },
  glowGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 80,
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.xl,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  titleDeep: {
    fontSize: Typography.fontSize['4xl'],
    fontFamily: Typography.fontFamily.display,
  },
  titleSight: {
    fontSize: Typography.fontSize['4xl'],
    fontFamily: Typography.fontFamily.display,
  },
  tagline: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
  },
  featuresSection: {
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.lg,
  },
  featureCard: {
    marginBottom: Spacing.md,
  },
  featureContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.xs,
  },
  featureDescription: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  statsSection: {
    marginBottom: Spacing.xxl,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statNumber: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
  },
  ctaSection: {
    marginBottom: Spacing.xl,
  },
  primaryButton: {
    marginBottom: Spacing.md,
  },
  secondaryButton: {},
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
  },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxl,
    marginTop: Spacing.xl,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  platformIconYt: {
    width: 32,
    height: 32,
  },
  platformLabelYt: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
    color: '#FF0000',
  },
  platformIconTk: {
    width: 28,
    height: 28,
  },
  platformLabelTk: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
    color: '#69C9D0',
  },
  platformSep: {
    width: 1,
    height: 28,
  },
  poweredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.md,
    opacity: 0.6,
    paddingHorizontal: Spacing.lg,
  },
  poweredText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  platformMistral: {
    height: 18,
    width: 70,
  },
  poweredSep: {
    width: 1,
    height: 14,
    marginHorizontal: 4,
  },
  platformTournesol: {
    width: 20,
    height: 20,
  },
  tournesolLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
});

export default LandingScreen;
