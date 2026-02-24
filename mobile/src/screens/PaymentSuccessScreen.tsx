/**
 * PaymentSuccessScreen - Confirmation de paiement réussi
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenDoodleVariant } from '../contexts/DoodleVariantContext';
import { useAuth } from '../contexts/AuthContext';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { getFeatureListForDisplay, normalizePlanId, type PlanId } from '../config/planPrivileges';
import type { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type PaymentSuccessRouteProp = RouteProp<RootStackParamList, 'PaymentSuccess'>;

export const PaymentSuccessScreen: React.FC = () => {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const { refreshUser } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<PaymentSuccessRouteProp>();
  const insets = useSafeAreaInsets();
  useScreenDoodleVariant('creative');

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;

  const planName = route.params?.planName || 'Pro';

  useEffect(() => {
    // Haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Refresh user data
    refreshUser?.();

    // Animations
    Animated.sequence([
      // Scale in the circle
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 50,
        useNativeDriver: true,
      }),
      // Draw checkmark
      Animated.timing(checkAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      // Fade in content
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleGoToDashboard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  };

  const handleViewAccount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Account');
  };

  return (
    <View style={[styles.container, { backgroundColor: 'transparent', paddingTop: insets.top }]}>
      {/* Success Icon */}
      <Animated.View
        style={[
          styles.iconContainer,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <View style={[styles.iconCircle, { backgroundColor: `${colors.accentSuccess}20` }]}>
          <Animated.View style={{ opacity: checkAnim }}>
            <Ionicons name="checkmark" size={64} color={colors.accentSuccess} />
          </Animated.View>
        </View>
      </Animated.View>

      {/* Content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {language === 'fr' ? 'Paiement réussi !' : 'Payment successful!'}
        </Text>

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {language === 'fr'
            ? `Bienvenue dans le plan ${planName}`
            : `Welcome to the ${planName} plan`}
        </Text>

        {/* Plan benefits */}
        <View style={[styles.benefitsCard, { backgroundColor: colors.bgElevated }]}>
          <Text style={[styles.benefitsTitle, { color: colors.textPrimary }]}>
            {language === 'fr' ? 'Vos nouveaux avantages' : 'Your new benefits'}
          </Text>

          <View style={styles.benefitsList}>
            {getBenefits(planName, language).map((benefit, index) => (
              <View key={index} style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={20} color={colors.accentSuccess} />
                <Text style={[styles.benefitText, { color: colors.textSecondary }]}>
                  {benefit}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Next steps */}
        <View style={[styles.nextStepsCard, { backgroundColor: `${colors.accentPrimary}10` }]}>
          <Ionicons name="rocket-outline" size={24} color={colors.accentPrimary} />
          <Text style={[styles.nextStepsText, { color: colors.textSecondary }]}>
            {language === 'fr'
              ? 'Commencez à analyser des vidéos dès maintenant !'
              : 'Start analyzing videos right now!'}
          </Text>
        </View>
      </Animated.View>

      {/* Actions */}
      <Animated.View style={[styles.actions, { opacity: fadeAnim, paddingBottom: insets.bottom + Spacing.lg }]}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.accentPrimary }]}
          onPress={handleGoToDashboard}
        >
          <Ionicons name="home-outline" size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>
            {language === 'fr' ? 'Aller au tableau de bord' : 'Go to Dashboard'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: colors.border }]}
          onPress={handleViewAccount}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
            {language === 'fr' ? 'Voir mon compte' : 'View my account'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

// Get benefits based on plan — dynamique depuis planPrivileges (source de vérité unique)
function getBenefits(plan: string, lang: string): string[] {
  const planId = normalizePlanId(plan as any) as PlanId;
  const locale = lang === 'fr' ? 'fr' : 'en';
  const features = getFeatureListForDisplay(planId, locale);
  // Retourner les 5 premières features incluses
  return features
    .filter(f => f.included)
    .slice(0, 5)
    .map(f => f.text);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: Spacing.xxl,
    marginBottom: Spacing.xl,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  title: {
    fontSize: Typography.fontSize.xxl,
    fontFamily: Typography.fontFamily.bodySemiBold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  benefitsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  benefitsTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.md,
  },
  benefitsList: {
    gap: Spacing.sm,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  benefitText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  nextStepsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  nextStepsText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  actions: {
    paddingHorizontal: Spacing.lg,
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
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
  },
});

export default PaymentSuccessScreen;
