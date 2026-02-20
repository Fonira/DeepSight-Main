import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Link } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { darkColors } from '@/theme/colors';
import { sp } from '@/theme/spacing';
import { fontFamily, fontSize, textStyles } from '@/theme/typography';

export default function NotFoundScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>404</Text>
        <Text style={styles.heading}>Page non trouvée</Text>
        <Text style={styles.description}>
          La page que vous recherchez n'existe pas.
        </Text>

        <Link href="/" asChild>
          <Button
            title="Retour à l'accueil"
            variant="primary"
            size="lg"
            fullWidth
          />
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkColors.bgPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: sp.xl,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['5xl'],
    color: darkColors.textPrimary,
  },
  heading: {
    ...textStyles.headingLg,
    color: darkColors.textPrimary,
  },
  description: {
    ...textStyles.bodyMd,
    color: darkColors.textSecondary,
    textAlign: 'center',
    marginBottom: sp.lg,
  },
});
