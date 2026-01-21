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
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Header, Card } from '../components';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { ANALYSIS_MODES, AI_MODELS, LANGUAGES } from '../constants/config';

interface SettingItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  showChevron?: boolean;
}

const SettingItem: React.FC<SettingItemProps> = ({
  icon,
  label,
  value,
  onPress,
  showChevron = true,
}) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.settingItem, { borderBottomColor: colors.border }]}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
    >
      <View style={styles.settingItemLeft}>
        <View style={[styles.settingIcon, { backgroundColor: colors.bgElevated }]}>
          <Ionicons name={icon} size={20} color={colors.accentPrimary} />
        </View>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
          {label}
        </Text>
      </View>
      <View style={styles.settingItemRight}>
        {value && (
          <Text style={[styles.settingValue, { color: colors.textTertiary }]}>
            {value}
          </Text>
        )}
        {showChevron && (
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        )}
      </View>
    </TouchableOpacity>
  );
};

export const SettingsScreen: React.FC = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const handleSelectMode = () => {
    const options = ANALYSIS_MODES.map(mode => mode.label);
    Alert.alert(
      'Mode d\'analyse par défaut',
      'Sélectionnez votre mode préféré',
      [
        ...options.map(option => ({
          text: option,
          onPress: () => {},
        })),
        { text: 'Annuler', style: 'cancel' as const },
      ]
    );
  };

  const handleSelectModel = () => {
    const options = AI_MODELS.slice(0, 4).map(model => `${model.label} (${model.provider})`);
    Alert.alert(
      'Modèle IA par défaut',
      'Sélectionnez votre modèle préféré',
      [
        ...options.map(option => ({
          text: option,
          onPress: () => {},
        })),
        { text: 'Annuler', style: 'cancel' as const },
      ]
    );
  };

  const handleSelectLanguage = () => {
    Alert.alert(
      'Langue de l\'interface',
      'Sélectionnez votre langue',
      [
        ...LANGUAGES.map(lang => ({
          text: `${lang.flag} ${lang.label}`,
          onPress: () => {},
        })),
        { text: 'Annuler', style: 'cancel' as const },
      ]
    );
  };

  const handleNotifications = () => {
    Alert.alert(
      'Notifications',
      'Les paramètres de notifications seront disponibles prochainement.',
      [{ text: 'OK' }]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Vider le cache',
      'Êtes-vous sûr de vouloir vider le cache de l\'application ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Vider',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Succès', 'Le cache a été vidé.');
          },
        },
      ]
    );
  };

  const getDefaultModeLabel = () => {
    const mode = ANALYSIS_MODES.find(m => m.id === (user?.default_mode || 'synthesis'));
    return mode?.label || 'Synthèse';
  };

  const getDefaultModelLabel = () => {
    const model = AI_MODELS.find(m => m.id === (user?.default_model || 'gpt-4o-mini'));
    return model?.label || 'GPT-4o Mini';
  };

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <Header title="Paramètres" showBack />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Analysis Settings */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Analyse
        </Text>
        <Card variant="elevated" style={styles.settingsCard}>
          <SettingItem
            icon="document-text-outline"
            label="Mode par défaut"
            value={getDefaultModeLabel()}
            onPress={handleSelectMode}
          />
          <SettingItem
            icon="hardware-chip-outline"
            label="Modèle IA"
            value={getDefaultModelLabel()}
            onPress={handleSelectModel}
          />
        </Card>

        {/* Appearance Settings */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Apparence
        </Text>
        <Card variant="elevated" style={styles.settingsCard}>
          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.border }]}
            onPress={() => {
              Haptics.selectionAsync();
              toggleTheme();
            }}
          >
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingIcon, { backgroundColor: colors.bgElevated }]}>
                <Ionicons
                  name={isDark ? 'moon' : 'sunny'}
                  size={20}
                  color={colors.accentPrimary}
                />
              </View>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
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
          <SettingItem
            icon="language-outline"
            label="Langue"
            value="Français"
            onPress={handleSelectLanguage}
          />
        </Card>

        {/* Notifications */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Notifications
        </Text>
        <Card variant="elevated" style={styles.settingsCard}>
          <SettingItem
            icon="notifications-outline"
            label="Gérer les notifications"
            onPress={handleNotifications}
          />
        </Card>

        {/* Data & Storage */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Données et stockage
        </Text>
        <Card variant="elevated" style={styles.settingsCard}>
          <SettingItem
            icon="trash-outline"
            label="Vider le cache"
            onPress={handleClearCache}
            showChevron={false}
          />
        </Card>

        {/* App Info */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          À propos
        </Text>
        <Card variant="elevated" style={styles.settingsCard}>
          <SettingItem
            icon="information-circle-outline"
            label="Version"
            value="1.0.0"
            onPress={() => {}}
            showChevron={false}
          />
        </Card>
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
  sectionTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  settingsCard: {
    padding: 0,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  settingLabel: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
  },
  settingItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  settingValue: {
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
});

export default SettingsScreen;
