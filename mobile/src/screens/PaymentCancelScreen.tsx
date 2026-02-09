/**
 * PaymentCancelScreen - Annulation de paiement
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import type { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const PaymentCancelScreen: React.FC = () => {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const handleRetryPayment = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('Upgrade');
  };

  const handleGoBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleContactSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL('mailto:support@deepsight.app');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary, paddingTop: insets.top }]}>
      {/* Icon */}
      <View style={styles.iconContainer}>
        <View style={[styles.iconCircle, { backgroundColor: `${colors.textTertiary}20` }]}>
          <Ionicons name="close-outline" size={64} color={colors.textTertiary} />
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {language === 'fr' ? 'Paiement annulé' : 'Payment cancelled'}
        </Text>

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {language === 'fr'
            ? 'Votre paiement a été annulé. Aucun montant n\'a été débité.'
            : 'Your payment was cancelled. No amount was charged.'}
        </Text>

        {/* Reasons card */}
        <View style={[styles.infoCard, { backgroundColor: colors.bgElevated }]}>
          <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>
            {language === 'fr' ? 'Besoin d\'aide ?' : 'Need help?'}
          </Text>

          <View style={styles.reasonsList}>
            <View style={styles.reasonRow}>
              <Ionicons name="help-circle-outline" size={20} color={colors.textTertiary} />
              <Text style={[styles.reasonText, { color: colors.textSecondary }]}>
                {language === 'fr'
                  ? 'Des questions sur nos offres ?'
                  : 'Questions about our plans?'}
              </Text>
            </View>
            <View style={styles.reasonRow}>
              <Ionicons name="card-outline" size={20} color={colors.textTertiary} />
              <Text style={[styles.reasonText, { color: colors.textSecondary }]}>
                {language === 'fr'
                  ? 'Problème avec le paiement ?'
                  : 'Payment issues?'}
              </Text>
            </View>
            <View style={styles.reasonRow}>
              <Ionicons name="chatbubble-outline" size={20} color={colors.textTertiary} />
              <Text style={[styles.reasonText, { color: colors.textSecondary }]}>
                {language === 'fr'
                  ? 'Contactez notre support'
                  : 'Contact our support'}
              </Text>
            </View>
          </View>
        </View>

        {/* Free tier reminder */}
        <View style={[styles.freeCard, { backgroundColor: `${colors.accentInfo}10` }]}>
          <Ionicons name="gift-outline" size={24} color={colors.accentInfo} />
          <View style={styles.freeCardContent}>
            <Text style={[styles.freeCardTitle, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'Continuez gratuitement' : 'Continue for free'}
            </Text>
            <Text style={[styles.freeCardText, { color: colors.textSecondary }]}>
              {language === 'fr'
                ? 'Vous pouvez toujours utiliser DeepSight avec le plan gratuit'
                : 'You can still use DeepSight with the free plan'}
            </Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.accentPrimary }]}
          onPress={handleRetryPayment}
        >
          <Ionicons name="card-outline" size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>
            {language === 'fr' ? 'Réessayer le paiement' : 'Retry payment'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: colors.border }]}
          onPress={handleGoBack}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
            {language === 'fr' ? 'Retour' : 'Go back'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

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
  infoCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  infoTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.md,
  },
  reasonsList: {
    gap: Spacing.sm,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  reasonText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  freeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  freeCardContent: {
    flex: 1,
  },
  freeCardTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: 2,
  },
  freeCardText: {
    fontSize: Typography.fontSize.xs,
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

export default PaymentCancelScreen;
