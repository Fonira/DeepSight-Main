import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '../../theme/colors';
import { sp, borderRadius } from '../../theme/spacing';
import { fontFamily, fontSize } from '../../theme/typography';
import { palette } from '../../theme/colors';

interface ChatInputProps {
  inputText: string;
  setInputText: (text: string) => void;
  onSend: () => void;
  isLoading: boolean;
  colors: ThemeColors;
  quotaText: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputText,
  setInputText,
  onSend,
  isLoading,
  colors,
  quotaText,
}) => {
  const canSend = inputText.trim().length > 0 && !isLoading;

  return (
    <View style={styles.inputWrapper}>
      <View style={[styles.inputRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Pose une question..."
          placeholderTextColor={colors.textMuted}
          style={[styles.textInput, { color: colors.textPrimary }]}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={onSend}
          blurOnSubmit={false}
          accessibilityLabel="Champ de message"
        />
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          style={[
            styles.sendButton,
            { backgroundColor: canSend ? palette.indigo : colors.bgElevated },
          ]}
          accessibilityLabel="Envoyer"
          accessibilityRole="button"
        >
          <Ionicons
            name="send"
            size={18}
            color={canSend ? '#ffffff' : colors.textMuted}
          />
        </Pressable>
      </View>
      <Text style={[styles.quotaText, { color: colors.textMuted }]}>{quotaText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  inputWrapper: {
    paddingHorizontal: sp.lg,
    paddingBottom: sp.sm,
    paddingTop: sp.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    paddingLeft: sp.lg,
    paddingRight: sp.xs,
    paddingVertical: sp.xs,
  },
  textInput: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    maxHeight: 100,
    paddingVertical: sp.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quotaText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize['2xs'],
    textAlign: 'center',
    marginTop: sp.xs,
  },
});

export default ChatInput;
