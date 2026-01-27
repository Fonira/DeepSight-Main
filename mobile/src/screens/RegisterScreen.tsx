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
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Button, Input } from '../components/ui';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import type { RootStackParamList } from '../types';

type RegisterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

export const RegisterScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { register, isLoading, error, clearError } = useAuth();
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const insets = useSafeAreaInsets();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // Clear any stale errors when screen loads
  useEffect(() => {
    clearError();
  }, [clearError]);

  const validateForm = (): boolean => {
    const newErrors = {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    };
    let isValid = true;
    clearError();

    if (!username.trim()) {
      newErrors.username = t.common.required;
      isValid = false;
    } else if (username.length < 3) {
      newErrors.username = t.errors.usernameMinLength;
      isValid = false;
    }

    if (!email.trim()) {
      newErrors.email = t.common.required;
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = t.errors.invalidEmail;
      isValid = false;
    }

    if (!password) {
      newErrors.password = t.common.required;
      isValid = false;
    } else if (password.length < 8) {
      newErrors.password = t.errors.passwordMinLength;
      isValid = false;
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = t.common.required;
      isValid = false;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = t.errors.passwordMismatch;
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    try {
      const result = await register(username, email, password);
      if (result.requiresVerification) {
        navigation.navigate('VerifyEmail', { email });
      }
    } catch (err) {
      // Error is handled by AuthContext
    }
  };

  const handleLogin = () => {
    navigation.navigate('Login');
  };

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
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
          </TouchableOpacity>

          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t.auth.createAccount}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t.auth.subtitle}
          </Text>

          {/* Error message */}
          {error && (
            <View style={[styles.errorContainer, { backgroundColor: `${colors.accentError}15` }]}>
              <Ionicons name="alert-circle" size={20} color={colors.accentError} />
              <Text style={[styles.errorText, { color: colors.accentError }]}>{error}</Text>
            </View>
          )}

          {/* Form */}
          <View style={styles.form}>
            <Input
              label={t.settings.displayName}
              placeholder="johndoe"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoComplete="username"
              leftIcon="person-outline"
              error={errors.username}
            />

            <Input
              label={t.auth.email}
              placeholder="email@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon="mail-outline"
              error={errors.email}
            />

            <Input
              label={t.auth.password}
              placeholder={t.auth.password}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              leftIcon="lock-closed-outline"
              error={errors.password}
            />

            <Input
              label={t.settings.newPassword}
              placeholder={t.settings.newPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="new-password"
              leftIcon="lock-closed-outline"
              error={errors.confirmPassword}
            />

            <Button
              title={t.auth.signUp}
              onPress={handleRegister}
              loading={isLoading}
              fullWidth
              style={styles.registerButton}
            />
          </View>

          {/* Terms */}
          <Text style={[styles.terms, { color: colors.textTertiary }]}>
            {t.auth.termsAgreement}
          </Text>

          {/* Login link */}
          <View style={styles.loginContainer}>
            <Text style={[styles.loginText, { color: colors.textSecondary }]}>
              {t.auth.hasAccount}{' '}
            </Text>
            <TouchableOpacity onPress={handleLogin}>
              <Text style={[styles.loginLink, { color: colors.accentPrimary }]}>
                {t.auth.signIn}
              </Text>
            </TouchableOpacity>
          </View>
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
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: Spacing.lg,
    marginLeft: -Spacing.sm,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    marginBottom: Spacing.xxl,
    lineHeight: Typography.fontSize.base * Typography.lineHeight.relaxed,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  form: {
    marginBottom: Spacing.lg,
  },
  registerButton: {
    marginTop: Spacing.md,
  },
  terms: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.relaxed,
    marginBottom: Spacing.xl,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  loginText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
  },
  loginLink: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
});

export default RegisterScreen;
