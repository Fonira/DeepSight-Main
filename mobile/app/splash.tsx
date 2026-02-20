import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { darkColors, palette } from '@/theme/colors';
import { fontFamily, fontSize } from '@/theme/typography';
import { sp } from '@/theme/spacing';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>DeepSight</Text>
      <ActivityIndicator
        size="large"
        color={palette.indigo}
        style={styles.loader}
      />
      <Text style={styles.text}>Chargement...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkColors.bgPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    gap: sp.xl,
  },
  logo: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['4xl'],
    color: darkColors.textPrimary,
  },
  loader: {
    marginVertical: sp.lg,
  },
  text: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: darkColors.textSecondary,
  },
});
