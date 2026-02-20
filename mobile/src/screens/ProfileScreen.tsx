import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenDoodleVariant } from '../contexts/DoodleVariantContext';
import { Header } from '../components/Header';
import { Card, Avatar, Badge, LanguageToggle, CreditDisplay, AnimatedToggle } from '../components/ui';
import { sp, borderRadius } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';
import { formatNumber } from '../utils/formatters';
import { normalizePlanId, getPlanInfo } from '../config/planPrivileges';
import type { RootStackParamList } from '../types';

type ProfileNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  rightText?: string;
  rightBadge?: string;
  danger?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  label,
  onPress,
  rightText,
  rightBadge,
  danger = false,
}) => {
  const { colors } = useTheme();

  return (
    <Pressable
      style={[styles.menuItem, { borderBottomColor: colors.border }]}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
    >
      <View style={styles.menuItemLeft}>
        <View style={[styles.menuIcon, { backgroundColor: danger ? `${colors.accentError}15` : colors.glassBg }]}>
          <Ionicons
            name={icon}
            size={20}
            color={danger ? colors.accentError : colors.accentPrimary}
          />
        </View>
        <Text style={[styles.menuLabel, { color: danger ? colors.accentError : colors.textPrimary }]}>
          {label}
        </Text>
      </View>
      <View style={styles.menuItemRight}>
        {rightText && (
          <Text style={[styles.menuRightText, { color: colors.textTertiary }]}>
            {rightText}
          </Text>
        )}
        {rightBadge && (
          <Badge label={rightBadge} variant="primary" size="sm" />
        )}
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Pressable>
  );
};

export const ProfileScreen: React.FC = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { t, language } = useLanguage();
  const { user, logout } = useAuth();
  const navigation = useNavigation<ProfileNavigationProp>();
  const insets = useSafeAreaInsets();
  useScreenDoodleVariant('default');

  const userPlan = normalizePlanId(user?.plan);
  const planInfo = getPlanInfo(userPlan);

  const handleLogout = () => {
    Alert.alert(
      t.auth.signOut,
      t.auth.signOutConfirm,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.auth.signOut,
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const getPlanLabel = () => {
    return language === 'fr' ? planInfo.name.fr : planInfo.name.en;
  };

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <Header title={t.nav.profile} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <Card variant="elevated" style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <Avatar uri={user?.avatar_url} name={user?.username} size="xl" />
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: colors.textPrimary }]}>
                  {user?.username || t.admin.user}
                </Text>
                <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
                  {user?.email}
                </Text>
                <Badge
                  label={getPlanLabel()}
                  variant={userPlan === 'free' ? 'default' : 'primary'}
                  style={{ marginTop: sp.sm }}
                />
              </View>
            </View>

            <CreditDisplay variant="full" />

            <View style={[styles.statsRow, { borderTopColor: colors.border, marginTop: sp.md }]}>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  {formatNumber(user?.total_videos || 0)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
                  {t.playlists.videos}
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  {formatNumber(user?.total_words || 0)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
                  {t.admin.wordsGenerated}
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  {formatNumber(user?.total_playlists || 0)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
                  {t.playlists.title}
                </Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* Account Section */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            {t.settings.account}
          </Text>
          <Card variant="elevated" style={styles.menuCard}>
            <MenuItem
              icon="person-outline"
              label={t.settings.account}
              onPress={() => navigation.navigate('Account')}
            />
            <MenuItem
              icon="star-outline"
              label={t.settings.subscription}
              onPress={() => navigation.navigate('Upgrade')}
              rightBadge={getPlanLabel()}
            />
            <MenuItem
              icon="analytics-outline"
              label={t.settings.usage}
              onPress={() => navigation.navigate('Usage')}
              rightText={`${user?.credits || 0}/${user?.credits_monthly || 20}`}
            />
          </Card>
        </Animated.View>

        {/* Preferences Section */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            {t.settings.preferences}
          </Text>
          <Card variant="elevated" style={styles.menuCard}>
            <MenuItem
              icon="settings-outline"
              label={t.nav.settings}
              onPress={() => navigation.navigate('Settings')}
            />
            <Pressable
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={() => {
                Haptics.selectionAsync();
                toggleTheme();
              }}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIcon, { backgroundColor: colors.glassBg }]}>
                  <Ionicons
                    name={isDark ? 'moon' : 'sunny'}
                    size={20}
                    color={colors.accentPrimary}
                  />
                </View>
                <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>
                  {t.settings.darkMode}
                </Text>
              </View>
              <AnimatedToggle
                value={isDark}
                onValueChange={() => toggleTheme()}
              />
            </Pressable>
            <View style={[styles.menuItem, { borderBottomColor: colors.border }]}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIcon, { backgroundColor: colors.glassBg }]}>
                  <Ionicons
                    name="language-outline"
                    size={20}
                    color={colors.accentPrimary}
                  />
                </View>
                <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>
                  {t.settings.language}
                </Text>
              </View>
              <LanguageToggle compact />
            </View>
          </Card>
        </Animated.View>

        {/* Support Section */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            {t.settings.support}
          </Text>
          <Card variant="elevated" style={styles.menuCard}>
            <MenuItem
              icon="help-circle-outline"
              label={t.settings.helpFaq}
              onPress={() => navigation.navigate('Legal', { type: 'about' })}
            />
            <MenuItem
              icon="chatbubble-outline"
              label={t.settings.contactUs}
              onPress={() => navigation.navigate('Legal', { type: 'about' })}
            />
            <MenuItem
              icon="document-text-outline"
              label={t.settings.termsOfService}
              onPress={() => navigation.navigate('Legal', { type: 'terms' })}
            />
          </Card>
        </Animated.View>

        {/* Logout */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <Card variant="elevated" style={[styles.menuCard, { marginTop: sp.lg }]}>
            <MenuItem
              icon="log-out-outline"
              label={t.auth.signOut}
              onPress={handleLogout}
              danger
            />
          </Card>
        </Animated.View>

        {/* App Version */}
        <Text style={[styles.version, { color: colors.textMuted }]}>
          Deep Sight v1.0.0
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: sp.lg,
    paddingTop: sp.md,
  },
  profileCard: {
    marginBottom: sp.xl,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: sp.lg,
  },
  profileInfo: {
    flex: 1,
    marginLeft: sp.lg,
  },
  profileName: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.bodySemiBold,
  },
  profileEmail: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.body,
    marginTop: sp.xs,
  },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: sp.lg,
    paddingHorizontal: sp.md,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.bodySemiBold,
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.body,
    marginTop: sp.xs,
  },
  statDivider: {
    width: 1,
    height: '100%',
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: sp.sm,
    marginTop: sp.lg,
    paddingHorizontal: sp.xs,
  },
  menuCard: {
    padding: 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: sp.md,
    paddingHorizontal: sp.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: sp.md,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: sp.md,
  },
  menuLabel: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.body,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
  },
  menuRightText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.body,
  },
  version: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.body,
    textAlign: 'center',
    marginTop: sp.xl,
    marginBottom: sp.lg,
  },
});

export default ProfileScreen;
