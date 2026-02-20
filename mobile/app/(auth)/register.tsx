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
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/contexts/ThemeContext';
import { authApi, ApiError } from '@/services/api';
import { sp, borderRadius } from '@/theme/spacing';
import { fontFamily, fontSize, textStyles } from '@/theme/typography';
import { palette } from '@/theme/colors';
import { DoodleBackground } from '@/components/ui/DoodleBackground';

interface FormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  cgu?: string;
}

export default function RegisterScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cguAccepted, setCguAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    if (!username.trim()) {
      newErrors.username = "Le nom d'utilisateur est requis";
    } else if (username.trim().length < 3) {
      newErrors.username = 'Minimum 3 caractères';
    }
    if (!email.trim()) {
      newErrors.email = "L'email est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Email invalide';
    }
    if (!password) {
      newErrors.password = 'Le mot de passe est requis';
    } else if (password.length < 8) {
      newErrors.password = 'Minimum 8 caractères';
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirmez le mot de passe';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }
    if (!cguAccepted) {
      newErrors.cgu = 'Vous devez accepter les CGU';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [username, email, password, confirmPassword, cguAccepted]);

  const handleRegister = useCallback(async () => {
    if (!validate()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    setErrors({});

    try {
      await authApi.register(username.trim(), email.trim(), password);
      router.push({ pathname: '/(auth)/verify', params: { email: email.trim() } });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409 || error.message?.toLowerCase().includes('exist')) {
          setErrors({ email: 'Cet email est déjà utilisé' });
        } else {
          Alert.alert('Erreur', error.message || 'Impossible de créer le compte');
        }
      } else {
        Alert.alert('Erreur', 'Vérifiez votre connexion internet.');
      }
    } finally {
      setLoading(false);
    }
  }, [username, email, password, validate, router]);

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
          <Text style={[styles.title, { color: colors.textPrimary }]}>Créer un compte</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Inscrivez-vous pour commencer à analyser des vidéos
          </Text>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="Nom d'utilisateur"
              placeholder="votre_pseudo"
              value={username}
              onChangeText={setUsername}
              error={errors.username}
              leftIcon="person-outline"
              autoCapitalize="none"
              autoComplete="username"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
            />

            <Input
              ref={emailRef}
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
              placeholder="Minimum 8 caractères"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              leftIcon="lock-closed-outline"
              secureTextEntry
              autoComplete="new-password"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
            />

            <Input
              ref={confirmRef}
              label="Confirmer le mot de passe"
              placeholder="Retapez le mot de passe"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              error={errors.confirmPassword}
              leftIcon="lock-closed-outline"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />

            {/* CGU Checkbox */}
            <Pressable
              style={styles.cguRow}
              onPress={() => setCguAccepted(!cguAccepted)}
              hitSlop={4}
            >
              <View
                style={[
                  styles.checkbox,
                  { borderColor: errors.cgu ? colors.accentError : colors.borderLight },
                  cguAccepted && { backgroundColor: palette.indigo, borderColor: palette.indigo },
                ]}
              >
                {cguAccepted && (
                  <Ionicons name="checkmark" size={14} color="#ffffff" />
                )}
              </View>
              <Text style={[styles.cguText, { color: colors.textSecondary }]}>
                J'accepte les{' '}
                <Text style={{ color: palette.indigo }}>
                  conditions générales d'utilisation
                </Text>
              </Text>
            </Pressable>
            {errors.cgu && (
              <Text style={[styles.cguError, { color: colors.accentError }]}>
                {errors.cgu}
              </Text>
            )}

            {/* Register button */}
            <Button
              title="Créer mon compte"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              disabled={loading}
              onPress={handleRegister}
              style={styles.registerButton}
            />
          </View>

          {/* Login link */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textTertiary }]}>
              Déjà un compte ?{' '}
            </Text>
            <Pressable onPress={() => router.push('/(auth)/login')} hitSlop={8}>
              <Text style={[styles.footerLink, { color: palette.indigo }]}>
                Se connecter
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
  cguRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: sp.xs,
    gap: sp.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cguText: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },
  cguError: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginTop: sp.xs,
    marginLeft: sp['3xl'],
  },
  registerButton: {
    marginTop: sp.xl,
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
