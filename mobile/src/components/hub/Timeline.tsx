// mobile/src/components/hub/Timeline.tsx
//
// Timeline messages avec FlashList + autoscroll vers le dernier message.
// Empty state : icone Sparkles + CTA "Posez votre premiere question".

import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { fontFamily } from "@/theme/typography";
import type { HubMessage } from "./types";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: HubMessage[];
  /** When true, displays a "thinking" dots placeholder at the end. */
  isThinking?: boolean;
}

const ThinkingDots: React.FC = () => {
  return (
    <View style={styles.thinkingWrap}>
      <View style={styles.thinkingPill}>
        <View style={[styles.dot, { opacity: 0.6 }]} />
        <View style={[styles.dot, { opacity: 0.4 }]} />
        <View style={[styles.dot, { opacity: 0.2 }]} />
        <Text style={styles.thinkingText}>Reflexion…</Text>
      </View>
    </View>
  );
};

export const Timeline: React.FC<Props> = ({ messages, isThinking }) => {
  const sorted = useMemo(
    () => [...messages].sort((a, b) => a.timestamp - b.timestamp),
    [messages],
  );
  const listRef = useRef<FlashListRef<HubMessage> | null>(null);

  useEffect(() => {
    if (sorted.length === 0) return;
    // wait next frame so layout is committed
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd?.({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [sorted.length, isThinking]);

  if (sorted.length === 0 && !isThinking) {
    return (
      <View style={styles.empty}>
        <Ionicons name="sparkles" size={40} color="rgba(255,255,255,0.25)" />
        <Text style={styles.emptyTitle}>Posez votre premiere question</Text>
        <Text style={styles.emptySubtitle}>
          Tapez votre question, maintenez le micro pour une note vocale, ou
          touchez l'icone telephone pour passer en appel.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <FlashList
        ref={listRef}
        data={sorted}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.itemSpacing}>
            <MessageBubble msg={item} />
          </View>
        )}
        ListFooterComponent={isThinking ? <ThinkingDots /> : null}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  itemSpacing: {
    marginBottom: 16,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.85)",
    fontFamily: fontFamily.bodyMedium,
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.50)",
    textAlign: "center",
    lineHeight: 21,
    fontFamily: fontFamily.body,
  },
  thinkingWrap: {
    alignSelf: "flex-start",
    marginTop: 8,
  },
  thinkingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#06b6d4",
  },
  thinkingText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    marginLeft: 4,
    fontFamily: fontFamily.body,
  },
});
