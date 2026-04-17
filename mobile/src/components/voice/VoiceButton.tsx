/**
 * VoiceButton — FAB pour le chat vocal DeepSight
 *
 * Design : cercle 56px fond gold (ambre), logo DeepSight centré en médaillon
 * noir + badge micro blanc en haut-droite. Pulse ring gold quand la feature
 * est disponible.
 *
 * ⚠️ Backend pas encore prêt : le SDK @elevenlabs/react-native utilise
 * LiveKit et réclame un JWT que notre backend n'expose pas encore (il renvoie
 * seulement un signed_url WebSocket). On AFFICHE donc le bouton (retour
 * utilisateur — "le bouton jaune avec micro") mais on intercepte le clic
 * pour afficher un Alert « Bientôt disponible ». Quand le backend exposera
 * /api/voice/livekit-token, il suffira de flipper VOICE_CHAT_BACKEND_READY.
 */

import React, { useCallback } from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withSequence,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../contexts/ThemeContext";
import { useVoiceChatGate } from "../../contexts/PlanContext";
import { palette } from "../../theme/colors";
import { shadows } from "../../theme/shadows";

interface VoiceButtonProps {
  summaryId: string;
  videoTitle: string;
  onSessionStart?: () => void;
  disabled?: boolean;
}

const BUTTON_SIZE = 56;
const RING_SIZE = 72;
const LOGO_MEDALLION_SIZE = 40;
const LOGO_IMAGE_SIZE = 34;
const MIC_BADGE_SIZE = 22;
const MIC_ICON_SIZE = 12;

const TAB_BAR_HEIGHT = 56;
const ACTION_BAR_HEIGHT = 72;
const FAB_GAP = 16;

// Flags de contrôle
// - UI_ENABLED : affiche le bouton (l'utilisateur veut le voir)
// - BACKEND_READY : permet de démarrer réellement une session ElevenLabs
//   Backend expose maintenant un conversation_token LiveKit JWT dans la réponse
//   de POST /api/voice/session, compatible avec @elevenlabs/react-native.
const VOICE_CHAT_UI_ENABLED = true;
const VOICE_CHAT_BACKEND_READY = true;

const LOGO_SOURCE = require("../../../assets/images/deepsight-logo.png");

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  summaryId: _summaryId,
  videoTitle,
  onSessionStart,
  disabled = false,
}) => {
  useTheme();
  const { enabled, requiresUpgrade } = useVoiceChatGate();
  const insets = useSafeAreaInsets();
  const bottomOffset =
    TAB_BAR_HEIGHT + ACTION_BAR_HEIGHT + FAB_GAP + insets.bottom;

  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.5);

  React.useEffect(() => {
    if (!VOICE_CHAT_UI_ENABLED) return;
    ringScale.value = withRepeat(
      withSequence(
        withSpring(1.3, { damping: 8, stiffness: 80, mass: 0.8 }),
        withSpring(1, { damping: 12, stiffness: 100, mass: 0.8 }),
      ),
      -1,
      false,
    );
    ringOpacity.value = withRepeat(
      withSequence(
        withSpring(0.15, { damping: 10, stiffness: 60 }),
        withSpring(0.5, { damping: 10, stiffness: 60 }),
      ),
      -1,
      false,
    );
  }, [ringScale, ringOpacity]);

  const ringAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const handlePress = useCallback(() => {
    if (disabled) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (requiresUpgrade) {
      Alert.alert(
        "Fonctionnalité Premium",
        "Le chat vocal est disponible avec un abonnement supérieur. Mettez à niveau pour débloquer cette fonctionnalité.",
        [
          { text: "Plus tard", style: "cancel" },
          { text: "Voir les plans", style: "default" },
        ],
      );
      return;
    }

    if (!VOICE_CHAT_BACKEND_READY) {
      Alert.alert(
        "Chat vocal — bientôt disponible",
        "Parler à vos vidéos arrive très vite sur mobile. En attendant, cette fonctionnalité est disponible sur la version web de DeepSight.",
        [{ text: "OK", style: "default" }],
      );
      return;
    }

    onSessionStart?.();
  }, [disabled, requiresUpgrade, onSessionStart]);

  if (!VOICE_CHAT_UI_ENABLED) {
    return null;
  }

  const buttonOpacity = disabled ? 0.5 : 1;
  const glowShadow = shadows.glow(palette.gold);

  const accessibilityLabel = requiresUpgrade
    ? "Chat vocal — plan premium requis"
    : VOICE_CHAT_BACKEND_READY
      ? `Démarrer le chat vocal pour ${videoTitle}`
      : `Chat vocal DeepSight — bientôt disponible pour ${videoTitle}`;

  const accessibilityHint = requiresUpgrade
    ? "Appuyez pour voir les plans disponibles"
    : VOICE_CHAT_BACKEND_READY
      ? "Appuyez pour démarrer une conversation vocale avec l'IA"
      : "Appuyez pour en savoir plus sur cette fonctionnalité";

  return (
    <View
      style={[styles.container, { bottom: bottomOffset }]}
      pointerEvents={disabled ? "none" : "auto"}
    >
      {enabled && !disabled && (
        <Animated.View
          style={[
            styles.ring,
            { borderColor: palette.gold },
            ringAnimatedStyle,
          ]}
        />
      )}

      <Pressable
        onPress={handlePress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: palette.gold,
            opacity: pressed ? buttonOpacity * 0.85 : buttonOpacity,
            ...glowShadow,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      >
        <View style={styles.logoMedallion}>
          <Image
            source={LOGO_SOURCE}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </View>

        <View style={styles.micBadge}>
          <Ionicons
            name={requiresUpgrade ? "lock-closed" : "mic"}
            size={MIC_ICON_SIZE}
            color={palette.gold}
          />
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 16,
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    elevation: 999,
  },
  ring: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  logoMedallion: {
    width: LOGO_MEDALLION_SIZE,
    height: LOGO_MEDALLION_SIZE,
    borderRadius: LOGO_MEDALLION_SIZE / 2,
    backgroundColor: palette.black,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImage: {
    width: LOGO_IMAGE_SIZE,
    height: LOGO_IMAGE_SIZE,
  },
  micBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: MIC_BADGE_SIZE,
    height: MIC_BADGE_SIZE,
    borderRadius: MIC_BADGE_SIZE / 2,
    backgroundColor: palette.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: palette.gold,
  },
});
