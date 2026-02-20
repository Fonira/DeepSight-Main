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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/stores/authStore';
import { authApi, ApiError } from '@/services/api';
import { sp, borderRadius } from '@/theme/spacing';
import { fontFamily, fontSize, textStyles } from '@/theme/typography';
import { palette } from '@/theme/colors';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { colors } = useTheme();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
  const [resendLoading, setResendLoading] = useState(false);

  const inputRefs = useRef<Array<TextInput | null>>(Array(CODE_LENGTH).fill(null));

  // Countdown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleCodeChange = useCallback(
    (text: string, index: number) => {
      // Handle paste (multi-char input)
      if (text.length > 1) {
        const chars = text.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH).split('');
        const newCode = [...code];
        chars.forEach((char, i) => {
          if (index + i < CODE_LENGTH) {
            newCode[index + i] = char;
          }
        });
        setCode(newCode);
        setError('');
        const nextIndex = Math.min(index + chars.length, CODE_LENGTH - 1);
        inputRefs.current[nextIndex]?.focus();
        return;
      }

      const digit = text.replace(/[^0-9]/g, '');
      const newCode = [...code];
      newCode[index] = digit;
      setCode(newCode);
      setError('');

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

  const handleVerify = useCallback(async () => {
    const fullCode = code.join('');
    if (fullCode.length !== CODE_LENGTH) {
      setError('Entrez le code complet à 6 chiffres');
      return;
    }
    if (!email) {
      Alert.alert('Erreur', 'Email manquant');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    setError('');

    try {
      const response = await authApi.verifyEmail(email, fullCode);
      setAuth(response.user, {
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
      });
      router.replace('/(tabs)');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          setError('Code invalide ou expiré');
        } else {
          Alert.alert('Erreur', err.message || 'Vérification échouée');
        }
      } else {
        Alert.alert('Erreur', 'Vérifiez votre connexion internet.');
      }
    } finally {
      setLoading(false);
    }
  }, [code, email, setAuth, router]);

  const handleResend = useCallback(async () => {
    if (resendTimer > 0 || !email) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setResendLoading(true);

    try {
      await authApi.resendVerification(email);
      setResendTimer(RESEND_COOLDOWN);
      Alert.alert('Code envoyé', 'Un nouveau code a été envoyé à votre email.');
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de renvoyer le code.');
    } finally {
      setResendLoading(false);
    }
  }, [resendTimer, email]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.content}>
          {/* Back button */}
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: `${palette.indigo}15` }]}>
              <Ionicons name="mail-outline" size={32} color={palette.indigo} />
            </View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Vérifiez votre email
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Un code a été envoyé à{'\n'}
              <Text style={{ color: colors.textPrimary, fontFamily: fontFamily.bodySemiBold }}>
                {email || '---'}
              </Text>
            </Text>
          </View>

          {/* OTP Inputs */}
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
                      : error
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
                textContentType="oneTimeCode"
              />
            ))}
          </View>

          {error ? (
            <Text style={[styles.error, { color: colors.accentError }]}>{error}</Text>
          ) : null}

          {/* Verify button */}
          <Button
            title="Vérifier"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            disabled={loading || code.join('').length !== CODE_LENGTH}
            onPress={handleVerify}
            style={styles.verifyButton}
          />

          {/* Resend */}
          <Pressable
            onPress={handleResend}
            disabled={resendTimer > 0 || resendLoading}
            style={styles.resendContainer}
            hitSlop={8}
          >
            <Text
              style={[
                styles.resendText,
                {
                  color: resendTimer > 0 ? colors.textMuted : palette.indigo,
                },
              ]}
            >
              {resendLoading
                ? 'Envoi en cours...'
                : resendTimer > 0
                ? `Renvoyer le code (${resendTimer}s)`
                : 'Renvoyer le code'}
            </Text>
          </Pressable>
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
    marginBottom: sp['3xl'],
  },
  header: {
    alignItems: 'center',
    marginBottom: sp['4xl'],
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sp.xl,
  },
  title: {
    ...textStyles.headingLg,
    textAlign: 'center',
    marginBottom: sp.md,
  },
  subtitle: {
    ...textStyles.bodyMd,
    textAlign: 'center',
    lineHeight: fontSize.base * 1.6,
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
  verifyButton: {
    marginTop: sp.sm,
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
