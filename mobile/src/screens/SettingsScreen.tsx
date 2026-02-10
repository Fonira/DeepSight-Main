import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenDoodleVariant } from '../contexts/DoodleVariantContext';
import { Header } from '../components/Header';
import { Card, AnimatedToggle } from '../components/ui';
import { sp, borderRadius } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';
import { ANALYSIS_MODES, AI_MODELS, LANGUAGES } from '../constants/config';
import { userApi } from '../services/api';

interface SettingItemData {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  type: 'navigate' | 'toggle' | 'info';
  toggleValue?: boolean;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
  destructive?: boolean;
}

interface SectionData {
  title: string;
  data: SettingItemData[];
}

const SettingItem: React.FC<{
  item: SettingItemData;
  isLast: boolean;
}> = ({ item, isLast }) => {
  const { colors } = useTheme();

  return (
    <Pressable
      style={[
        styles.settingItem,
        !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
      onPress={() => {
        if (item.type === 'toggle' && item.onToggle) {
          item.onToggle(!item.toggleValue);
        } else if (item.onPress) {
          Haptics.selectionAsync();
          item.onPress();
        }
      }}
    >
      <View style={styles.settingItemLeft}>
        <View style={[styles.settingIcon, { backgroundColor: colors.glassBg }]}>
          <Ionicons
            name={item.icon}
            size={18}
            color={item.destructive ? colors.accentError : colors.accentPrimary}
          />
        </View>
        <Text
          style={[
            styles.settingLabel,
            { color: item.destructive ? colors.accentError : colors.textPrimary },
          ]}
        >
          {item.label}
        </Text>
      </View>

      {item.type === 'toggle' && item.onToggle && (
        <AnimatedToggle
          value={!!item.toggleValue}
          onValueChange={item.onToggle}
        />
      )}

      {item.type === 'navigate' && (
        <View style={styles.settingItemRight}>
          {item.value && (
            <Text style={[styles.settingValue, { color: colors.textMuted }]} numberOfLines={1}>
              {item.value}
            </Text>
          )}
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
      )}

      {item.type === 'info' && item.value && (
        <Text style={[styles.settingValue, { color: colors.textMuted }]}>
          {item.value}
        </Text>
      )}
    </Pressable>
  );
};

export const SettingsScreen: React.FC = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, refreshUser } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  useScreenDoodleVariant('tech');

  const [selectedMode, setSelectedMode] = useState(user?.default_mode || 'synthesis');
  const [selectedModel, setSelectedModel] = useState(user?.default_model || 'mistral-small');
  const [autoPlayVideos, setAutoPlayVideos] = useState(true);
  const [showTournesol, setShowTournesol] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedMode = await AsyncStorage.getItem('deepsight_default_mode');
        const savedModel = await AsyncStorage.getItem('deepsight_default_model');
        const savedAutoPlay = await AsyncStorage.getItem('deepsight_autoplay_videos');
        const savedTournesol = await AsyncStorage.getItem('deepsight_show_tournesol');
        const savedReduceMotion = await AsyncStorage.getItem('deepsight_reduce_motion');

        if (savedMode) setSelectedMode(savedMode);
        if (savedModel) setSelectedModel(savedModel);
        if (savedAutoPlay !== null) setAutoPlayVideos(savedAutoPlay === 'true');
        if (savedTournesol !== null) setShowTournesol(savedTournesol === 'true');
        if (savedReduceMotion !== null) setReduceMotion(savedReduceMotion === 'true');
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadSettings();
  }, []);

  const savePreference = async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
      if (user) {
        try {
          await userApi.updatePreferences({ [key]: value });
          await refreshUser();
        } catch {
          // Server update failed, local save succeeded
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to save preference:', error);
    }
  };

  const handleSelectMode = () => {
    Alert.alert(t.settings.defaultMode, undefined, [
      ...ANALYSIS_MODES.map(mode => ({
        text: mode.label,
        onPress: async () => {
          setSelectedMode(mode.id);
          await savePreference('deepsight_default_mode', mode.id);
        },
      })),
      { text: t.common.cancel, style: 'cancel' as const },
    ]);
  };

  const handleSelectModel = () => {
    Alert.alert(t.settings.defaultModel, undefined, [
      ...AI_MODELS.map(model => ({
        text: `${model.label} (${model.provider})`,
        onPress: async () => {
          setSelectedModel(model.id);
          await savePreference('deepsight_default_model', model.id);
        },
      })),
      { text: t.common.cancel, style: 'cancel' as const },
    ]);
  };

  const handleSelectLanguage = () => {
    Alert.alert(t.settings.language, undefined, [
      ...LANGUAGES.map(lang => ({
        text: `${lang.flag} ${lang.label}`,
        onPress: async () => {
          await setLanguage(lang.code as 'fr' | 'en');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      })),
      { text: t.common.cancel, style: 'cancel' as const },
    ]);
  };

  const handleClearCache = () => {
    Alert.alert(t.settings.clearCache, t.settings.clearCacheConfirm || 'Clear app cache?', [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.settings.clear || 'Clear',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const getModeLabel = () => ANALYSIS_MODES.find(m => m.id === selectedMode)?.label || 'Synthese';
  const getModelLabel = () => AI_MODELS.find(m => m.id === selectedModel)?.label || 'Mistral Small';
  const getLangLabel = () => LANGUAGES.find(l => l.code === language)?.label || 'Francais';

  const sections: SectionData[] = [
    {
      title: t.nav.analysis,
      data: [
        { key: 'mode', icon: 'document-text-outline', label: t.settings.defaultMode, value: getModeLabel(), type: 'navigate', onPress: handleSelectMode },
        { key: 'model', icon: 'hardware-chip-outline', label: t.settings.defaultModel, value: getModelLabel(), type: 'navigate', onPress: handleSelectModel },
      ],
    },
    {
      title: t.settings.appearance,
      data: [
        { key: 'dark', icon: isDark ? 'moon' : 'sunny', label: t.settings.darkMode, type: 'toggle', toggleValue: isDark, onToggle: () => toggleTheme() },
        { key: 'lang', icon: 'language-outline', label: t.settings.language, value: getLangLabel(), type: 'navigate', onPress: handleSelectLanguage },
        { key: 'motion', icon: 'speedometer-outline', label: t.settings.reduceMotion, type: 'toggle', toggleValue: reduceMotion, onToggle: async (v: boolean) => { setReduceMotion(v); await savePreference('deepsight_reduce_motion', v.toString()); } },
      ],
    },
    {
      title: t.settings.videoPlayback,
      data: [
        { key: 'autoplay', icon: 'play-circle-outline', label: t.settings.autoPlayVideos, type: 'toggle', toggleValue: autoPlayVideos, onToggle: async (v: boolean) => { setAutoPlayVideos(v); await savePreference('deepsight_autoplay_videos', v.toString()); } },
        { key: 'tournesol', icon: 'flower-outline', label: t.settings.showTournesol, type: 'toggle', toggleValue: showTournesol, onToggle: async (v: boolean) => { setShowTournesol(v); await savePreference('deepsight_show_tournesol', v.toString()); } },
      ],
    },
    {
      title: t.settings.dataStorage || 'Data & Storage',
      data: [
        { key: 'cache', icon: 'trash-outline', label: t.settings.clearCache, type: 'navigate', onPress: handleClearCache, destructive: true },
      ],
    },
    {
      title: t.settings.about,
      data: [
        { key: 'version', icon: 'information-circle-outline', label: t.settings.version, value: '1.0.0', type: 'info' },
      ],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <Header title={t.nav.settings} showBack />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.key}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + sp.xl }]}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            {section.title}
          </Text>
        )}
        renderItem={({ item, index, section }) => (
          <View style={index === 0 ? [styles.cardWrapper, { backgroundColor: colors.bgCard, borderColor: colors.border }] : undefined}>
            {index === 0 && (
              <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                {section.data.map((sItem, sIndex) => (
                  <SettingItem
                    key={sItem.key}
                    item={sItem}
                    isLast={sIndex === section.data.length - 1}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: sp.lg,
    paddingTop: sp.sm,
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
  cardWrapper: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: sp.xs,
  },
  sectionCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: sp.md,
    paddingHorizontal: sp.lg,
    minHeight: 52,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: sp.md,
  },
  settingIcon: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: sp.md,
  },
  settingLabel: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.body,
    flex: 1,
  },
  settingItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    maxWidth: 150,
  },
  settingValue: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.body,
  },
});

export default SettingsScreen;
