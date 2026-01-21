import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Header, Card, Avatar, Badge } from '../components';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { formatNumber } from '../utils/formatters';
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
    <TouchableOpacity
      style={[styles.menuItem, { borderBottomColor: colors.border }]}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
    >
      <View style={styles.menuItemLeft}>
        <View style={[styles.menuIcon, { backgroundColor: danger ? `${colors.accentError}15` : colors.bgElevated }]}>
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
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );
};

export const ProfileScreen: React.FC = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigation = useNavigation<ProfileNavigationProp>();
  const insets = useSafeAreaInsets();

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const getPlanLabel = () => {
    const planLabels: Record<string, string> = {
      free: 'Gratuit',
      student: 'Étudiant',
      starter: 'Starter',
      pro: 'Pro',
      expert: 'Expert',
    };
    return planLabels[user?.plan || 'free'] || 'Gratuit';
  };

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <Header title="Profil" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <Card variant="elevated" style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Avatar uri={user?.avatar_url} name={user?.username} size="xl" />
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.textPrimary }]}>
                {user?.username || 'Utilisateur'}
              </Text>
              <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
                {user?.email}
              </Text>
              <Badge
                label={getPlanLabel()}
                variant={user?.plan === 'free' ? 'default' : 'primary'}
                style={{ marginTop: Spacing.sm }}
              />
            </View>
          </View>

          {/* Stats */}
          <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                {formatNumber(user?.total_videos || 0)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
                Vidéos
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                {formatNumber(user?.total_words || 0)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
                Mots
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                {formatNumber(user?.total_playlists || 0)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
                Playlists
              </Text>
            </View>
          </View>
        </Card>

        {/* Account Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Compte
        </Text>
        <Card variant="elevated" style={styles.menuCard}>
          <MenuItem
            icon="person-outline"
            label="Mon compte"
            onPress={() => navigation.navigate('Account')}
          />
          <MenuItem
            icon="star-outline"
            label="Mon abonnement"
            onPress={() => navigation.navigate('Upgrade')}
            rightBadge={getPlanLabel()}
          />
          <MenuItem
            icon="analytics-outline"
            label="Utilisation"
            onPress={() => navigation.navigate('Usage')}
            rightText={`${user?.credits || 0}/${user?.credits_monthly || 20}`}
          />
        </Card>

        {/* Preferences Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Préférences
        </Text>
        <Card variant="elevated" style={styles.menuCard}>
          <MenuItem
            icon="settings-outline"
            label="Paramètres"
            onPress={() => navigation.navigate('Settings')}
          />
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => {
              Haptics.selectionAsync();
              toggleTheme();
            }}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: colors.bgElevated }]}>
                <Ionicons
                  name={isDark ? 'moon' : 'sunny'}
                  size={20}
                  color={colors.accentPrimary}
                />
              </View>
              <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>
                Mode sombre
              </Text>
            </View>
            <View style={[styles.toggle, { backgroundColor: isDark ? colors.accentPrimary : colors.bgTertiary }]}>
              <View
                style={[
                  styles.toggleKnob,
                  isDark ? styles.toggleKnobActive : styles.toggleKnobInactive,
                ]}
              />
            </View>
          </TouchableOpacity>
          <MenuItem
            icon="language-outline"
            label="Langue"
            onPress={() => {}}
            rightText="Français"
          />
        </Card>

        {/* Support Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Support
        </Text>
        <Card variant="elevated" style={styles.menuCard}>
          <MenuItem
            icon="help-circle-outline"
            label="Aide & FAQ"
            onPress={() => {}}
          />
          <MenuItem
            icon="chatbubble-outline"
            label="Nous contacter"
            onPress={() => {}}
          />
          <MenuItem
            icon="document-text-outline"
            label="Mentions légales"
            onPress={() => {}}
          />
        </Card>

        {/* Logout */}
        <Card variant="elevated" style={[styles.menuCard, { marginTop: Spacing.lg }]}>
          <MenuItem
            icon="log-out-outline"
            label="Déconnexion"
            onPress={handleLogout}
            danger
          />
        </Card>

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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  profileCard: {
    marginBottom: Spacing.xl,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  profileInfo: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  profileName: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  profileEmail: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.xs,
  },
  statDivider: {
    width: 1,
    height: '100%',
  },
  sectionTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  menuCard: {
    padding: 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  menuLabel: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  menuRightText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 2,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  toggleKnobInactive: {
    alignSelf: 'flex-start',
  },
  version: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
});

export default ProfileScreen;
