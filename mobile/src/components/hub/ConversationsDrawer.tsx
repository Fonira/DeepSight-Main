// mobile/src/components/hub/ConversationsDrawer.tsx
//
// Drawer slide-in gauche (320px). Search + liste groupee Aujourd'hui/Hier/Semaine/Plus ancien.
// Reanimated 4 pour le slide; Pressable backdrop + close button + nouvelle conv.

import React, { useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  SlideInLeft,
  SlideOutLeft,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { fontFamily } from "@/theme/typography";
import type { HubConversation } from "./types";

interface Props {
  open: boolean;
  onClose: () => void;
  conversations: HubConversation[];
  activeConvId: number | null;
  onSelect: (id: number) => void;
  onNewConv: () => void;
}

interface Grouped {
  today: HubConversation[];
  yesterday: HubConversation[];
  week: HubConversation[];
  older: HubConversation[];
}

const groupBy = (convs: HubConversation[]): Grouped => {
  const out: Grouped = { today: [], yesterday: [], week: [], older: [] };
  const now = Date.now();
  for (const c of convs) {
    const t = new Date(c.updated_at).getTime();
    const d = (now - t) / 86_400_000;
    if (d < 1) out.today.push(c);
    else if (d < 2) out.yesterday.push(c);
    else if (d < 7) out.week.push(c);
    else out.older.push(c);
  }
  return out;
};

const SOURCE_ICON: Record<"youtube" | "tiktok", ReturnType<typeof require>> = {
  youtube: require("@/assets/platforms/youtube-icon-red.png"),
  tiktok: require("@/assets/platforms/tiktok-note-color.png"),
};

interface GroupProps {
  label: string;
  items: HubConversation[];
  activeConvId: number | null;
  onSelect: (id: number) => void;
}

const Group: React.FC<GroupProps> = ({
  label,
  items,
  activeConvId,
  onSelect,
}) => {
  if (items.length === 0) return null;
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      {items.map((c) => {
        const isActive = c.id === activeConvId;
        const icon =
          c.video_source && SOURCE_ICON[c.video_source]
            ? SOURCE_ICON[c.video_source]
            : null;
        return (
          <Pressable
            key={c.id}
            onPress={() => onSelect(c.id)}
            style={[
              styles.item,
              isActive ? styles.itemActive : styles.itemRest,
            ]}
            accessibilityLabel={c.title}
          >
            {icon ? (
              <Image source={icon} style={styles.itemIcon} />
            ) : (
              <View style={styles.itemThumbPlaceholder} />
            )}
            <View style={styles.itemTextCol}>
              <Text
                style={[
                  styles.itemTitle,
                  isActive ? styles.itemTitleActive : null,
                ]}
                numberOfLines={1}
              >
                {c.title}
              </Text>
              <Text style={styles.itemSnippet} numberOfLines={1}>
                {c.last_snippet ?? ""}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};

export const ConversationsDrawer: React.FC<Props> = ({
  open,
  onClose,
  conversations,
  activeConvId,
  onSelect,
  onNewConv,
}) => {
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      conversations.filter((c) =>
        (c.title + " " + (c.last_snippet ?? ""))
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [conversations, query],
  );

  const grouped = useMemo(() => groupBy(filtered), [filtered]);

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.backdrop}
        >
          <Pressable style={styles.backdropPress} onPress={onClose} />
        </Animated.View>
        <Animated.View
          entering={SlideInLeft.duration(280).easing(
            Easing.bezier(0.4, 0, 0.2, 1),
          )}
          exiting={SlideOutLeft.duration(220)}
          style={styles.drawer}
        >
          <View style={styles.drawerHeader}>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Fermer"
              style={styles.headerBtn}
            >
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.65)" />
            </Pressable>
            <Text style={styles.headerTitle}>Conversations</Text>
            <Pressable
              onPress={() => {
                onNewConv();
                onClose();
              }}
              accessibilityLabel="Nouvelle conversation"
              style={styles.newBtn}
            >
              <Ionicons name="add" size={14} color="#6366f1" />
              <Text style={styles.newBtnText}>Nouvelle</Text>
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons
              name="search"
              size={14}
              color="rgba(255,255,255,0.30)"
              style={styles.searchIcon}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={styles.searchInput}
            />
          </View>

          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            <Group
              label="AUJOURD'HUI"
              items={grouped.today}
              activeConvId={activeConvId}
              onSelect={(id) => {
                onSelect(id);
                onClose();
              }}
            />
            <Group
              label="HIER"
              items={grouped.yesterday}
              activeConvId={activeConvId}
              onSelect={(id) => {
                onSelect(id);
                onClose();
              }}
            />
            <Group
              label="CETTE SEMAINE"
              items={grouped.week}
              activeConvId={activeConvId}
              onSelect={(id) => {
                onSelect(id);
                onClose();
              }}
            />
            <Group
              label="PLUS ANCIEN"
              items={grouped.older}
              activeConvId={activeConvId}
              onSelect={(id) => {
                onSelect(id);
                onClose();
              }}
            />
            {filtered.length === 0 ? (
              <Text style={styles.emptyText}>Aucune conversation</Text>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  backdropPress: {
    flex: 1,
  },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 320,
    maxWidth: "85%",
    backgroundColor: "#0c0c14",
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.08)",
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 50, // safe area approximation - parent peut wraper avec SafeAreaView
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 14,
    color: "#ffffff",
    fontFamily: fontFamily.bodyMedium,
  },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(99,102,241,0.15)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.30)",
  },
  newBtnText: {
    fontSize: 12,
    color: "#6366f1",
    fontFamily: fontFamily.bodyMedium,
  },
  searchWrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: "relative",
  },
  searchIcon: {
    position: "absolute",
    left: 22,
    top: 18,
  },
  searchInput: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingLeft: 32,
    fontSize: 13,
    color: "#e8e8f0",
    fontFamily: fontFamily.body,
  },
  list: {
    paddingHorizontal: 8,
    paddingBottom: 24,
  },
  group: {
    marginBottom: 12,
  },
  groupLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.35)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 2,
    borderWidth: 1,
  },
  itemActive: {
    backgroundColor: "rgba(99,102,241,0.10)",
    borderColor: "rgba(99,102,241,0.20)",
  },
  itemRest: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  itemIcon: {
    width: 16,
    height: 16,
    marginTop: 2,
    opacity: 0.9,
    flexShrink: 0,
  },
  itemThumbPlaceholder: {
    width: 16,
    height: 16,
    marginTop: 2,
    flexShrink: 0,
  },
  itemTextCol: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: 13,
    color: "#e8e8f0",
    fontFamily: fontFamily.body,
  },
  itemTitleActive: {
    fontFamily: fontFamily.bodyMedium,
  },
  itemSnippet: {
    fontSize: 11,
    color: "rgba(255,255,255,0.40)",
    marginTop: 2,
    fontFamily: fontFamily.body,
  },
  emptyText: {
    paddingVertical: 24,
    paddingHorizontal: 12,
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
    fontFamily: fontFamily.body,
  },
});
