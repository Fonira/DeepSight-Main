// mobile/src/components/tutor/TutorMiniChat.tsx
//
// UI mini-chat texte du Tuteur V2 mobile lite.
// Header (concept_term en titre) + ScrollView messages (bubbles) + input bar.

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize, lineHeight } from "@/theme/typography";
import type { TutorTurn } from "../../types/tutor";

interface TutorMiniChatProps {
  conceptTerm: string;
  messages: TutorTurn[];
  loading: boolean;
  error: string | null;
  onSubmit: (text: string) => void;
}

export const TutorMiniChat: React.FC<TutorMiniChatProps> = ({
  conceptTerm,
  messages,
  loading,
  error,
  onSubmit,
}) => {
  const { colors } = useTheme();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll vers le bas à chaque nouveau message ou changement loading
  useEffect(() => {
    const id = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(id);
  }, [messages.length, loading]);

  const trimmed = draft.trim();
  const canSubmit = trimmed.length > 0 && !loading;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(trimmed);
    setDraft("");
  };

  return (
    <View style={styles.root} testID="tutor-mini-chat">
      {/* Header */}
      <View
        style={[styles.header, { borderBottomColor: colors.borderLight }]}
        testID="tutor-mini-chat-header"
      >
        <Text
          style={[styles.headerTitle, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {conceptTerm}
        </Text>
        <Text
          style={[styles.headerSubtitle, { color: colors.textTertiary }]}
          numberOfLines={1}
        >
          Tuteur
        </Text>
      </View>

      {/* Error banner */}
      {error ? (
        <View
          style={[
            styles.errorBanner,
            {
              backgroundColor: colors.glassBg,
              borderColor: colors.accentError,
            },
          ]}
          testID="tutor-mini-chat-error"
        >
          <Ionicons
            name="alert-circle-outline"
            size={16}
            color={colors.accentError}
          />
          <Text
            style={[styles.errorText, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {error}
          </Text>
        </View>
      ) : null}

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        testID="tutor-mini-chat-scroll"
      >
        {messages.map((msg, idx) => (
          <View
            key={`${msg.timestamp_ms}-${idx}`}
            style={[
              styles.bubbleRow,
              msg.role === "user" ? styles.bubbleRowUser : styles.bubbleRowAi,
            ]}
            testID={`tutor-bubble-${msg.role}-${idx}`}
          >
            <View
              style={[
                styles.bubble,
                msg.role === "user"
                  ? {
                      backgroundColor: colors.accentPrimary,
                      borderTopRightRadius: borderRadius.sm,
                    }
                  : {
                      backgroundColor: colors.bgSecondary,
                      borderTopLeftRadius: borderRadius.sm,
                      borderWidth: 1,
                      borderColor: colors.borderLight,
                    },
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  {
                    color: msg.role === "user" ? "#ffffff" : colors.textPrimary,
                  },
                ]}
              >
                {msg.content}
              </Text>
            </View>
          </View>
        ))}

        {loading ? (
          <View
            style={[styles.bubbleRow, styles.bubbleRowAi]}
            testID="tutor-mini-chat-loading"
          >
            <View
              style={[
                styles.bubble,
                styles.bubbleLoading,
                {
                  backgroundColor: colors.bgSecondary,
                  borderColor: colors.borderLight,
                },
              ]}
            >
              <ActivityIndicator size="small" color={colors.accentPrimary} />
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Input bar */}
      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.bgPrimary,
            borderTopColor: colors.borderLight,
          },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              color: colors.textPrimary,
              backgroundColor: colors.bgSecondary,
              borderColor: colors.borderLight,
            },
          ]}
          value={draft}
          onChangeText={setDraft}
          placeholder="Pose ta question..."
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={500}
          editable={!loading}
          onSubmitEditing={handleSubmit}
          accessibilityLabel="Question pour le Tuteur"
          testID="tutor-mini-chat-input"
        />
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityLabel="Envoyer"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          testID="tutor-mini-chat-send"
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: canSubmit
                ? colors.accentPrimary
                : colors.bgTertiary,
              opacity: !canSubmit ? 0.6 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons
            name="send"
            size={18}
            color={canSubmit ? "#ffffff" : colors.textTertiary}
          />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: sp.lg,
    paddingBottom: sp.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg * lineHeight.snug,
  },
  headerSubtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    marginHorizontal: sp.lg,
    marginTop: sp.sm,
    paddingVertical: sp.sm,
    paddingHorizontal: sp.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: sp.lg,
    gap: sp.sm,
  },
  bubbleRow: {
    flexDirection: "row",
    marginBottom: sp.xs,
  },
  bubbleRowUser: {
    justifyContent: "flex-end",
  },
  bubbleRowAi: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "85%",
    paddingVertical: sp.sm,
    paddingHorizontal: sp.md,
    borderRadius: borderRadius.lg,
  },
  bubbleLoading: {
    paddingVertical: sp.md,
    paddingHorizontal: sp.lg,
    minWidth: 60,
    alignItems: "center",
    borderWidth: 1,
  },
  bubbleText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.normal,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: sp.sm,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.md,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingVertical: sp.sm,
    paddingHorizontal: sp.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default TutorMiniChat;
