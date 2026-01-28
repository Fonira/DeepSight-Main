import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { videoApi } from '../services/api';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';

interface TagsEditorProps {
  summaryId: string;
  initialTags?: string[];
  suggestedTags?: string[];
  onSave?: (tags: string[]) => void;
  compact?: boolean;
  maxTags?: number;
}

const PRESET_TAGS = [
  { label: 'Important', labelEn: 'Important', color: '#EF4444' },
  { label: 'À revoir', labelEn: 'Review', color: '#F59E0B' },
  { label: 'Favori', labelEn: 'Favorite', color: '#EC4899' },
  { label: 'Éducatif', labelEn: 'Educational', color: '#3B82F6' },
  { label: 'Pratique', labelEn: 'Practical', color: '#10B981' },
  { label: 'Recherche', labelEn: 'Research', color: '#8B5CF6' },
];

export const TagsEditor: React.FC<TagsEditorProps> = ({
  summaryId,
  initialTags = [],
  suggestedTags = [],
  onSave,
  compact = false,
  maxTags = 10,
}) => {
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const isEn = language === 'en';

  const [tags, setTags] = useState<string[]>(initialTags);
  const [newTag, setNewTag] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setTags(initialTags);
  }, [initialTags]);

  useEffect(() => {
    const sortedInitial = [...initialTags].sort().join(',');
    const sortedCurrent = [...tags].sort().join(',');
    setHasChanges(sortedInitial !== sortedCurrent);
  }, [tags, initialTags]);

  const handleSave = async () => {
    if (!hasChanges) return;

    setIsSaving(true);
    try {
      await videoApi.updateTags(summaryId, tags);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSave?.(tags);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save tags:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = () => {
    const trimmedTag = newTag.trim();
    if (!trimmedTag || tags.includes(trimmedTag) || tags.length >= maxTags) return;

    Haptics.selectionAsync();
    setTags([...tags, trimmedTag]);
    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    Haptics.selectionAsync();
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTogglePresetTag = (presetLabel: string) => {
    Haptics.selectionAsync();
    if (tags.includes(presetLabel)) {
      setTags(tags.filter(tag => tag !== presetLabel));
    } else if (tags.length < maxTags) {
      setTags([...tags, presetLabel]);
    }
  };

  const handleCancel = () => {
    setTags(initialTags);
    setNewTag('');
    setIsEditing(false);
  };

  const getTagColor = (tag: string): string => {
    const preset = PRESET_TAGS.find(p => p.label === tag || p.labelEn === tag);
    return preset?.color || colors.accentPrimary;
  };

  if (compact && !isEditing) {
    return (
      <TouchableOpacity
        style={[styles.compactContainer, { backgroundColor: colors.bgElevated }]}
        onPress={() => setIsEditing(true)}
      >
        <Ionicons name="pricetags-outline" size={16} color={colors.accentPrimary} />
        <View style={styles.compactTags}>
          {tags.length > 0 ? (
            tags.slice(0, 3).map((tag, index) => (
              <View key={index} style={[styles.compactTag, { backgroundColor: getTagColor(tag) + '20' }]}>
                <Text style={[styles.compactTagText, { color: getTagColor(tag) }]}>
                  {tag}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[styles.compactPlaceholder, { color: colors.textMuted }]}>
              {isEn ? 'Add tags...' : 'Ajouter des tags...'}
            </Text>
          )}
          {tags.length > 3 && (
            <Text style={[styles.moreCount, { color: colors.textTertiary }]}>
              +{tags.length - 3}
            </Text>
          )}
        </View>
        <Ionicons name="add" size={14} color={colors.textTertiary} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Ionicons name="pricetags" size={18} color={colors.accentPrimary} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {isEn ? 'Tags' : 'Tags'}
          </Text>
          <Text style={[styles.tagCount, { color: colors.textMuted }]}>
            ({tags.length}/{maxTags})
          </Text>
        </View>
        {!isEditing ? (
          <TouchableOpacity onPress={() => setIsEditing(true)}>
            <Ionicons name="pencil" size={18} color={colors.accentPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
              <Ionicons name="close" size={18} color={colors.accentError} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={styles.headerButton}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.accentSuccess} />
              ) : (
                <Ionicons
                  name="checkmark"
                  size={18}
                  color={hasChanges ? colors.accentSuccess : colors.textMuted}
                />
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Current Tags */}
      <View style={styles.tagsContainer}>
        {tags.map((tag, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.tag, { backgroundColor: getTagColor(tag) + '20' }]}
            onPress={isEditing ? () => handleRemoveTag(tag) : undefined}
            disabled={!isEditing}
          >
            <Text style={[styles.tagText, { color: getTagColor(tag) }]}>
              {tag}
            </Text>
            {isEditing && (
              <Ionicons name="close" size={12} color={getTagColor(tag)} />
            )}
          </TouchableOpacity>
        ))}
        {tags.length === 0 && !isEditing && (
          <TouchableOpacity onPress={() => setIsEditing(true)}>
            <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
              {isEn ? 'Tap to add tags...' : 'Appuyez pour ajouter des tags...'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Add Tag Input */}
      {isEditing && (
        <>
          <View style={[styles.inputContainer, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              value={newTag}
              onChangeText={setNewTag}
              placeholder={isEn ? 'Type a tag...' : 'Saisissez un tag...'}
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={handleAddTag}
              returnKeyType="done"
              maxLength={30}
            />
            <TouchableOpacity
              onPress={handleAddTag}
              disabled={!newTag.trim() || tags.length >= maxTags}
              style={[
                styles.addButton,
                { backgroundColor: newTag.trim() ? colors.accentPrimary : colors.bgTertiary },
              ]}
            >
              <Ionicons
                name="add"
                size={18}
                color={newTag.trim() ? '#FFFFFF' : colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* Preset Tags */}
          <View style={styles.presetSection}>
            <Text style={[styles.presetLabel, { color: colors.textSecondary }]}>
              {isEn ? 'Quick tags:' : 'Tags rapides:'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.presetTags}>
                {PRESET_TAGS.map((preset, index) => {
                  const label = isEn ? preset.labelEn : preset.label;
                  const isSelected = tags.includes(label);
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.presetTag,
                        {
                          backgroundColor: isSelected ? preset.color + '30' : colors.bgElevated,
                          borderColor: isSelected ? preset.color : colors.border,
                        },
                      ]}
                      onPress={() => handleTogglePresetTag(label)}
                      disabled={!isSelected && tags.length >= maxTags}
                    >
                      <View style={[styles.presetDot, { backgroundColor: preset.color }]} />
                      <Text style={[
                        styles.presetTagText,
                        { color: isSelected ? preset.color : colors.textSecondary },
                      ]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Suggested Tags */}
          {suggestedTags.length > 0 && (
            <View style={styles.suggestedSection}>
              <Text style={[styles.suggestedLabel, { color: colors.textSecondary }]}>
                {isEn ? 'AI suggested:' : 'Suggestions IA:'}
              </Text>
              <View style={styles.suggestedTags}>
                {suggestedTags.filter(t => !tags.includes(t)).slice(0, 5).map((suggested, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.suggestedTag, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
                    onPress={() => {
                      if (tags.length < maxTags) {
                        Haptics.selectionAsync();
                        setTags([...tags, suggested]);
                      }
                    }}
                    disabled={tags.length >= maxTags}
                  >
                    <Ionicons name="sparkles" size={10} color={colors.accentSecondary} />
                    <Text style={[styles.suggestedTagText, { color: colors.textSecondary }]}>
                      {suggested}
                    </Text>
                    <Ionicons name="add" size={12} color={colors.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  compactTags: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  compactTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  compactTagText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  compactPlaceholder: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  moreCount: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  tagCount: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  headerButton: {
    padding: Spacing.xs,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  tagText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  placeholderText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  addButton: {
    padding: Spacing.sm,
    marginRight: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  presetSection: {
    gap: Spacing.xs,
  },
  presetLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  presetTags: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  presetTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 4,
  },
  presetDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  presetTagText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  suggestedSection: {
    gap: Spacing.xs,
  },
  suggestedLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  suggestedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  suggestedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 4,
  },
  suggestedTagText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
});

export default TagsEditor;
