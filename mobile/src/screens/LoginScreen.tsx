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
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
  FadeInDown,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Animated orb component for background
const AnimatedOrb: React.FC<{ color: string; position: 'topLeft' | 'bottomRight' }> = ({ color, position }) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.3, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const posStyle = position === 'topLeft'
    ? { top: -80, left: -80 }
    : { bottom: -60, right: -80 };

  return (
    <Animated.View style={[styles.orb, { backgroundColor: color, ...posStyle }, animStyle]} />
  );
};

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
    logoScale.value = withDelay(200, withSpring(1, { damping: 8, stiffness: 100 }));
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

      {/* Animated orbs */}
      {isDark && (
        <>
          <AnimatedOrb color="#3b82f6" position="topLeft" />
          <AnimatedOrb color="#8b5cf6" position="bottomRight" />
        </>
      )}

      {/* Subtle accent glow */}
      {isDark && (
        <View style={styles.glowContainer}>
          <LinearGradient
            colors={['rgba(59,130,246,0.12)', 'transparent']}
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
            <Text style={styles.tagline}>
              Ne regardez plus vos vidéos. Analysez-les.
            </Text>
          </Animated.View>

          {/* Platform logos */}
          <Animated.View entering={FadeInDown.delay(150).springify().damping(8)} style={styles.platformLogos}>
            <Image
              source={isDark
                ? require('../assets/platforms/youtube-logo-white.png')
                : require('../assets/platforms/youtube-logo-dark.png')
              }
              style={styles.platformLogoYt}
              resizeMode="contain"
            />
            <View style={[styles.platformDivider, { backgroundColor: colors.border }]} />
            <Image
              source={isDark
                ? require('../assets/platforms/tiktok-logo-white.png')
                : require('../assets/platforms/tiktok-logo-black.png')
              }
              style={styles.platformLogoTk}
              resizeMode="contain"
            />
            <View style={[styles.platformDivider, { backgroundColor: colors.border }]} />
            <Image
              source={require('../assets/platforms/mistral-logo-white.png')}
              style={[styles.platformLogoMistral, !isDark && { tintColor: '#1a1a2e' }]}
              resizeMode="contain"
            />
            <View style={[styles.platformDivider, { backgroundColor: colors.border }]} />
            <Image
              source={require('../assets/platforms/tournesol-logo.png')}
              style={styles.platformLogoTournesol}
              resizeMode="contain"
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).springify().damping(8)}>
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

          {/* Form — Glassmorphism container */}
          <Animated.View entering={FadeInDown.delay(300).springify().damping(8)} style={styles.glassFormWrapper}>
            {isDark && (
              <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
            )}
            <View style={styles.glassFormContent}>
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
                  {t.auth.forgotPassword}
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
            </View>
          </Animated.View>

          {/* Divider */}
          <Animated.View entering={FadeInDown.delay(400).springify().damping(8)} style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textMuted }]}>{t.common.or}</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </Animated.View>

          {/* Google login */}
          <Animated.View entering={FadeInDown.delay(500).springify().damping(8)}>
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
          <Animated.View entering={FadeInDown.delay(600).springify().damping(8)} style={styles.registerContainer}>
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
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 12,
    marginBottom: sp.md,
  },
  logoImage: {
    width: 112,
    height: 112,
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
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  orb: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.15,
  },
  glassFormWrapper: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
    marginBottom: sp.lg,
  },
  glassFormContent: {
    padding: 24,
  },
  platformLogos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: sp.md,
    marginBottom: sp.xl,
    opacity: 0.4,
    paddingHorizontal: sp.lg,
  },
  platformLogoYt: {
    height: 24,
    width: 100,
  },
  platformLogoTk: {
    height: 24,
    width: 90,
  },
  platformLogoMistral: {
    height: 20,
    width: 80,
  },
  platformLogoTournesol: {
    height: 20,
    width: 20,
  },
  platformDivider: {
    width: 1,
    height: 24,
  },
});

export default LoginScreen;
