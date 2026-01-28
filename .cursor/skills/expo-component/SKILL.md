---
name: expo-component
description: Creates React Native components for Expo with TypeScript strict types, StyleSheet.create (no Tailwind), loading/error states, and exported props interfaces. Use when the user invokes /expo-component, asks to create an Expo/React Native component, or requests a mobile UI component for the DeepSight app.
---

# Create Expo Component

Use this when creating React Native components for the DeepSight mobile app (Expo SDK 54).

## Requirements

- **TypeScript strict**: Full types for props, state, and handlers. No `any`.
- **StyleSheet.create**: All styles via `StyleSheet.create`. No Tailwind, no inline object literals for static styles.
- **Loading / error states**: Handle `loading` and `error` explicitly (props or internal fetch). Render clear empty/error UIs.
- **Exported props interface**: Export a `ComponentNameProps` interface (or `Props`) for consumers and re-use.

## Structure

```tsx
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Spacing, BorderRadius } from '../../constants/theme';

export interface MyComponentProps {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  error?: string | null;
}

export const MyComponent: React.FC<MyComponentProps> = ({
  title,
  onPress,
  loading = false,
  error = null,
}) => {
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, styles.error]}>
        <Text style={{ color: colors.error }}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={{ color: colors.text }}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: Spacing.md, borderRadius: BorderRadius.lg },
  centered: { padding: Spacing.lg, alignItems: 'center', justifyContent: 'center' },
  error: { minHeight: 80 },
});

export default MyComponent;
```

## Conventions (DeepSight mobile)

- Prefer `useTheme()` from `contexts/ThemeContext` for `colors`, `isDark`.
- Use `constants/theme`: `Spacing`, `BorderRadius`, `Shadows`, `Typography`.
- Functional components only. `React.FC<Props>` or explicit return type.
- Export: named `ComponentName` and `default`; export `ComponentNameProps`.
- Place in `mobile/src/components/` (e.g. `ui/`, `common/`, or a feature folder). Add to folder `index.ts` if it exists.

## Loading and error

- **Loading**: `ActivityIndicator` or `DeepSightSpinner` from `components/ui`. Use `colors.primary` for tint where applicable.
- **Error**: Short message with `colors.error`. Optional retry button / `onRetry` callback.
- **Empty**: Use `EmptyState` from `components/EmptyState` when it fits (list empty, no data).

## File placement

- Reusable UI: `mobile/src/components/ui/ComponentName.tsx`
- Feature-specific: `mobile/src/components/<feature>/ComponentName.tsx`
- Update `index.ts` in that folder when adding.
