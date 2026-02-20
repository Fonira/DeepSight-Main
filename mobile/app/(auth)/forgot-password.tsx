import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
  TextInput,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated';
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
import { timings } from '@/theme/animations';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

type Step = 1 | 2 | 3;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  // Step 2
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [codeError, setCodeError] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const inputRefs = useRef<Array<TextInput | null>>(Array(CODE_LENGTH).fill(null));

  // Step 3
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<{
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [resetLoading, setResetLoading] = useState(false);
  const confirmRef = useRef<TextInput>(null);

  // The reset token (the code itself, used for resetPassword API)
  const [resetToken, setResetToken] = useState('');

  // Progress bar
  const progress = useSharedValue(0.33);

  useEffect(() => {
    progress.value = withTiming(step / 3, timings.standard);
  }, [step, progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  // Resend countdown
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Step 1: Send code
  const handleSendCode = useCallback(async () => {
    if (!email.trim()) {
      setEmailError("L'email est requis");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError('Email invalide');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEmailLoading(true);
    setEmailError('');

    try {
      await authApi.forgotPassword(email.trim());
      setResendTimer(RESEND_COOLDOWN);
      setStep(2);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setEmailError('Aucun compte associé à cet email');
        } else {
          Alert.alert('Erreur', err.message || "Impossible d'envoyer le code");
        }
      } else {
        Alert.alert('Erreur', 'Vérifiez votre connexion internet.');
      }
    } finally {
      setEmailLoading(false);
    }
  }, [email]);

  // Step 2: Verify code
  const handleCodeChange = useCallback(
    (text: string, index: number) => {
      if (text.length > 1) {
        const chars = text.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH).split('');
        const newCode = [...code];
        chars.forEach((char, i) => {
          if (index + i < CODE_LENGTH) {
            newCode[index + i] = char;
          }
        });
        setCode(newCode);
        setCodeError('');
        const nextIndex = Math.min(index + chars.length, CODE_LENGTH - 1);
        inputRefs.current[nextIndex]?.focus();
        return;
      }

      const digit = text.replace(/[^0-9]/g, '');
      const newCode = [...code];
      newCode[index] = digit;
      setCode(newCode);
      setCodeError('');

      if (digit && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [code],
  );

  const handleKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === 'Backspace' && !code[index] && index > 0) {
        const newCode = [...code];
        newCode[index - 1] = '';
        setCode(newCode);
        inputRefs.current[index - 1]?.focus();
      }
    },
    [code],
  );

  const handleVerifyCode = useCallback(async () => {
    const fullCode = code.join('');
    if (fullCode.length !== CODE_LENGTH) {
      setCodeError('Entrez le code complet');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setResetToken(fullCode);
    setStep(3);
  }, [code]);

  const handleResend = useCallback(async () => {
    if (resendTimer > 0) return;
    try {
      await authApi.forgotPassword(email.trim());
      setResendTimer(RESEND_COOLDOWN);
      Alert.alert('Code envoyé', 'Un nouveau code a été envoyé.');
    } catch {
      Alert.alert('Erreur', 'Impossible de renvoyer le code.');
    }
  }, [resendTimer, email]);

  // Step 3: Reset password
  const handleResetPassword = useCallback(async () => {
    const errs: { newPassword?: string; confirmPassword?: string } = {};
    if (!newPassword) {
      errs.newPassword = 'Le mot de passe est requis';
    } else if (newPassword.length < 8) {
      errs.newPassword = 'Minimum 8 caractères';
    }
    if (!confirmPassword) {
      errs.confirmPassword = 'Confirmez le mot de passe';
    } else if (newPassword !== confirmPassword) {
      errs.confirmPassword = 'Les mots de passe ne correspondent pas';
    }
    if (Object.keys(errs).length > 0) {
      setPasswordErrors(errs);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setResetLoading(true);
    setPasswordErrors({});

    try {
      await authApi.resetPassword(resetToken, newPassword);
      Alert.alert(
        'Mot de passe réinitialisé',
        'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }],
      );
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          setCodeError('Code invalide ou expiré');
          setStep(2);
        } else {
          Alert.alert('Erreur', err.message || 'Réinitialisation échouée');
        }
      } else {
        Alert.alert('Erreur', 'Vérifiez votre connexion internet.');
      }
    } finally {
      setResetLoading(false);
    }
  }, [newPassword, confirmPassword, resetToken, router]);

  const handleBack = useCallback(() => {
    if (step === 1) {
      router.back();
    } else {
      setStep((prev) => (prev - 1) as Step);
    }
  }, [step, router]);

  const stepTitles: Record<Step, string> = {
    1: 'Mot de passe oublié',
    2: 'Vérifier le code',
    3: 'Nouveau mot de passe',
  };

  const stepSubtitles: Record<Step, string> = {
    1: 'Entrez votre email pour recevoir un code de réinitialisation',
    2: `Un code a été envoyé à ${email}`,
    3: 'Choisissez un nouveau mot de passe sécurisé',
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.content}>
          {/* Back */}
          <Pressable onPress={handleBack} style={styles.backButton} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>

          {/* Progress bar */}
          <View style={[styles.progressTrack, { backgroundColor: colors.bgElevated }]}>
            <Animated.View
              style={[styles.progressFill, { backgroundColor: palette.indigo }, progressStyle]}
            />
          </View>

          {/* Header */}
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {stepTitles[step]}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {stepSubtitles[step]}
          </Text>

          {/* Step 1: Email */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Input
                label="Email"
                placeholder="votre@email.com"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setEmailError('');
                }}
                error={emailError}
                leftIcon="mail-outline"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="done"
                onSubmitEditing={handleSendCode}
              />
              <Button
                title="Envoyer le code"
                variant="primary"
                size="lg"
                fullWidth
                loading={emailLoading}
                disabled={emailLoading}
                onPress={handleSendCode}
              />
            </View>
          )}

          {/* Step 2: Code OTP */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <View style={styles.otpContainer}>
                {code.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => {
                      inputRefs.current[index] = ref;
                    }}
                    style={[
                      styles.otpInput,
                      {
                        backgroundColor: colors.bgElevated,
                        borderColor: digit
                          ? palette.indigo
                          : codeError
                          ? colors.accentError
                          : colors.border,
                        color: colors.textPrimary,
                      },
                    ]}
                    value={digit}
                    onChangeText={(text) => handleCodeChange(text, index)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                    keyboardType="number-pad"
                    maxLength={index === 0 ? CODE_LENGTH : 1}
                    selectTextOnFocus
                  />
                ))}
              </View>

              {codeError ? (
                <Text style={[styles.error, { color: colors.accentError }]}>{codeError}</Text>
              ) : null}

              <Button
                title="Vérifier"
                variant="primary"
                size="lg"
                fullWidth
                loading={codeLoading}
                disabled={codeLoading || code.join('').length !== CODE_LENGTH}
                onPress={handleVerifyCode}
              />

              <Pressable
                onPress={handleResend}
                disabled={resendTimer > 0}
                style={styles.resendContainer}
                hitSlop={8}
              >
                <Text
                  style={[
                    styles.resendText,
                    { color: resendTimer > 0 ? colors.textMuted : palette.indigo },
                  ]}
                >
                  {resendTimer > 0
                    ? `Renvoyer le code (${resendTimer}s)`
                    : 'Renvoyer le code'}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Step 3: New password */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Input
                label="Nouveau mot de passe"
                placeholder="Minimum 8 caractères"
                value={newPassword}
                onChangeText={(t) => {
                  setNewPassword(t);
                  setPasswordErrors({});
                }}
                error={passwordErrors.newPassword}
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
                onChangeText={(t) => {
                  setConfirmPassword(t);
                  setPasswordErrors({});
                }}
                error={passwordErrors.confirmPassword}
                leftIcon="lock-closed-outline"
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleResetPassword}
              />
              <Button
                title="Réinitialiser"
                variant="primary"
                size="lg"
                fullWidth
                loading={resetLoading}
                disabled={resetLoading}
                onPress={handleResetPassword}
              />
            </View>
          )}
        </View>
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
  content: {
    flex: 1,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.xl,
  },
  backButton: {
    marginBottom: sp.xl,
  },
  progressTrack: {
    height: 4,
    borderRadius: borderRadius.full,
    marginBottom: sp['3xl'],
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  title: {
    ...textStyles.headingLg,
    marginBottom: sp.sm,
  },
  subtitle: {
    ...textStyles.bodyMd,
    marginBottom: sp['3xl'],
    lineHeight: fontSize.base * 1.6,
  },
  stepContent: {
    gap: 0,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: sp.sm,
    marginBottom: sp.lg,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    textAlign: 'center',
    fontSize: fontSize.xl,
    fontFamily: fontFamily.bodySemiBold,
  },
  error: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: sp.lg,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: sp.xl,
  },
  resendText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
});
