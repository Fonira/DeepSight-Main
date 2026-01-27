/**
 * FreeTrialLimitModal - Modal pour les utilisateurs gratuits approchant/atteignant la limite
 *
 * S'affiche:
 * - Après la 2ème analyse (warning): encourage à upgrade
 * - Après la 3ème analyse (blocked): bloque et propose l'upgrade
 *
 * Éléments de conversion:
 * - Barre de progression (X/3 analyses)
 * - Affichage du temps économisé
 * - Bannière Pro trial (7 jours)
 * - Grille de bénéfices (4 items)
 * - Témoignages rotatifs avec indicateurs
 * - CTA: "Voir les plans", "Plus tard"
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';
import type { RootStackParamList } from '../../types';
import {
  CONVERSION_TRIGGERS,
  TESTIMONIALS,
  PRO_BENEFITS,
  calculateTimeSaved,
  type Testimonial,
} from '../../config/planPrivileges';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FreeTrialLimitModalProps {
  visible: boolean;
  onClose: () => void;
  analysesUsed: number;
  lastVideoDuration?: number; // seconds
  onStartTrial?: () => void;
  onUpgrade?: () => void;
}

type ModalState = 'warning' | 'blocked';

export const FreeTrialLimitModal: React.FC<FreeTrialLimitModalProps> = ({
  visible,
  onClose,
  analysesUsed,
  lastVideoDuration = 0,
  onStartTrial,
  onUpgrade,
}) => {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const navigation = useNavigation<NavigationProp>();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Testimonial carousel
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  // Determine modal state
  const modalState: ModalState = analysesUsed >= CONVERSION_TRIGGERS.freeAnalysisLimit
    ? 'blocked'
    : 'warning';

  // Calculate time saved
  const timeSaved = lastVideoDuration > 0 ? calculateTimeSaved(lastVideoDuration) : null;

  // Entry animation
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(progressAnim, {
          toValue: analysesUsed / CONVERSION_TRIGGERS.freeAnalysisLimit,
          duration: 800,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
      progressAnim.setValue(0);
    }
  }, [visible, analysesUsed]);

  // Testimonial auto-rotate
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      setCurrentTestimonial(prev => (prev + 1) % TESTIMONIALS.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [visible]);

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    if (onUpgrade) {
      onUpgrade();
    } else {
      navigation.navigate('Upgrade');
    }
  };

  const handleStartTrial = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onStartTrial?.();
    onClose();
  };

  const handleClose = () => {
    if (modalState === 'blocked') {
      // Can't dismiss when blocked
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.selectionAsync();
    onClose();
  };

  const testimonial = TESTIMONIALS[currentTestimonial];

  // Progress bar width animation
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            {
              backgroundColor: colors.bgPrimary,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Close button (only in warning state) */}
            {modalState === 'warning' && (
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: colors.bgTertiary }]}
                onPress={handleClose}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}

            {/* Header with icon */}
            <View style={[
              styles.headerIcon,
              {
                backgroundColor: modalState === 'blocked'
                  ? `${colors.accentError}20`
                  : `${colors.accentWarning}20`,
              },
            ]}>
              <Ionicons
                name={modalState === 'blocked' ? 'lock-closed' : 'gift'}
                size={40}
                color={modalState === 'blocked' ? colors.accentError : colors.accentWarning}
              />
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {modalState === 'blocked'
                ? (language === 'fr' ? 'Limite atteinte' : 'Limit reached')
                : (language === 'fr' ? 'Vous y êtes presque !' : 'You\'re almost there!')}
            </Text>

            {/* Subtitle */}
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {modalState === 'blocked'
                ? (language === 'fr'
                    ? 'Vous avez utilisé vos 3 analyses gratuites ce mois-ci.'
                    : 'You\'ve used your 3 free analyses this month.')
                : (language === 'fr'
                    ? `Plus qu'${CONVERSION_TRIGGERS.freeAnalysisLimit - analysesUsed} analyse gratuite ce mois-ci.`
                    : `Only ${CONVERSION_TRIGGERS.freeAnalysisLimit - analysesUsed} free analysis left this month.`)}
            </Text>

            {/* Progress bar */}
            <View style={[styles.progressContainer, { backgroundColor: colors.bgSecondary }]}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                  {language === 'fr' ? 'Analyses utilisées' : 'Analyses used'}
                </Text>
                <Text style={[
                  styles.progressValue,
                  { color: modalState === 'blocked' ? colors.accentError : colors.accentWarning },
                ]}>
                  {analysesUsed} / {CONVERSION_TRIGGERS.freeAnalysisLimit}
                </Text>
              </View>
              <View style={[styles.progressBar, { backgroundColor: colors.bgTertiary }]}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: modalState === 'blocked'
                        ? colors.accentError
                        : colors.accentWarning,
                      width: progressWidth,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Time saved display */}
            {timeSaved && timeSaved.minutes > 0 && (
              <View style={[styles.timeSavedCard, { backgroundColor: `${colors.accentSuccess}15` }]}>
                <Ionicons name="time-outline" size={24} color={colors.accentSuccess} />
                <View style={styles.timeSavedContent}>
                  <Text style={[styles.timeSavedValue, { color: colors.accentSuccess }]}>
                    {timeSaved.minutes} {language === 'fr' ? 'min' : 'min'}
                  </Text>
                  <Text style={[styles.timeSavedLabel, { color: colors.textSecondary }]}>
                    {language === 'fr' ? 'économisées avec cette analyse' : 'saved with this analysis'}
                  </Text>
                </View>
              </View>
            )}

            {/* Pro Trial banner */}
            {CONVERSION_TRIGGERS.trialEnabled && onStartTrial && (
              <TouchableOpacity onPress={handleStartTrial} activeOpacity={0.9}>
                <LinearGradient
                  colors={['#8B5CF6', '#7C3AED']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.trialBanner}
                >
                  <View style={styles.trialBannerContent}>
                    <View style={styles.trialBadge}>
                      <Ionicons name="star" size={16} color="#FFFFFF" />
                      <Text style={styles.trialBadgeText}>PRO</Text>
                    </View>
                    <Text style={styles.trialTitle}>
                      {language === 'fr'
                        ? `Essayez Pro gratuitement ${CONVERSION_TRIGGERS.trialDays} jours`
                        : `Try Pro free for ${CONVERSION_TRIGGERS.trialDays} days`}
                    </Text>
                    <Text style={styles.trialSubtitle}>
                      {language === 'fr'
                        ? 'Sans carte bancaire requise'
                        : 'No credit card required'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Benefits grid */}
            <View style={styles.benefitsGrid}>
              {PRO_BENEFITS.map((benefit, index) => (
                <View
                  key={index}
                  style={[styles.benefitItem, { backgroundColor: colors.bgSecondary }]}
                >
                  <View style={[styles.benefitIcon, { backgroundColor: `${colors.accentPrimary}15` }]}>
                    <Ionicons
                      name={benefit.icon as keyof typeof Ionicons.glyphMap}
                      size={20}
                      color={colors.accentPrimary}
                    />
                  </View>
                  <Text style={[styles.benefitTitle, { color: colors.textPrimary }]}>
                    {language === 'fr' ? benefit.title.fr : benefit.title.en}
                  </Text>
                  <Text style={[styles.benefitDesc, { color: colors.textTertiary }]} numberOfLines={2}>
                    {language === 'fr' ? benefit.description.fr : benefit.description.en}
                  </Text>
                </View>
              ))}
            </View>

            {/* Testimonial carousel */}
            <View style={[styles.testimonialCard, { backgroundColor: colors.bgSecondary }]}>
              <View style={styles.testimonialHeader}>
                <View style={styles.testimonialAvatar}>
                  <Text style={styles.testimonialAvatarText}>
                    {testimonial.name.charAt(0)}
                  </Text>
                </View>
                <View style={styles.testimonialInfo}>
                  <Text style={[styles.testimonialName, { color: colors.textPrimary }]}>
                    {testimonial.name}
                  </Text>
                  <Text style={[styles.testimonialRole, { color: colors.textTertiary }]}>
                    {language === 'fr' ? testimonial.role.fr : testimonial.role.en}
                  </Text>
                </View>
                <View style={styles.ratingContainer}>
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Ionicons key={i} name="star" size={12} color="#F59E0B" />
                  ))}
                </View>
              </View>
              <Text style={[styles.testimonialQuote, { color: colors.textSecondary }]}>
                "{language === 'fr' ? testimonial.quote.fr : testimonial.quote.en}"
              </Text>

              {/* Carousel indicators */}
              <View style={styles.carouselIndicators}>
                {TESTIMONIALS.map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setCurrentTestimonial(index)}
                    style={[
                      styles.indicator,
                      {
                        backgroundColor: index === currentTestimonial
                          ? colors.accentPrimary
                          : colors.bgTertiary,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>

            {/* CTA Buttons */}
            <View style={styles.actions}>
              {/* Primary: View plans */}
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.accentPrimary }]}
                onPress={handleUpgrade}
              >
                <Ionicons name="rocket-outline" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>
                  {language === 'fr' ? 'Voir les plans' : 'View plans'}
                </Text>
              </TouchableOpacity>

              {/* Secondary: Maybe later (only in warning state) */}
              {modalState === 'warning' && (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleClose}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.textTertiary }]}>
                    {language === 'fr' ? 'Plus tard' : 'Maybe later'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: Spacing.xl,
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  headerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bodySemiBold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: Typography.fontSize.sm * 1.5,
  },
  progressContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  progressLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  progressValue: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  timeSavedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  timeSavedContent: {
    flex: 1,
  },
  timeSavedValue: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  timeSavedLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  trialBannerContent: {
    flex: 1,
  },
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.xs,
  },
  trialBadgeText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  trialTitle: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  trialSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  benefitItem: {
    width: (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md * 2 - Spacing.sm) / 2,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  benefitTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
    textAlign: 'center',
    marginBottom: 2,
  },
  benefitDesc: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    lineHeight: Typography.fontSize.xs * 1.3,
  },
  testimonialCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  testimonialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  testimonialAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  testimonialAvatarText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  testimonialInfo: {
    flex: 1,
  },
  testimonialName: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  testimonialRole: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  testimonialQuote: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    fontStyle: 'italic',
    lineHeight: Typography.fontSize.sm * 1.5,
  },
  carouselIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  actions: {
    gap: Spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  secondaryButtonText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
});

export default FreeTrialLimitModal;
