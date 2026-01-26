import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage, Language } from '../../contexts/LanguageContext';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';

interface LanguageToggleProps {
  compact?: boolean;
  showLabel?: boolean;
}

interface LanguageOption {
  code: Language;
  label: string;
  flag: string;
  nativeLabel: string;
}

const languages: LanguageOption[] = [
  { code: 'fr', label: 'French', flag: '🇫🇷', nativeLabel: 'Français' },
  { code: 'en', label: 'English', flag: '🇬🇧', nativeLabel: 'English' },
];

export const LanguageToggle: React.FC<LanguageToggleProps> = ({
  compact = false,
  showLabel = true,
}) => {
  const { colors } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [showModal, setShowModal] = useState(false);

  const currentLanguage = languages.find(l => l.code === language) || languages[0];

  const handleSelectLanguage = (lang: Language) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLanguage(lang);
    setShowModal(false);
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactToggle, { backgroundColor: colors.bgSecondary }]}
        onPress={() => setShowModal(true)}
      >
        <Text style={styles.flag}>{currentLanguage.flag}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.toggle, { backgroundColor: colors.bgSecondary }]}
        onPress={() => setShowModal(true)}
      >
        <Text style={styles.flag}>{currentLanguage.flag}</Text>
        {showLabel && (
          <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>
            {currentLanguage.nativeLabel}
          </Text>
        )}
        <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowModal(false)}
        >
          <View
            style={[styles.modalContent, { backgroundColor: colors.bgPrimary }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {t.settings.selectLanguage}
              </Text>
              <TouchableOpacity
                onPress={() => setShowModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={languages}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => {
                const isSelected = item.code === language;
                return (
                  <TouchableOpacity
                    style={[
                      styles.languageOption,
                      isSelected && { backgroundColor: `${colors.accentPrimary}10` },
                    ]}
                    onPress={() => handleSelectLanguage(item.code)}
                  >
                    <Text style={styles.optionFlag}>{item.flag}</Text>
                    <View style={styles.optionLabels}>
                      <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>
                        {item.nativeLabel}
                      </Text>
                      <Text style={[styles.optionSubLabel, { color: colors.textTertiary }]}>
                        {item.label}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.accentPrimary} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  compactToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: {
    fontSize: 20,
  },
  toggleLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  optionFlag: {
    fontSize: 28,
  },
  optionLabels: {
    flex: 1,
  },
  optionLabel: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  optionSubLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginTop: 2,
  },
});

export default LanguageToggle;
