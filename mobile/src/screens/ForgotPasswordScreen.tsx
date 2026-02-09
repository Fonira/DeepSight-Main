import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenDoodleVariant } from '../contexts/DoodleVariantContext';
import { Button, Input } from '../components/ui';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import type { RootStackParamList } from '../types';

type ForgotPasswordNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const { forgotPassword, isLoading, error, clearError } = useAuth();
  const navigation = useNavigation<ForgotPasswordNavigationProp>();
  const insets = useSafeAreaInsets();
  useScreenDoodleVariant('creative');

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  // Clear errors on mount
  useEffect(() => {
    clearError();
  }, [clearError]);

  const validateEmail = (): boolean => {
    if (!email.trim()) {
      setEmailError(t.common.required);
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError(t.errors.invalidEmail);
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleResetPassword = async () => {
    if (!validateEmail()) return;

    try {
      await forgotPassword(email);
      setEmailSent(true);
    } catch (err) {
      // Error is handled by AuthContext, but we still show success
      // to prevent email enumeration attacks
      setEmailSent(true);
    }
  };

  const handleBackToLogin = () => {
    navigation.navigate('Login');
  };

  if (emailSent) {
    return (
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + Spacing.xxl, paddingBottom: insets.bottom + Spacing.xxl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.successContainer}>
            <View style={[styles.successIcon, { backgroundColor: `${colors.accentSuccess}15` }]}>
              <Ionicons name="mail" size={48} color={colors.accentSuccess} />
            </View>
            <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'Email envoyé !' : 'Email sent!'}
            </Text>
            <Text style={[styles.successText, { color: colors.textSecondary }]}>
              {language === 'fr'
                ? `Si un compte existe pour ${email}, vous recevrez un email de réinitialisation.`
                : `If an account exists for ${email}, you'll receive a password reset email.`}
            </Text>
            <Button
              title={t.auth.signIn}
              onPress={handleBackToLogin}
              fullWidth
              style={styles.backButton}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xxl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButtonIcon}
          >
            <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={[styles.iconContainer, { backgroundColor: `${colors.accentPrimary}15` }]}>
            <Ionicons name="lock-closed-outline" size={32} color={colors.accentPrimary} />
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t.settings.changePassword}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t.auth.subtitle}
          </Text>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label={t.auth.email}
              placeholder="email@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon="mail-outline"
              error={emailError}
            />

            <Button
              title={t.common.send}
              onPress={handleResetPassword}
              loading={isLoading}
              fullWidth
              style={styles.submitButton}
            />
          </View>

          {/* Back to login */}
          <TouchableOpacity onPress={handleBackToLogin} style={styles.loginLink}>
            <Ionicons name="arrow-back" size={16} color={colors.accentPrimary} />
            <Text style={[styles.loginLinkText, { color: colors.accentPrimary }]}>
              {t.auth.signIn}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  backButtonIcon: {
    alignSelf: 'flex-start',
    marginBottom: Spacing.lg,
    marginLeft: -Spacing.sm,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bodySemiBold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
    lineHeight: Typography.fontSize.base * Typography.lineHeight.relaxed,
    paddingHorizontal: Spacing.md,
  },
  form: {
    marginBottom: Spacing.lg,
  },
  submitButton: {
    marginTop: Spacing.md,
  },
  loginLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    gap: Spacing.xs,
  },
  loginLinkText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  successTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bodySemiBold,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  successText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
    lineHeight: Typography.fontSize.base * Typography.lineHeight.relaxed,
  },
  backButton: {
    marginTop: Spacing.lg,
  },
});

export default ForgotPasswordScreen;
