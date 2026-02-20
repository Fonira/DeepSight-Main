import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/services/api';
import { sp, borderRadius } from '@/theme/spacing';
import { fontFamily, fontSize, textStyles } from '@/theme/typography';
import { palette } from '@/theme/colors';
import { DoodleBackground } from '@/components/ui/DoodleBackground';
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
} from '@/constants/config';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { login: contextLogin, loginWithGoogleToken } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const passwordRef = useRef<TextInput>(null);

  // Google OAuth
  const [, googleResponse, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });

  React.useEffect(() => {
    if (googleResponse?.type === 'success' && googleResponse.authentication?.accessToken) {
      handleGoogleLogin(googleResponse.authentication.accessToken);
    }
  }, [googleResponse]);

  const validate = useCallback((): boolean => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      newErrors.email = 'L\'email est requis';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Email invalide';
    }
    if (!password) {
      newErrors.password = 'Le mot de passe est requis';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [email, password]);

  const handleLogin = useCallback(async () => {
    if (!validate()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    setErrors({});

    try {
      // Use AuthContext login → updates isAuthenticated → _layout.tsx auto-redirects to (tabs)
      await contextLogin(email.trim(), password);
      // No need for router.replace — _layout.tsx auth guard handles redirect
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.isEmailNotVerified) {
          router.push({ pathname: '/(auth)/verify', params: { email: email.trim() } });
          return;
        }
        if (error.status === 401) {
          setErrors({ password: 'Email ou mot de passe incorrect' });
        } else {
          Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        }
      } else {
        Alert.alert('Erreur', 'Impossible de se connecter. Vérifiez votre connexion internet.');
      }
    } finally {
      setLoading(false);
    }
  }, [email, password, validate, contextLogin, router]);

  const handleGoogleLogin = useCallback(async (accessToken: string) => {
    setGoogleLoading(true);
    try {
      // Use AuthContext's loginWithGoogleToken → sets user → _layout.tsx auto-redirects
      await loginWithGoogleToken(accessToken);
    } catch (error) {
      if (error instanceof ApiError) {
        Alert.alert('Erreur Google', error.message || 'Échec de la connexion Google');
      } else {
        Alert.alert('Erreur', 'Impossible de se connecter avec Google.');
      }
    } finally {
      setGoogleLoading(false);
    }
  }, [loginWithGoogleToken]);

  const handleGooglePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    promptAsync();
  }, [promptAsync]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <DoodleBackground variant="tech" density="low" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button */}
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>

          {/* Header */}
          <Text style={[styles.title, { color: colors.textPrimary }]}>Connexion</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Connectez-vous à votre compte DeepSight
          </Text>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="Email"
              placeholder="votre@email.com"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              leftIcon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <Input
              ref={passwordRef}
              label="Mot de passe"
              placeholder="Votre mot de passe"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              leftIcon="lock-closed-outline"
              secureTextEntry
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            {/* Forgot password */}
            <Pressable
              onPress={() => router.push('/(auth)/forgot-password')}
              style={styles.forgotLink}
              hitSlop={8}
            >
              <Text style={[styles.forgotText, { color: palette.indigo }]}>
                Mot de passe oublié ?
              </Text>
            </Pressable>

            {/* Login button */}
            <Button
              title="Se connecter"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              disabled={loading || googleLoading}
              onPress={handleLogin}
            />

            {/* Separator */}
            <View style={styles.separator}>
              <View style={[styles.separatorLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.separatorText, { color: colors.textMuted }]}>ou</Text>
              <View style={[styles.separatorLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Google button */}
            <Button
              title="Continuer avec Google"
              variant="secondary"
              size="lg"
              fullWidth
              loading={googleLoading}
              disabled={loading || googleLoading}
              onPress={handleGooglePress}
              icon={
                <Ionicons name="logo-google" size={20} color={colors.textPrimary} />
              }
            />
          </View>

          {/* Register link */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textTertiary }]}>
              Pas de compte ?{' '}
            </Text>
            <Pressable onPress={() => router.push('/(auth)/register')} hitSlop={8}>
              <Text style={[styles.footerLink, { color: palette.indigo }]}>
                Créer un compte
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.xl,
  },
  backButton: {
    marginBottom: sp['3xl'],
  },
  title: {
    ...textStyles.displaySm,
    marginBottom: sp.sm,
  },
  subtitle: {
    ...textStyles.bodyMd,
    marginBottom: sp['3xl'],
  },
  form: {
    gap: 0,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: sp.xl,
    marginTop: -sp.sm,
  },
  forgotText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: sp.xl,
  },
  separatorLine: {
    flex: 1,
    height: 1,
  },
  separatorText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginHorizontal: sp.lg,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: sp['3xl'],
  },
  footerText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },
  footerLink: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
});
