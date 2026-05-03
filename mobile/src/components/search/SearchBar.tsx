/**
 * SearchBar — Input principal du tab Search.
 *
 * Différences avec `library/SearchBar.tsx` (qui est un overlay temporaire) :
 *   - Pas d'animation d'apparition (toujours visible dans le tab)
 *   - Pas de bouton "fermer" — la search bar est la pièce centrale
 *   - Le debounce est délégué au hook `useSemanticSearch` (parent)
 *   - autoFocus optionnel pour ouverture du tab
 */

import React, { useRef, useEffect } from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  autoFocus = false,
  placeholder = "Rechercher dans tes analyses…",
}) => {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [autoFocus]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.glassBg, borderColor: colors.borderFocus },
      ]}
    >
      <Ionicons
        name="search"
        size={18}
        color={colors.textTertiary}
        style={styles.iconLeft}
      />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.textPrimary }]}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        accessibilityLabel="Champ de recherche sémantique"
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Effacer la recherche"
          accessibilityRole="button"
        >
          <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: sp.md,
    height: 48,
  },
  iconLeft: { marginRight: sp.sm },
  input: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    paddingVertical: 0,
  },
});
