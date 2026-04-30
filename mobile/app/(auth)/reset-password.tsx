import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useTheme } from "@/contexts/ThemeContext";
import { authApi, ApiError } from "@/services/api";
import { sp } from "@/theme/spacing";
import { fontSize, textStyles } from "@/theme/typography";
import { palette } from "@/theme/colors";
import { DoodleBackground } from "@/components/ui/DoodleBackground";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ code?: string; email?: string }>();

  const code = (params.code ?? "").trim();
  const email = (params.email ?? "").trim();
  const hasParams = code.length > 0 && email.length > 0;

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const confirmRef = useRef<TextInput>(null);

  const handleSubmit = useCallback(async () => {
    const errs: { newPassword?: string; confirmPassword?: string } = {};
    if (!newPassword) {
      errs.newPassword = "Le mot de passe est requis";
    } else if (newPassword.length < 6) {
      errs.newPassword = "Minimum 6 caractères";
    }
    if (!confirmPassword) {
      errs.confirmPassword = "Confirmez le mot de passe";
    } else if (newPassword !== confirmPassword) {
      errs.confirmPassword = "Les mots de passe ne correspondent pas";
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    setErrors({});

    try {
      await authApi.resetPassword(email, code, newPassword);
      Alert.alert(
        "Mot de passe réinitialisé",
        "Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.",
        [{ text: "OK", onPress: () => router.replace("/(auth)/login") }],
      );
    } catch (err) {
      if (err instanceof ApiError) {
        Alert.alert(
          "Lien invalide ou expiré",
          err.message ||
            "Le lien de réinitialisation a expiré. Demandez-en un nouveau.",
          [
            {
              text: "Demander un nouveau lien",
              onPress: () => router.replace("/(auth)/forgot-password"),
            },
            { text: "Annuler", style: "cancel" },
          ],
        );
      } else {
        Alert.alert("Erreur", "Vérifiez votre connexion internet.");
      }
    } finally {
      setLoading(false);
    }
  }, [newPassword, confirmPassword, email, code, router]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bgPrimary }]}
    >
      <DoodleBackground variant="default" density="low" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <View style={styles.content}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>

          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Nouveau mot de passe
          </Text>

          {!hasParams ? (
            <View style={styles.errorContainer}>
              <View
                style={[
                  styles.errorIconWrap,
                  { backgroundColor: colors.accentError + "20" },
                ]}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={40}
                  color={colors.accentError}
                />
              </View>
              <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>
                Lien invalide
              </Text>
              <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                Ce lien de réinitialisation est incomplet ou expiré. Demandez un
                nouveau lien depuis la page de connexion.
              </Text>
              <Button
                title="Demander un nouveau lien"
                variant="primary"
                size="lg"
                fullWidth
                onPress={() => router.replace("/(auth)/forgot-password")}
              />
            </View>
          ) : (
            <>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Pour <Text style={{ color: colors.textPrimary }}>{email}</Text>
                {"\n"}Choisissez un nouveau mot de passe sécurisé.
              </Text>

              <View style={styles.stepContent}>
                <Input
                  label="Nouveau mot de passe"
                  placeholder="Minimum 6 caractères"
                  value={newPassword}
                  onChangeText={(t) => {
                    setNewPassword(t);
                    setErrors({});
                  }}
                  error={errors.newPassword}
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
                    setErrors({});
                  }}
                  error={errors.confirmPassword}
                  leftIcon="lock-closed-outline"
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <Button
                  title="Réinitialiser"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={loading}
                  disabled={loading}
                  onPress={handleSubmit}
                />
              </View>
            </>
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
  title: {
    ...textStyles.headingLg,
    marginBottom: sp.sm,
  },
  subtitle: {
    ...textStyles.bodyMd,
    marginBottom: sp["3xl"],
    lineHeight: fontSize.base * 1.6,
  },
  stepContent: {
    gap: 0,
  },
  errorContainer: {
    alignItems: "center",
    paddingTop: sp.xl,
    gap: sp.lg,
  },
  errorIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: sp.md,
  },
  errorTitle: {
    ...textStyles.headingMd,
    textAlign: "center",
  },
  errorText: {
    ...textStyles.bodyMd,
    textAlign: "center",
    lineHeight: fontSize.base * 1.6,
    marginBottom: sp.xl,
    paddingHorizontal: sp.md,
  },
});
