import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Image,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  FadeInDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenDoodleVariant } from '../contexts/DoodleVariantContext';
import { Button, Input } from '../components/ui';
import { gradients } from '../theme/colors';
import { sp, borderRadius } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';
import type { RootStackParamList } from '../types';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const { login, loginWithGoogle, isLoading, error, clearError, pendingVerificationEmail, clearPendingVerification } = useAuth();
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  useScreenDoodleVariant('creative');

  useEffect(() => {
    if (pendingVerificationEmail) {
      navigation.navigate('VerifyEmail', { email: pendingVerificationEmail });
      clearPendingVerification();
    }
  }, [pendingVerificationEmail, navigation, clearPendingVerification]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Animated logo
  const logoScale = useSharedValue(0.8);
  const logoOpacity = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withDelay(200, withTiming(1, { duration: 600 }));
    logoScale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 100 }));
    clearError();
  }, [logoScale, logoOpacity, clearError]);

  const logoAnimStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const validateForm = (): boolean => {
    let isValid = true;
    clearError();

    if (!email.trim()) {
      setEmailError(t.common.required);
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError(t.errors.invalidEmail);
      isValid = false;
    } else {
      setEmailError('');
    }

    if (!password) {
      setPasswordError(t.common.required);
      isValid = false;
    } else if (password.length < 8) {
      setPasswordError(t.errors.passwordMinLength);
      isValid = false;
    } else {
      setPasswordError('');
    }

    return isValid;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await login(email, password);
    } catch (err) {
      // Handled by AuthContext
    }
  };

  const handleGoogleLogin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await loginWithGoogle();
    } catch (err) {
      // Error displayed via error state
    }
  };

  return (
    <View style={styles.container}>
      {/* Gradient background */}
      <LinearGradient
        colors={isDark
          ? ['#0a0a0f', '#0f0f1a', '#0a0a0f']
          : ['#f8f9ff', '#f0f0ff', '#ffffff']
        }
        style={StyleSheet.absoluteFill}
      />

      {/* Subtle accent glow */}
      {isDark && (
        <View style={styles.glowContainer}>
          <LinearGradient
            colors={['rgba(59,130,246,0.08)', 'transparent']}
            style={styles.glow}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + sp['3xl'], paddingBottom: insets.bottom + sp['3xl'] },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Animated Logo */}
          <Animated.View style={[styles.logoContainer, logoAnimStyle]}>
            <View style={[styles.logoGlow, { shadowColor: colors.accentPrimary }]}>
              <Image
                source={require('../assets/images/icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.logoText}>
              <Text style={[styles.logoDeep, { color: colors.accentPrimary }]}>Deep</Text>
              <Text style={[styles.logoSight, { color: colors.textPrimary }]}>Sight</Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400).duration(500)}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {t.auth.welcomeBack}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t.auth.subtitle}
            </Text>
          </Animated.View>

          {/* Error message */}
          {error && (
            <Animated.View
              entering={FadeInDown.duration(300)}
              style={[styles.errorContainer, { backgroundColor: `${colors.accentError}15`, borderColor: `${colors.accentError}30` }]}
            >
              <Ionicons name="alert-circle" size={20} color={colors.accentError} />
              <Text style={[styles.errorText, { color: colors.accentError }]}>{error}</Text>
            </Animated.View>
          )}

          {/* Form */}
          <Animated.View entering={FadeInDown.delay(500).duration(500)} style={styles.form}>
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

            <Input
              label={t.auth.password}
              placeholder={t.auth.password}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              leftIcon="lock-closed-outline"
              error={passwordError}
            />

            <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotPassword}>
              <Text style={[styles.forgotPasswordText, { color: colors.accentPrimary }]}>
                {t.settings.changePassword}
              </Text>
            </Pressable>

            <Button
              title={t.auth.signIn}
              onPress={handleLogin}
              loading={isLoading}
              fullWidth
              size="lg"
              style={styles.loginButton}
            />
          </Animated.View>

          {/* Divider */}
          <Animated.View entering={FadeInDown.delay(600).duration(500)} style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textMuted }]}>{t.common.or}</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </Animated.View>

          {/* Google login */}
          <Animated.View entering={FadeInDown.delay(700).duration(500)}>
            <Button
              title={t.auth.loginWithGoogle}
              variant="outline"
              onPress={handleGoogleLogin}
              fullWidth
              size="lg"
              icon={<Ionicons name="logo-google" size={20} color={colors.textPrimary} />}
            />
          </Animated.View>

          {/* Register link */}
          <Animated.View entering={FadeInDown.delay(800).duration(500)} style={styles.registerContainer}>
            <Text style={[styles.registerText, { color: colors.textSecondary }]}>
              {t.auth.noAccount}{' '}
            </Text>
            <Pressable onPress={() => navigation.navigate('Register')}>
              <Text style={[styles.registerLink, { color: colors.accentPrimary }]}>
                {t.auth.signUp}
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  glowContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  glow: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: sp.xl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: sp['3xl'],
  },
  logoGlow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: sp.md,
  },
  logoImage: {
    width: 88,
    height: 88,
    borderRadius: borderRadius.xl,
  },
  logoText: {
    flexDirection: 'row',
  },
  logoDeep: {
    fontSize: fontSize['3xl'],
    fontFamily: fontFamily.bodySemiBold,
  },
  logoSight: {
    fontSize: fontSize['3xl'],
    fontFamily: fontFamily.bodySemiBold,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontFamily: fontFamily.bodySemiBold,
    textAlign: 'center',
    marginBottom: sp.sm,
  },
  subtitle: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.body,
    textAlign: 'center',
    marginBottom: sp['2xl'],
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: sp.md,
    borderRadius: borderRadius.md,
    marginBottom: sp.lg,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    marginLeft: sp.sm,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.body,
  },
  form: {
    marginBottom: sp.lg,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: -sp.sm,
    marginBottom: sp.lg,
  },
  forgotPasswordText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bodyMedium,
  },
  loginButton: {
    marginTop: sp.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: sp.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: sp.md,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.body,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: sp.xl,
  },
  registerText: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.body,
  },
  registerLink: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bodySemiBold,
  },
});

export default LoginScreen;
