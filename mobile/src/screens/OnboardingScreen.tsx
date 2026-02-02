import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  ViewToken,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeInUp,
  SlideInRight,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui';
import {
  OnboardingAnalyzeIllustration,
  OnboardingInsightsIllustration,
  OnboardingChatIllustration,
  OnboardingExportIllustration,
} from '../components/illustrations';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ONBOARDING_KEY = 'deepsight_has_seen_onboarding';

interface OnboardingSlide {
  id: string;
  titleKey: string;
  descriptionKey: string;
  illustration: React.FC<{ size?: number; primaryColor?: string }>;
  gradientColors: readonly [string, string];
}

const slides: OnboardingSlide[] = [
  {
    id: '1',
    titleKey: 'onboarding.slide1Title',
    descriptionKey: 'onboarding.slide1Desc',
    illustration: OnboardingAnalyzeIllustration,
    gradientColors: Colors.gradientPrimary,
  },
  {
    id: '2',
    titleKey: 'onboarding.slide2Title',
    descriptionKey: 'onboarding.slide2Desc',
    illustration: OnboardingInsightsIllustration,
    gradientColors: ['#F59E0B', '#EF4444'] as const,
  },
  {
    id: '3',
    titleKey: 'onboarding.slide3Title',
    descriptionKey: 'onboarding.slide3Desc',
    illustration: OnboardingChatIllustration,
    gradientColors: ['#10B981', '#059669'] as const,
  },
  {
    id: '4',
    titleKey: 'onboarding.slide4Title',
    descriptionKey: 'onboarding.slide4Desc',
    illustration: OnboardingExportIllustration,
    gradientColors: ['#3B82F6', '#6366F1'] as const,
  },
];

// Default translations if not in i18n
const defaultTranslations: Record<string, { title: string; desc: string }> = {
  'onboarding.slide1Title': { title: 'Analysez n\'importe quelle vidéo', desc: '' },
  'onboarding.slide1Desc': { title: '', desc: 'Collez un lien YouTube et laissez l\'IA extraire les informations clés en quelques secondes.' },
  'onboarding.slide2Title': { title: 'Des insights approfondis', desc: '' },
  'onboarding.slide2Desc': { title: '', desc: 'Obtenez des résumés, concepts clés, et analyses détaillées adaptés à votre domaine.' },
  'onboarding.slide3Title': { title: 'Discutez avec le contenu', desc: '' },
  'onboarding.slide3Desc': { title: '', desc: 'Posez des questions sur la vidéo et obtenez des réponses précises avec références.' },
  'onboarding.slide4Title': { title: 'Exportez et partagez', desc: '' },
  'onboarding.slide4Desc': { title: '', desc: 'Sauvegardez vos analyses, créez des playlists et partagez vos découvertes.' },
};

interface OnboardingScreenProps {
  onComplete: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useSharedValue(0);

  const handleComplete = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
    onComplete();
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleComplete();
  };

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    []
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const getTranslation = (key: string): string => {
    // Try to get from i18n first
    const parts = key.split('.');
    let value: any = t;
    for (const part of parts) {
      value = value?.[part];
    }
    if (typeof value === 'string') return value;

    // Fall back to defaults
    const defaultValue = defaultTranslations[key];
    if (key.includes('Title')) return defaultValue?.title || key;
    if (key.includes('Desc')) return defaultValue?.desc || key;
    return key;
  };

  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => {
    const Illustration = item.illustration;

    return (
      <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
        <Animated.View 
          entering={FadeIn.delay(200)}
          style={styles.illustrationContainer}
        >
          <Illustration size={SCREEN_WIDTH * 0.7} primaryColor={item.gradientColors[0]} />
        </Animated.View>

        <Animated.View 
          entering={FadeInUp.delay(300)}
          style={styles.textContainer}
        >
          <LinearGradient
            colors={item.gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.titleGradient}
          >
            <Text style={styles.title}>
              {getTranslation(item.titleKey)}
            </Text>
          </LinearGradient>
          
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {getTranslation(item.descriptionKey)}
          </Text>
        </Animated.View>
      </View>
    );
  };

  // Pagination dots
  const PaginationDots = () => (
    <View style={styles.pagination}>
      {slides.map((_, index) => {
        const dotStyle = useAnimatedStyle(() => {
          const inputRange = [
            (index - 1) * SCREEN_WIDTH,
            index * SCREEN_WIDTH,
            (index + 1) * SCREEN_WIDTH,
          ];

          const width = interpolate(
            scrollX.value,
            inputRange,
            [8, 24, 8],
            Extrapolation.CLAMP
          );

          const opacity = interpolate(
            scrollX.value,
            inputRange,
            [0.3, 1, 0.3],
            Extrapolation.CLAMP
          );

          return {
            width,
            opacity,
          };
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              { backgroundColor: slides[index].gradientColors[0] },
              dotStyle,
            ]}
          />
        );
      })}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Skip button */}
      <Animated.View 
        entering={FadeIn.delay(500)}
        style={[styles.skipContainer, { paddingTop: insets.top + Spacing.md }]}
      >
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>
            {t.common?.skip || 'Passer'}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScroll={(event) => {
          scrollX.value = event.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
        bounces={false}
      />

      {/* Bottom section */}
      <Animated.View 
        entering={FadeInUp.delay(400)}
        style={[styles.bottomContainer, { paddingBottom: insets.bottom + Spacing.lg }]}
      >
        <PaginationDots />

        <View style={styles.buttonContainer}>
          <Button
            title={currentIndex === slides.length - 1 
              ? (t.common?.start || 'Commencer') 
              : (t.common?.next || 'Suivant')}
            onPress={handleNext}
            size="lg"
            fullWidth
            icon={
              currentIndex === slides.length - 1 
                ? undefined 
                : <Text style={{ color: 'white' }}>→</Text>
            }
            iconPosition="right"
          />
        </View>

        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBackground, { backgroundColor: colors.bgElevated }]}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: `${((currentIndex + 1) / slides.length) * 100}%`,
                  backgroundColor: slides[currentIndex].gradientColors[0],
                },
              ]}
            />
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

// Hook to check if user has seen onboarding
export const useOnboardingStatus = () => {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const value = await AsyncStorage.getItem(ONBOARDING_KEY);
        setHasSeenOnboarding(value === 'true');
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
        setHasSeenOnboarding(true); // Default to true on error
      } finally {
        setIsLoading(false);
      }
    };
    checkOnboarding();
  }, []);

  const markAsSeen = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      setHasSeenOnboarding(true);
    } catch (error) {
      console.error('Failed to mark onboarding as seen:', error);
    }
  };

  const reset = async () => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_KEY);
      setHasSeenOnboarding(false);
    } catch (error) {
      console.error('Failed to reset onboarding:', error);
    }
  };

  return { hasSeenOnboarding, isLoading, markAsSeen, reset };
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: Spacing.lg,
  },
  skipButton: {
    padding: Spacing.md,
  },
  skipText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  illustrationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
  },
  textContainer: {
    alignItems: 'center',
    paddingBottom: Spacing.xxxl,
  },
  titleGradient: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.fontSize.xxl,
    fontFamily: Typography.fontFamily.bodySemiBold,
    color: 'white',
    textAlign: 'center',
  },
  description: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    lineHeight: Typography.fontSize.base * Typography.lineHeight.relaxed,
    paddingHorizontal: Spacing.lg,
  },
  bottomContainer: {
    paddingHorizontal: Spacing.xxl,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  buttonContainer: {
    marginBottom: Spacing.lg,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressBackground: {
    width: '60%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
});

export default OnboardingScreen;
