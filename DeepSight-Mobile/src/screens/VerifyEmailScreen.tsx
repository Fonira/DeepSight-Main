import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import type { RootStackParamList } from '../types';

type VerifyEmailNavigationProp = NativeStackNavigationProp<RootStackParamList, 'VerifyEmail'>;
type VerifyEmailRouteProp = RouteProp<RootStackParamList, 'VerifyEmail'>;

const CODE_LENGTH = 6;

export const VerifyEmailScreen: React.FC = () => {
  const { colors } = useTheme();
  const { verifyEmail, isLoading, error, clearError } = useAuth();
  const navigation = useNavigation<VerifyEmailNavigationProp>();
  const route = useRoute<VerifyEmailRouteProp>();
  const insets = useSafeAreaInsets();

  const email = route.params?.email || '';
  const [code, setCode] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Clear errors on mount
  useEffect(() => {
    clearError();
  }, [clearError]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Auto-submit when code is complete
  useEffect(() => {
    if (code.length === CODE_LENGTH) {
      handleVerifyCode();
    }
  }, [code]);

  const handleVerifyCode = async () => {
    if (code.length !== CODE_LENGTH) return;
    Keyboard.dismiss();

    try {
      await verifyEmail(email, code);
      setVerificationSuccess(true);
    } catch (err) {
      // Error handled by AuthContext
      setCode(''); // Reset code on error
    }
  };

  const handleResendEmail = async () => {
    setIsResending(true);
    clearError();

    // Note: Using a simple timeout as there's no dedicated resend endpoint
    // In production, this should call a resend verification email API
    setTimeout(() => {
      setIsResending(false);
      setCountdown(60);
      setCode('');
    }, 1500);
  };

  const handleBackToLogin = () => {
    navigation.navigate('Login');
  };

  const handleCodeChange = (value: string) => {
    // Only allow numbers and limit to CODE_LENGTH
    const cleaned = value.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH);
    setCode(cleaned);
  };

  // Success screen
  if (verificationSuccess) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View
          style={[
            styles.content,
            { paddingTop: insets.top + Spacing.xxl, paddingBottom: insets.bottom + Spacing.xxl },
          ]}
        >
          <View style={[styles.iconContainer, { backgroundColor: `${colors.accentSuccess}15` }]}>
            <Ionicons name="checkmark-circle" size={48} color={colors.accentSuccess} />
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Email vérifié !
          </Text>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Votre compte a été activé avec succès. Vous pouvez maintenant vous connecter.
          </Text>

          <Button
            title="Se connecter"
            onPress={handleBackToLogin}
            fullWidth
            style={styles.actionButton}
          />
        </View>
      </View>
    );
  }

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
          Nous avons envoyé un code de vérification à{' '}
          <Text style={{ color: colors.accentPrimary, fontFamily: Typography.fontFamily.bodySemiBold }}>
            {email}
          </Text>
        </Text>

        {/* Error message */}
        {error && (
          <View style={[styles.errorContainer, { backgroundColor: `${colors.accentError}15` }]}>
            <Ionicons name="alert-circle" size={20} color={colors.accentError} />
            <Text style={[styles.errorText, { color: colors.accentError }]}>{error}</Text>
          </View>
        )}

        {/* Code Input */}
        <View style={styles.codeContainer}>
          <Text style={[styles.codeLabel, { color: colors.textSecondary }]}>
            Entrez le code à 6 chiffres
          </Text>

          <TouchableOpacity
            style={styles.codeInputContainer}
            onPress={() => inputRef.current?.focus()}
            activeOpacity={1}
          >
            {[...Array(CODE_LENGTH)].map((_, index) => (
              <View
                key={index}
                style={[
                  styles.codeBox,
                  {
                    backgroundColor: colors.bgSecondary,
                    borderColor: index === code.length ? colors.accentPrimary : colors.border,
                    borderWidth: index === code.length ? 2 : 1,
                  },
                ]}
              >
                <Text style={[styles.codeDigit, { color: colors.textPrimary }]}>
                  {code[index] || ''}
                </Text>
              </View>
            ))}
          </TouchableOpacity>

          {/* Hidden input for keyboard */}
          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={code}
            onChangeText={handleCodeChange}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            autoFocus
          />
        </View>

        <Button
          title="Vérifier"
          onPress={handleVerifyCode}
          loading={isLoading}
          disabled={code.length !== CODE_LENGTH}
          fullWidth
          style={styles.verifyButton}
        />

        <Text style={[styles.instructions, { color: colors.textTertiary }]}>
          Si vous ne trouvez pas l'email, vérifiez votre dossier spam.
        </Text>

        <View style={styles.actions}>
          <Button
            title={countdown > 0 ? `Renvoyer dans ${countdown}s` : 'Renvoyer le code'}
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
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    width: '100%',
  },
  errorText: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  codeContainer: {
    width: '100%',
    marginBottom: Spacing.lg,
  },
  codeLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  codeInputContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  codeBox: {
    width: 48,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeDigit: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  verifyButton: {
    marginBottom: Spacing.md,
  },
  instructions: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.relaxed,
    paddingHorizontal: Spacing.md,
  },
  actions: {
    width: '100%',
  },
  actionButton: {
    marginTop: Spacing.xl,
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
