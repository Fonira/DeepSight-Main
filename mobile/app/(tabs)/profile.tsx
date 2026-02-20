import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { billingApi, ApiError } from '@/services/api';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { UsageSection } from '@/components/profile/UsageSection';
import { PreferencesSection } from '@/components/profile/PreferencesSection';
import { AccountSection } from '@/components/profile/AccountSection';
import { sp } from '@/theme/spacing';
import { fontFamily, fontSize, textStyles } from '@/theme/typography';
import { DoodleBackground } from '@/components/ui/DoodleBackground';
import type { PlanType } from '@/constants/config';

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuit',
  student: 'Student',
  starter: 'Starter',
  pro: 'Pro',
  team: 'Team',
};

const PLAN_BADGE_VARIANT: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'> = {
  free: 'default',
  student: 'info',
  starter: 'success',
  pro: 'primary',
  team: 'warning',
};

const isPaidPlan = (plan: PlanType): boolean =>
  plan !== 'free';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [manageLoading, setManageLoading] = useState(false);

  const plan = user?.plan ?? 'free';

  const handleManageSubscription = async () => {
    setManageLoading(true);
    try {
      const { url } = await billingApi.getPortalUrl();
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Impossible d\'ouvrir le portail';
      Alert.alert('Erreur', message);
    } finally {
      setManageLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Se déconnecter',
      'Es-tu sûr de vouloir te déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await logout();
            router.replace('/(auth)');
          },
        },
      ],
    );
  };

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <DoodleBackground variant="default" density="low" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + sp.lg,
            paddingBottom: 80 + Math.max(insets.bottom, sp.sm),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>Profil</Text>

        {/* Section Profil */}
        <View style={styles.profileSection}>
          <Avatar
            uri={user?.avatar_url}
            name={user?.username}
            size="xl"
          />
          <View style={styles.profileInfo}>
            <Text style={[styles.username, { color: colors.textPrimary }]}>
              {user?.username ?? 'Utilisateur'}
            </Text>
            <Text style={[styles.email, { color: colors.textSecondary }]}>
              {user?.email ?? ''}
            </Text>
            <Badge
              label={PLAN_LABELS[plan] ?? 'Gratuit'}
              variant={PLAN_BADGE_VARIANT[plan] ?? 'default'}
              size="sm"
              style={plan === 'pro' ? {
                backgroundColor: '#8b5cf620',
              } : undefined}
              textStyle={plan === 'pro' ? {
                color: '#8b5cf6',
              } : undefined}
            />
          </View>
        </View>

        {/* Action abonnement */}
        {isPaidPlan(plan) ? (
          <Button
            title="Gérer l'abonnement"
            variant="secondary"
            onPress={handleManageSubscription}
            loading={manageLoading}
            fullWidth
            style={styles.subscriptionButton}
          />
        ) : (
          <Button
            title="Passer à Premium"
            variant="primary"
            onPress={() => router.push('/upgrade')}
            fullWidth
            style={styles.subscriptionButton}
          />
        )}

        {/* Sections */}
        <UsageSection />
        <PreferencesSection />
        <AccountSection />

        {/* Bas de page */}
        <View style={styles.footer}>
          <Text style={[styles.version, { color: colors.textMuted }]}>
            Deep Sight v{appVersion}
          </Text>
          <Button
            title="Se déconnecter"
            variant="ghost"
            onPress={handleLogout}
            fullWidth
            style={styles.logoutButton}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: sp.lg,
  },
  title: {
    ...textStyles.displaySm,
    marginBottom: sp.xl,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: sp.lg,
  },
  profileInfo: {
    marginLeft: sp.lg,
    flex: 1,
    gap: sp.xs,
  },
  username: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xl,
  },
  email: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },
  subscriptionButton: {
    marginBottom: sp.xl,
  },
  footer: {
    alignItems: 'center',
    marginTop: sp.lg,
    paddingBottom: sp.lg,
  },
  version: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginBottom: sp.md,
  },
  logoutButton: {
    // ghost button styled via Button component
  },
});
