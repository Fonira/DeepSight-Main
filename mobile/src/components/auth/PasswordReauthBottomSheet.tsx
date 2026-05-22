/**
 * 🔐 PasswordReauthBottomSheet — Auth V2 Wave 1 Mobile Step 2
 *
 * BottomSheet réutilisable pour la re-authentification scopée avant action
 * sensible (billing, delete, change-email, change-password). Demande le mot
 * de passe utilisateur, appelle POST /api/auth/reauth, et resolve avec un
 * `reauth_token` à passer en header `X-Reauth-Token` sur l'endpoint cible.
 *
 * Mirror du pattern web (PR #547 — PasswordReauthModal). Utilise
 * `@gorhom/bottom-sheet` v5 (déjà installé) et BottomSheetTextInput pour
 * l'input password qui gère correctement le focus + clavier dans la sheet.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { authApi, ApiError } from "../../services/api";
import type { ReauthAudience } from "../../types/auth";

interface PasswordReauthBottomSheetProps {
  visible: boolean;
  audience: ReauthAudience;
  onSuccess: (reauthToken: string) => void;
  onCancel: () => void;
}

const AUDIENCE_LABELS: Record<ReauthAudience, string> = {
  billing: "Pour modifier votre abonnement, confirmez votre mot de passe.",
  delete: "Pour supprimer votre compte, confirmez votre mot de passe.",
  "change-email": "Pour changer votre email, confirmez votre mot de passe.",
  "change-password":
    "Pour changer votre mot de passe, confirmez l'actuel.",
};

// Tokens — dark mode forcés par spec Step 2.
const BG_PRIMARY = "#12121a";
const BG_TERTIARY = "#1a1a25";
const TEXT_PRIMARY = "#ffffff";
const TEXT_SECONDARY = "#f1f5f9";
const TEXT_MUTED = "#e2e8f0";
const ACCENT = "#6366f1";
const ERROR = "#ef4444";
const BORDER = "rgba(255,255,255,0.08)";

export const PasswordReauthBottomSheet: React.FC<
  PasswordReauthBottomSheetProps
> = ({ visible, audience, onSuccess, onCancel }) => {
  const sheetRef = useRef<BottomSheet>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const snapPoints = useMemo(() => ["40%"], []);

  // Driver visible → snapToIndex(0) / close().
  useEffect(() => {
    if (visible) {
      setPassword("");
      setError(null);
      setLoading(false);
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  const handleSheetChange = useCallback(
    (index: number) => {
      // index === -1 = fermé via swipe-down ou backdrop.
      if (index === -1 && visible && !loading) {
        onCancel();
      }
    },
    [visible, loading, onCancel],
  );

  const handleSubmit = useCallback(async () => {
    if (!password || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.requestReauth(password, audience);
      onSuccess(res.reauth_token);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Mot de passe incorrect");
      } else if (err instanceof ApiError && err.status === 429) {
        setError("Trop de tentatives. Réessayez plus tard.");
      } else {
        setError("Erreur lors de la vérification. Réessayez.");
      }
      setLoading(false);
    }
  }, [password, audience, loading, onSuccess]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.6}
        pressBehavior={loading ? "none" : "close"}
      />
    ),
    [loading],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose={!loading}
      onChange={handleSheetChange}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.sheetHandle}
      backdropComponent={renderBackdrop}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <BottomSheetView style={styles.container} testID="reauth-bottom-sheet">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed" size={18} color={ACCENT} />
          </View>
          <Text style={styles.title}>Confirmation requise</Text>
        </View>

        {/* Description */}
        <Text style={styles.description}>{AUDIENCE_LABELS[audience]}</Text>

        {/* Input */}
        <View style={styles.field}>
          <Text style={styles.label}>Mot de passe</Text>
          <BottomSheetTextInput
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (error) setError(null);
            }}
            placeholder="Votre mot de passe"
            placeholderTextColor={TEXT_MUTED}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            editable={!loading}
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
            style={[
              styles.input,
              error ? styles.inputError : null,
            ]}
            accessibilityLabel="Mot de passe"
            testID="reauth-password-input"
          />
          {error ? (
            <Text
              style={styles.errorText}
              accessibilityLiveRegion="polite"
              testID="reauth-error"
            >
              {error}
            </Text>
          ) : null}
        </View>

        {/* Footer buttons */}
        <View style={styles.footer}>
          <Pressable
            onPress={onCancel}
            disabled={loading}
            style={({ pressed }) => [
              styles.btnGhost,
              pressed && !loading ? styles.btnPressed : null,
              loading ? styles.btnDisabled : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Annuler"
            testID="reauth-cancel-btn"
          >
            <Text style={styles.btnGhostText}>Annuler</Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit}
            disabled={loading || !password}
            style={({ pressed }) => [
              styles.btnPrimary,
              pressed && !loading && !!password ? styles.btnPressed : null,
              loading || !password ? styles.btnDisabled : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Confirmer"
            testID="reauth-submit-btn"
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.btnPrimaryText}>Confirmer</Text>
            )}
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
};

PasswordReauthBottomSheet.displayName = "PasswordReauthBottomSheet";

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: BG_PRIMARY,
  },
  sheetHandle: {
    backgroundColor: TEXT_MUTED,
    width: 36,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${ACCENT}1A`,
    borderWidth: 1,
    borderColor: `${ACCENT}33`,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: TEXT_PRIMARY,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_SECONDARY,
    marginBottom: 16,
  },
  field: {
    gap: 6,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: TEXT_SECONDARY,
  },
  input: {
    backgroundColor: BG_TERTIARY,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: TEXT_PRIMARY,
  },
  inputError: {
    borderColor: ERROR,
  },
  errorText: {
    fontSize: 12,
    color: ERROR,
    marginTop: 4,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: "auto",
  },
  btnGhost: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
  },
  btnGhostText: {
    fontSize: 14,
    fontWeight: "500",
    color: TEXT_SECONDARY,
  },
  btnPrimary: {
    backgroundColor: ACCENT,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 10,
    minWidth: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnDisabled: {
    opacity: 0.4,
  },
});

export default PasswordReauthBottomSheet;
