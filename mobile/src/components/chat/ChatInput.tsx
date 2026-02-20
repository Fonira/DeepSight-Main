/**
 * ChatInput - Shared modernized chat input bar
 *
 * Features:
 * - Round teal send button with arrow icon
 * - Optional web search toggle
 * - Multiline input with glass background
 * - Loading state with spinner
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  isLoading?: boolean;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  /** Web search toggle */
  showWebSearch?: boolean;
  webSearchEnabled?: boolean;
  onToggleWebSearch?: () => void;
  canUseWebSearch?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChangeText,
  onSend,
  isLoading = false,
  placeholder,
  maxLength = 1000,
  disabled = false,
  showWebSearch = false,
  webSearchEnabled = false,
  onToggleWebSearch,
  canUseWebSearch = true,
}) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const inputRef = useRef<TextInput>(null);

  // Force blur + dismiss on unmount to prevent orphaned keyboard on iOS
  useEffect(() => {
    return () => {
      inputRef.current?.blur();
      Keyboard.dismiss();
    };
  }, []);

  const canSend = value.trim().length > 0 && !isLoading && !disabled;

  const handleSend = () => {
    if (!canSend) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary, borderTopColor: colors.border }]}>
      {showWebSearch && (
        <Pressable
          style={[
            styles.webSearchToggle,
            {
              backgroundColor: webSearchEnabled ? `${colors.accentPrimary}20` : colors.bgSecondary,
              borderColor: webSearchEnabled ? colors.accentPrimary : colors.border,
            },
          ]}
          onPress={onToggleWebSearch}
          disabled={!canUseWebSearch}
        >
          <Ionicons
            name="globe-outline"
            size={16}
            color={
              webSearchEnabled
                ? colors.accentPrimary
                : canUseWebSearch
                  ? colors.textSecondary
                  : colors.textMuted
            }
          />
          {!canUseWebSearch && (
            <Ionicons
              name="lock-closed"
              size={10}
              color={colors.textMuted}
              style={styles.lockIcon}
            />
          )}
        </Pressable>
      )}

      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          {
            backgroundColor: colors.bgSecondary,
            color: colors.textPrimary,
            borderColor: colors.glassBorder,
          },
        ]}
        placeholder={placeholder || t.chat.placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        multiline
        maxLength={maxLength}
        editable={!disabled}
        onSubmitEditing={handleSend}
        blurOnSubmit={false}
        returnKeyType="default"
      />

      <Pressable
        style={[
          styles.sendButton,
          {
            backgroundColor: canSend ? colors.accentTertiary : colors.bgTertiary,
          },
        ]}
        onPress={handleSend}
        disabled={!canSend}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    maxHeight: 100,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    borderWidth: 1,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webSearchToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  lockIcon: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
});

export default ChatInput;
