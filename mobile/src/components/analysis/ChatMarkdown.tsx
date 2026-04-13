/**
 * ChatMarkdown — Lightweight markdown renderer for chat AI messages
 *
 * Compact styling optimized for chat bubbles:
 * - Bold, italic, strikethrough
 * - Inline code + code blocks
 * - Lists (bullet + ordered)
 * - Headers (rendered as bold text, no large sizing)
 * - Links
 *
 * Does NOT render: tables, images, blockquotes (too heavy for chat)
 */

import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import Markdown from "react-native-markdown-display";
import { fontFamily, fontSize, lineHeight } from "../../theme/typography";
import { sp, borderRadius as br } from "../../theme/spacing";
import { palette } from "../../theme/colors";

interface ChatMarkdownProps {
  content: string;
  textColor: string;
  isDark: boolean;
}

export const ChatMarkdown: React.FC<ChatMarkdownProps> = ({
  content,
  textColor,
  isDark,
}) => {
  const markdownStyles = useMemo(
    () =>
      StyleSheet.create({
        body: {
          color: textColor,
          fontSize: fontSize.sm,
          lineHeight: fontSize.sm * lineHeight.normal,
          fontFamily: fontFamily.body,
        },
        paragraph: {
          color: textColor,
          fontSize: fontSize.sm,
          lineHeight: fontSize.sm * lineHeight.normal,
          fontFamily: fontFamily.body,
          marginBottom: sp.xs,
          marginTop: 0,
        },
        // Headers rendered as bold text (compact for chat)
        heading1: {
          color: textColor,
          fontSize: fontSize.base,
          fontFamily: fontFamily.bodySemiBold,
          marginTop: sp.sm,
          marginBottom: sp.xs,
        },
        heading2: {
          color: textColor,
          fontSize: fontSize.sm,
          fontFamily: fontFamily.bodySemiBold,
          marginTop: sp.sm,
          marginBottom: sp.xs,
        },
        heading3: {
          color: textColor,
          fontSize: fontSize.sm,
          fontFamily: fontFamily.bodySemiBold,
          marginTop: sp.xs,
          marginBottom: sp.xs,
        },
        // Emphasis
        strong: {
          fontFamily: fontFamily.bodySemiBold,
          color: textColor,
        },
        em: {
          fontStyle: "italic",
          color: textColor,
        },
        s: {
          textDecorationLine: "line-through",
          color: textColor,
        },
        // Lists
        bullet_list: { marginBottom: sp.xs, marginLeft: 0 },
        ordered_list: { marginBottom: sp.xs, marginLeft: 0 },
        bullet_list_icon: {
          color: palette.violet,
          fontSize: 6,
          marginRight: sp.sm,
          marginTop: 7,
        },
        ordered_list_icon: {
          color: palette.violet,
          fontSize: fontSize.xs,
          fontFamily: fontFamily.bodySemiBold,
          marginRight: sp.sm,
        },
        list_item: {
          flexDirection: "row",
          marginBottom: 3,
          color: textColor,
        },
        bullet_list_content: { flex: 1, color: textColor },
        ordered_list_content: { flex: 1, color: textColor },
        // Code
        code_inline: {
          backgroundColor: isDark
            ? "rgba(139, 92, 246, 0.12)"
            : "rgba(139, 92, 246, 0.08)",
          color: "#A78BFA",
          fontFamily: fontFamily.mono,
          fontSize: fontSize.xs,
          paddingHorizontal: 5,
          paddingVertical: 1,
          borderRadius: 4,
        },
        code_block: {
          backgroundColor: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.05)",
          padding: sp.sm,
          borderRadius: br.sm,
          marginVertical: sp.xs,
          fontFamily: fontFamily.mono,
          fontSize: fontSize.xs,
        },
        fence: {
          backgroundColor: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.05)",
          padding: sp.sm,
          borderRadius: br.sm,
          marginVertical: sp.xs,
          fontFamily: fontFamily.mono,
          fontSize: fontSize.xs,
        },
        // Blockquote (minimal for chat)
        blockquote: {
          borderLeftColor: palette.violet,
          borderLeftWidth: 2,
          paddingLeft: sp.sm,
          marginVertical: sp.xs,
          opacity: 0.8,
        },
        // Links
        link: { color: "#60A5FA", textDecorationLine: "underline" },
        // Text
        text: { color: textColor },
        textgroup: { color: textColor },
        softbreak: { color: textColor },
        hardbreak: { color: textColor },
        // HR
        hr: {
          backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
          height: 1,
          marginVertical: sp.sm,
        },
      }),
    [textColor, isDark],
  );

  return <Markdown style={markdownStyles}>{content}</Markdown>;
};

export default ChatMarkdown;
