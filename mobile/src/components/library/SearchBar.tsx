import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { sp, borderRadius } from '@/theme/spacing';
import { fontFamily, fontSize } from '@/theme/typography';
import { timings } from '@/theme/animations';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClose: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ value, onChangeText, onClose }) => {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expandAnim = useSharedValue(0);

  useEffect(() => {
    expandAnim.value = withTiming(1, timings.enter);
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => {
      clearTimeout(focusTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [expandAnim]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: expandAnim.value,
    transform: [{ scaleX: expandAnim.value }],
  }));

  const handleChange = useCallback((text: string) => {
    setLocalValue(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChangeText(text);
    }, 300);
  }, [onChangeText]);

  const handleClose = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onChangeText('');
    onClose();
  }, [onChangeText, onClose]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.glassBg,
          borderColor: colors.borderFocus,
        },
        animatedStyle,
      ]}
    >
      <Ionicons name="search" size={18} color={colors.textTertiary} style={styles.icon} />
      <TextInput
        ref={inputRef}
        value={localValue}
        onChangeText={handleChange}
        placeholder="Rechercher..."
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.textPrimary }]}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable onPress={handleClose} hitSlop={8}>
        <Ionicons name="close" size={20} color={colors.textTertiary} />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: sp.md,
    height: 44,
    marginBottom: sp.md,
  },
  icon: {
    marginRight: sp.sm,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    paddingVertical: 0,
  },
});
