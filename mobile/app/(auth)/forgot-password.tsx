import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useTheme } from "@/contexts/ThemeContext";
import { authApi } from "@/services/api";
import { sp } from "@/theme/spacing";
import { fontSize, textStyles } from "@/theme/typography";
import { palette } from "@/theme/colors";
import { DoodleBackground } from "@/components/ui/DoodleBackground";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!email.trim()) {
      setEmailError("L'email est requis");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Email invalide");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    setEmailError("");

    try {
      await authApi.forgotPassword(email.trim());
    } catch {
      // Anti-énumération : on affiche le message succès même en cas d'erreur
      // (sauf erreur réseau on pourrait alerter, mais on garde silencieux ici).
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }, [email]);

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
            Mot de passe oublié
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Entrez votre email pour recevoir un lien de réinitialisation. Le
            lien expire dans 1 heure.
          </Text>

          {!submitted ? (
            <View style={styles.stepContent}>
              <Input
                label="Email"
                placeholder="votre@email.com"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setEmailError("");
                }}
                error={emailError}
                leftIcon="mail-outline"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              <Button
                title="Envoyer le lien"
                variant="primary"
                size="lg"
                fullWidth
                loading={loading}
                disabled={loading}
                onPress={handleSubmit}
              />
            </View>
          ) : (
            <View style={styles.successContainer}>
              <View
                style={[
                  styles.successIconWrap,
                  { backgroundColor: palette.indigo + "20" },
                ]}
              >
                <Ionicons
                  name="mail-open-outline"
                  size={40}
                  color={palette.indigo}
                />
              </View>
              <Text
                style={[styles.successTitle, { color: colors.textPrimary }]}
              >
                Vérifiez votre boîte mail
              </Text>
              <Text
                style={[styles.successText, { color: colors.textSecondary }]}
              >
                Si un compte existe pour cet email, un lien de réinitialisation
                vient d'y être envoyé. Cliquez sur le lien pour choisir un
                nouveau mot de passe.
              </Text>
              <Button
                title="Retour à la connexion"
                variant="primary"
                size="lg"
                fullWidth
                onPress={() => router.replace("/(auth)/login")}
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
  successContainer: {
    alignItems: "center",
    paddingTop: sp.xl,
    gap: sp.lg,
  },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: sp.md,
  },
  successTitle: {
    ...textStyles.headingMd,
    textAlign: "center",
  },
  successText: {
    ...textStyles.bodyMd,
    textAlign: "center",
    lineHeight: fontSize.base * 1.6,
    marginBottom: sp.xl,
    paddingHorizontal: sp.md,
  },
});
