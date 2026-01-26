import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { videoApi } from '../services/api';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';

interface NotesEditorProps {
  summaryId: string;
  initialNotes?: string;
  onSave?: (notes: string) => void;
  compact?: boolean;
}

export const NotesEditor: React.FC<NotesEditorProps> = ({
  summaryId,
  initialNotes = '',
  onSave,
  compact = false,
}) => {
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const isEn = language === 'en';

  const [notes, setNotes] = useState(initialNotes);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  useEffect(() => {
    setHasChanges(notes !== initialNotes);
  }, [notes, initialNotes]);

  const handleSave = async () => {
    if (!hasChanges) return;

    setIsSaving(true);
    try {
      await videoApi.updateNotes(summaryId, notes);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSave?.(notes);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save notes:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setNotes(initialNotes);
    setIsEditing(false);
  };

  if (compact && !isEditing) {
    return (
      <TouchableOpacity
        style={[styles.compactContainer, { backgroundColor: colors.bgElevated }]}
        onPress={() => setIsEditing(true)}
      >
        <Ionicons name="document-text-outline" size={16} color={colors.accentPrimary} />
        <Text style={[styles.compactText, { color: notes ? colors.textSecondary : colors.textMuted }]} numberOfLines={1}>
          {notes || (isEn ? 'Add notes...' : 'Ajouter des notes...')}
        </Text>
        <Ionicons name="pencil" size={14} color={colors.textTertiary} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? Colors.bgTertiary : Colors.light.bgSecondary }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Ionicons name="document-text" size={18} color={colors.accentPrimary} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {isEn ? 'Personal Notes' : 'Notes personnelles'}
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

      {/* Notes Input */}
      {isEditing ? (
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.bgElevated,
              color: colors.textPrimary,
              borderColor: colors.border,
            },
          ]}
          value={notes}
          onChangeText={setNotes}
          placeholder={isEn ? 'Write your notes here...' : 'Écrivez vos notes ici...'}
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          autoFocus
        />
      ) : (
        <TouchableOpacity
          style={[styles.notesDisplay, { backgroundColor: colors.bgElevated }]}
          onPress={() => setIsEditing(true)}
        >
          {notes ? (
            <Text style={[styles.notesText, { color: colors.textSecondary }]}>
              {notes}
            </Text>
          ) : (
            <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
              {isEn ? 'Tap to add personal notes about this video...' : 'Appuyez pour ajouter des notes personnelles sur cette vidéo...'}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Character count */}
      {isEditing && (
        <Text style={[styles.charCount, { color: colors.textMuted }]}>
          {notes.length}/2000
        </Text>
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
  compactText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
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
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  headerButton: {
    padding: Spacing.xs,
  },
  input: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    minHeight: 120,
    maxHeight: 200,
  },
  notesDisplay: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 80,
  },
  notesText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.sm * 1.5,
  },
  placeholderText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    fontStyle: 'italic',
  },
  charCount: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'right',
  },
});

export default NotesEditor;
