/**
 * UpgradePromptModal - Modal contextuel pour suggérer l'upgrade
 * S'affiche quand l'utilisateur atteint une limite
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';
import { PLAN_LIMITS, type PlanId } from '../../config/planPrivileges';
import type { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type LimitType =
  | 'credits'
  | 'chat'
  | 'analysis'
  | 'playlist'
  | 'export'
  | 'webSearch'
  | 'tts';

interface UpgradePromptModalProps {
  visible: boolean;
  onClose: () => void;
  limitType: LimitType;
  currentUsage?: number;
  maxAllowed?: number;
  showTrialOption?: boolean;
  onStartTrial?: () => void;
}

// Génère les features dynamiques depuis planPrivileges pour le plan recommandé
function getLimitFeatures(planId: PlanId, lang: 'fr' | 'en'): string[] {
  const l = PLAN_LIMITS[planId];
  if (lang === 'fr') {
    return [
      `${l.monthlyCredits.toLocaleString()} crédits/mois`,
      `${l.monthlyAnalyses} analyses/mois`,
      l.maxVideoDuration === -1 ? 'Vidéos illimitées' : `Vidéos jusqu'à ${Math.round(l.maxVideoDuration / 3600)}h`,
    ];
  }
  return [
    `${l.monthlyCredits.toLocaleString()} credits/month`,
    `${l.monthlyAnalyses} analyses/month`,
    l.maxVideoDuration === -1 ? 'Unlimited videos' : `Videos up to ${Math.round(l.maxVideoDuration / 3600)}h`,
  ];
}

const LIMIT_CONFIG: Record<LimitType, {
  icon: keyof typeof Ionicons.glyphMap;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  featuresFr: string[];
  featuresEn: string[];
  recommendedPlan: PlanId;
}> = {
  credits: {
    icon: 'wallet-outline',
    titleFr: 'Crédits épuisés',
    titleEn: 'Out of credits',
    descriptionFr: 'Vous avez utilisé tous vos crédits mensuels.',
    descriptionEn: 'You have used all your monthly credits.',
    featuresFr: getLimitFeatures('pro', 'fr'),
    featuresEn: getLimitFeatures('pro', 'en'),
    recommendedPlan: 'pro',
  },
  chat: {
    icon: 'chatbubble-outline',
    titleFr: 'Limite de chat atteinte',
    titleEn: 'Chat limit reached',
    descriptionFr: 'Vous avez atteint votre limite quotidienne de questions.',
    descriptionEn: 'You have reached your daily question limit.',
    featuresFr: getLimitFeatures('pro', 'fr'),
    featuresEn: getLimitFeatures('pro', 'en'),
    recommendedPlan: 'pro',
  },
  analysis: {
    icon: 'analytics-outline',
    titleFr: 'Limite d\'analyses atteinte',
    titleEn: 'Analysis limit reached',
    descriptionFr: 'Vous avez atteint votre limite mensuelle d\'analyses.',
    descriptionEn: 'You have reached your monthly analysis limit.',
    featuresFr: getLimitFeatures('pro', 'fr'),
    featuresEn: getLimitFeatures('pro', 'en'),
    recommendedPlan: 'pro',
  },
  playlist: {
    icon: 'list-outline',
    titleFr: 'Analyse de playlist indisponible',
    titleEn: 'Playlist analysis unavailable',
    descriptionFr: 'L\'analyse de playlists nécessite un plan supérieur.',
    descriptionEn: 'Playlist analysis requires a higher plan.',
    featuresFr: getLimitFeatures('pro', 'fr'),
    featuresEn: getLimitFeatures('pro', 'en'),
    recommendedPlan: 'pro',
  },
  export: {
    icon: 'download-outline',
    titleFr: 'Exports limités',
    titleEn: 'Limited exports',
    descriptionFr: 'Accédez à plus de formats d\'export.',
    descriptionEn: 'Access more export formats.',
    featuresFr: getLimitFeatures('starter', 'fr'),
    featuresEn: getLimitFeatures('starter', 'en'),
    recommendedPlan: 'starter',
  },
  webSearch: {
    icon: 'globe-outline',
    titleFr: 'Recherche web limitée',
    titleEn: 'Limited web search',
    descriptionFr: 'Augmentez votre quota de recherches web.',
    descriptionEn: 'Increase your web search quota.',
    featuresFr: getLimitFeatures('pro', 'fr'),
    featuresEn: getLimitFeatures('pro', 'en'),
    recommendedPlan: 'pro',
  },
  tts: {
    icon: 'volume-high-outline',
    titleFr: 'Audio TTS limité',
    titleEn: 'Limited TTS audio',
    descriptionFr: 'Générez plus d\'audio avec un plan supérieur.',
    descriptionEn: 'Generate more audio with a higher plan.',
    featuresFr: getLimitFeatures('pro', 'fr'),
    featuresEn: getLimitFeatures('pro', 'en'),
    recommendedPlan: 'pro',
  },
};

export const UpgradePromptModal: React.FC<UpgradePromptModalProps> = ({
  visible,
  onClose,
  limitType,
  currentUsage,
  maxAllowed,
  showTrialOption = true,
  onStartTrial,
}) => {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const navigation = useNavigation<NavigationProp>();

  const config = LIMIT_CONFIG[limitType];

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    navigation.navigate('Upgrade');
  };

  const handleStartTrial = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onStartTrial?.();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
          {/* Close button */}
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.bgTertiary }]}
            onPress={onClose}
          >
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: `${colors.accentWarning}20` }]}>
            <Ionicons name={config.icon} size={40} color={colors.accentWarning} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {language === 'fr' ? config.titleFr : config.titleEn}
          </Text>

          {/* Description */}
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {language === 'fr' ? config.descriptionFr : config.descriptionEn}
          </Text>

          {/* Usage indicator */}
          {currentUsage !== undefined && maxAllowed !== undefined && (
            <View style={[styles.usageContainer, { backgroundColor: colors.bgSecondary }]}>
              <View style={styles.usageHeader}>
                <Text style={[styles.usageLabel, { color: colors.textSecondary }]}>
                  {language === 'fr' ? 'Utilisation' : 'Usage'}
                </Text>
                <Text style={[styles.usageValue, { color: colors.accentWarning }]}>
                  {currentUsage} / {maxAllowed}
                </Text>
              </View>
              <View style={[styles.usageBar, { backgroundColor: colors.bgTertiary }]}>
                <View
                  style={[
                    styles.usageBarFill,
                    {
                      backgroundColor: colors.accentWarning,
                      width: `${Math.min((currentUsage / maxAllowed) * 100, 100)}%`,
                    },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Features list */}
          <View style={styles.featuresContainer}>
            <Text style={[styles.featuresTitle, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'Avec un plan supérieur :' : 'With a higher plan:'}
            </Text>
            {(language === 'fr' ? config.featuresFr : config.featuresEn).map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={20} color={colors.accentSuccess} />
                <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                  {feature}
                </Text>
              </View>
            ))}
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            {/* Trial option */}
            {showTrialOption && onStartTrial && (
              <TouchableOpacity
                style={[styles.trialButton, { borderColor: colors.accentPrimary }]}
                onPress={handleStartTrial}
              >
                <Ionicons name="gift-outline" size={20} color={colors.accentPrimary} />
                <Text style={[styles.trialButtonText, { color: colors.accentPrimary }]}>
                  {language === 'fr' ? 'Essayer Pro gratuitement (7j)' : 'Try Pro free (7 days)'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Upgrade button */}
            <TouchableOpacity
              style={[styles.upgradeButton, { backgroundColor: colors.accentPrimary }]}
              onPress={handleUpgrade}
            >
              <Ionicons name="rocket-outline" size={20} color="#FFFFFF" />
              <Text style={styles.upgradeButtonText}>
                {language === 'fr' ? 'Voir les plans' : 'View plans'}
              </Text>
            </TouchableOpacity>

            {/* Later button */}
            <TouchableOpacity
              style={styles.laterButton}
              onPress={onClose}
            >
              <Text style={[styles.laterButtonText, { color: colors.textTertiary }]}>
                {language === 'fr' ? 'Plus tard' : 'Maybe later'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bodySemiBold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  description: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  usageContainer: {
    width: '100%',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  usageLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  usageValue: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  usageBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  usageBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: Spacing.lg,
  },
  featuresTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  featureText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  actions: {
    width: '100%',
    gap: Spacing.md,
  },
  trialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  trialButtonText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  laterButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  laterButtonText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
});

export default UpgradePromptModal;
