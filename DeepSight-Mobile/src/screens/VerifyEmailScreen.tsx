import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import type { RootStackParamList } from '../types';

type VerifyEmailNavigationProp = NativeStackNavigationProp<RootStackParamList, 'VerifyEmail'>;
type VerifyEmailRouteProp = RouteProp<RootStackParamList, 'VerifyEmail'>;

export const VerifyEmailScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<VerifyEmailNavigationProp>();
  const route = useRoute<VerifyEmailRouteProp>();
  const insets = useSafeAreaInsets();

  const email = route.params?.email || '';
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResendEmail = async () => {
    setIsResending(true);
    // Simulate API call
    setTimeout(() => {
      setIsResending(false);
      setCountdown(60);
      Alert.alert('Email envoyé', 'Un nouveau lien de vérification a été envoyé.');
    }, 1500);
  };

  const handleBackToLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + Spacing.xxl, paddingBottom: insets.bottom + Spacing.xxl },
        ]}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${colors.accentPrimary}15` }]}>
          <Ionicons name="mail-unread-outline" size={48} color={colors.accentPrimary} />
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Vérifiez votre email
        </Text>

        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Nous avons envoyé un lien de vérification à{' '}
          <Text style={{ color: colors.accentPrimary, fontFamily: Typography.fontFamily.bodySemiBold }}>
            {email}
          </Text>
        </Text>

        <Text style={[styles.instructions, { color: colors.textTertiary }]}>
          Cliquez sur le lien dans l'email pour activer votre compte. Si vous ne trouvez pas l'email, vérifiez votre dossier spam.
        </Text>

        <View style={styles.actions}>
          <Button
            title={countdown > 0 ? `Renvoyer dans ${countdown}s` : 'Renvoyer l\'email'}
            onPress={handleResendEmail}
            loading={isResending}
            disabled={countdown > 0}
            fullWidth
            variant="outline"
          />

          <TouchableOpacity onPress={handleBackToLogin} style={styles.backLink}>
            <Ionicons name="arrow-back" size={16} color={colors.accentPrimary} />
            <Text style={[styles.backLinkText, { color: colors.accentPrimary }]}>
              Retour à la connexion
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bodySemiBold,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: Typography.fontSize.base * Typography.lineHeight.relaxed,
  },
  instructions: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.relaxed,
    paddingHorizontal: Spacing.md,
  },
  actions: {
    width: '100%',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    gap: Spacing.xs,
  },
  backLinkText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
});

export default VerifyEmailScreen;
