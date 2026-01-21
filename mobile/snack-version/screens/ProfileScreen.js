import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const colors = {
  bgPrimary: '#0a0a0b',
  bgSecondary: '#111113',
  bgElevated: '#1f1f23',
  textPrimary: '#FAFAF9',
  textSecondary: '#A1A1AA',
  textTertiary: '#71717A',
  accentPrimary: '#6366F1',
  border: '#27272A',
  error: '#EF4444',
};

const MenuItem = ({ icon, label, onPress, rightText, rightBadge, danger, toggle, toggleValue }) => (
  <TouchableOpacity
    style={styles.menuItem}
    onPress={onPress}
    disabled={toggle}
  >
    <View style={styles.menuItemLeft}>
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <Ionicons
          name={icon}
          size={20}
          color={danger ? colors.error : colors.accentPrimary}
        />
      </View>
      <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>
        {label}
      </Text>
    </View>
    <View style={styles.menuItemRight}>
      {rightText && <Text style={styles.menuRightText}>{rightText}</Text>}
      {rightBadge && (
        <View style={styles.menuBadge}>
          <Text style={styles.menuBadgeText}>{rightBadge}</Text>
        </View>
      )}
      {toggle ? (
        <Switch
          value={toggleValue}
          onValueChange={onPress}
          trackColor={{ false: colors.bgSecondary, true: colors.accentPrimary }}
          thumbColor="#FFFFFF"
        />
      ) : (
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      )}
    </View>
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnexion', style: 'destructive', onPress: () => {} },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profil</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>ML</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Maxime Leparc</Text>
            <Text style={styles.profileEmail}>maxime.fonira@hotmail.fr</Text>
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>FREE</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>Vidéos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>8.5k</Text>
            <Text style={styles.statLabel}>Mots</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>3</Text>
            <Text style={styles.statLabel}>Playlists</Text>
          </View>
        </View>

        {/* Account Section */}
        <Text style={styles.sectionTitle}>Compte</Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon="person-outline"
            label="Mon compte"
            onPress={() => {}}
          />
          <MenuItem
            icon="star-outline"
            label="Mon abonnement"
            onPress={() => {}}
            rightBadge="FREE"
          />
          <MenuItem
            icon="analytics-outline"
            label="Utilisation"
            onPress={() => {}}
            rightText="18/20"
          />
        </View>

        {/* Preferences Section */}
        <Text style={styles.sectionTitle}>Préférences</Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon="settings-outline"
            label="Paramètres"
            onPress={() => {}}
          />
          <MenuItem
            icon="moon-outline"
            label="Mode sombre"
            toggle
            toggleValue={darkMode}
            onPress={() => setDarkMode(!darkMode)}
          />
          <MenuItem
            icon="notifications-outline"
            label="Notifications"
            toggle
            toggleValue={notifications}
            onPress={() => setNotifications(!notifications)}
          />
          <MenuItem
            icon="language-outline"
            label="Langue"
            onPress={() => {}}
            rightText="Français"
          />
        </View>

        {/* Support Section */}
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.menuCard}>
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
        </View>

        {/* Logout */}
        <View style={[styles.menuCard, { marginTop: 20 }]}>
          <MenuItem
            icon="log-out-outline"
            label="Déconnexion"
            onPress={handleLogout}
            danger
          />
        </View>

        {/* Version */}
        <Text style={styles.version}>Deep Sight v1.0.0</Text>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  profileEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  planBadge: {
    backgroundColor: `${colors.accentPrimary}20`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  planBadgeText: {
    color: colors.accentPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 24,
    marginBottom: 8,
    marginTop: 8,
  },
  menuCard: {
    backgroundColor: colors.bgElevated,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${colors.accentPrimary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuIconDanger: {
    backgroundColor: `${colors.error}15`,
  },
  menuLabel: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  menuLabelDanger: {
    color: colors.error,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuRightText: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  menuBadge: {
    backgroundColor: `${colors.accentPrimary}20`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  menuBadgeText: {
    color: colors.accentPrimary,
    fontSize: 12,
    fontWeight: '500',
  },
  version: {
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: 14,
    marginTop: 24,
  },
});
