import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import PagerView from 'react-native-pager-view';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { billingApi, ApiError } from '@/services/api';
import { PlanCard } from '@/components/upgrade/PlanCard';
import { sp } from '@/theme/spacing';
import { fontFamily, fontSize, textStyles } from '@/theme/typography';

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuit',
  student: 'Student',
  starter: 'Starter',
  pro: 'Pro',
  team: 'Team',
};

const UPGRADE_PLANS = [
  {
    id: 'student',
    name: 'Student',
    price: '2,99€',
    period: '/mois',
    features: [
      '40 analyses/mois',
      '2000 crédits',
      'Flashcards & Quiz',
      'Exports PDF',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '5,99€',
    period: '/mois',
    features: [
      '60 analyses/mois',
      '3000 crédits',
      'Vidéos 2h max',
      'Exports tous formats',
      '60 jours historique',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '12,99€',
    period: '/mois',
    popular: true,
    features: [
      '300 analyses/mois',
      '15000 crédits',
      'Playlists complètes',
      'Chat illimité',
      'TTS audio',
      'Support prioritaire',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    price: '29,99€',
    period: '/mois',
    features: [
      '1000 analyses/mois',
      '50000 crédits',
      'Accès API',
      '5 utilisateurs',
      'Dashboard analytics',
    ],
  },
];

export default function UpgradeScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

  const pagerRef = useRef<PagerView>(null);
  const [activePage, setActivePage] = useState(0);

  const currentPlan = user?.plan ?? 'free';

  const handleSelectPlan = useCallback(
    async (planId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        const { url } = await billingApi.createCheckout(planId);
        await WebBrowser.openBrowserAsync(url);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : 'Impossible de créer la session de paiement';
        Alert.alert('Erreur', message);
      }
    },
    [],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + sp.sm }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Passer au niveau supérieur
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Pager */}
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(e) => setActivePage(e.nativeEvent.position)}
      >
        {UPGRADE_PLANS.map((plan) => (
          <View key={plan.id} style={styles.pageContainer}>
            <View style={[styles.cardWrapper, { maxWidth: screenWidth - sp.xl * 2 }]}>
              <PlanCard
                plan={plan}
                isCurrentPlan={currentPlan === plan.id}
                onSelect={handleSelectPlan}
              />
            </View>
          </View>
        ))}
      </PagerView>

      {/* Dots indicator */}
      <View style={styles.dotsContainer}>
        {UPGRADE_PLANS.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor:
                  index === activePage
                    ? colors.accentPrimary
                    : colors.textMuted,
                width: index === activePage ? 20 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* Current plan */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + sp.lg }]}>
        <Text style={[styles.currentPlanText, { color: colors.textTertiary }]}>
          Plan actuel : {PLAN_LABELS[currentPlan] ?? 'Gratuit'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sp.lg,
    paddingBottom: sp.md,
  },
  backButton: {
    padding: sp.sm,
  },
  headerTitle: {
    ...textStyles.headingMd,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40, // même largeur que le bouton retour pour centrer le titre
  },
  pager: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: sp.xl,
    paddingVertical: sp.lg,
  },
  cardWrapper: {
    flex: 1,
    width: '100%',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: sp.sm,
    paddingVertical: sp.lg,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: sp.lg,
  },
  currentPlanText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
});
