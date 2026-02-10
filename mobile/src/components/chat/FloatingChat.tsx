import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  Easing,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { chatApi } from '../../services/api';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';
import { hasFeature, getLimit, isUnlimited } from '../../config/planPrivileges';
import { SuggestedQuestions } from './SuggestedQuestions';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';
import { ChatInput } from './ChatInput';
import type { ChatMessage } from '../../types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CHAT_FAB_SEEN_KEY = 'deepsight_chat_fab_seen';

// FAB Design constants
const FAB_HEIGHT = 56;
const FAB_BORDER_RADIUS = FAB_HEIGHT / 2;
const FAB_GLOW_COLOR = '#00BCD4';
const FAB_GRADIENT: readonly [string, string] = ['#00BCD4', '#8b5cf6'];

interface FloatingChatProps {
  summaryId: string;
  videoTitle?: string;
  category?: string;
  initialMessages?: ChatMessage[];
  onMessagesUpdate?: (messages: ChatMessage[]) => void;
}

export const FloatingChat: React.FC<FloatingChatProps> = ({
  summaryId,
  videoTitle,
  category = 'general',
  initialMessages = [],
  onMessagesUpdate,
}) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<FlatList>(null);

  // Modal animation
  const scaleAnim = useRef(new Animated.Value(0)).current;

  // Pulse glow animation (sonar ring)
  const glowAnim = useRef(new Animated.Value(0)).current;

  // FAB entry animation
  const fabEntryAnim = useRef(new Animated.Value(0)).current;

  // Unread badge pulse
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [lastSources, setLastSources] = useState<Array<{ url: string; title: string }>>([]);
  const [showNewBadge, setShowNewBadge] = useState(false);

  // Force blur + dismiss on unmount to prevent orphaned keyboard on iOS
  useEffect(() => {
    return () => {
      Keyboard.dismiss();
    };
  }, []);

  // Check if first time seeing the FAB
  useEffect(() => {
    AsyncStorage.getItem(CHAT_FAB_SEEN_KEY).then(val => {
      if (!val) setShowNewBadge(true);
    });
  }, []);

  // FAB entry animation - bouncy spring on mount
  useEffect(() => {
    Animated.spring(fabEntryAnim, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [fabEntryAnim]);

  // Pulse glow animation - sonar ring every 3 seconds
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(1500),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [glowAnim]);

  // Unread badge pulse
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    if (unreadCount > 0) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      if (animation) animation.stop();
      pulseAnim.setValue(1);
    };
  }, [unreadCount, pulseAnim]);

  // Modal open/close animation
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isOpen ? 1 : 0,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [isOpen, scaleAnim]);

  const handleOpen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Dismiss "Nouveau" badge on first tap
    if (showNewBadge) {
      setShowNewBadge(false);
      AsyncStorage.setItem(CHAT_FAB_SEEN_KEY, 'true');
    }

    setIsOpen(true);
    setUnreadCount(0);
  };

  const handleClose = () => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsOpen(false);
  };

  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setLastSources([]);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const response = await chatApi.sendMessage(summaryId, userMessage.content, {
        useWebSearch: useWebSearch && canUseWebSearch,
      });

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
      };

      if (response.sources && response.sources.length > 0) {
        setLastSources(response.sources);
      }

      setMessages(prev => {
        const newMessages = [...prev, assistantMessage];
        onMessagesUpdate?.(newMessages);
        return newMessages;
      });

      if (!isOpen) {
        setUnreadCount(prev => prev + 1);
      }
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
      setInput(userMessage.content);
    } finally {
      setIsLoading(false);
    }
  };

  // Plan privileges
  const userPlan = user?.plan || 'free';
  const canUseWebSearch = hasFeature(userPlan, 'chatWebSearch');

  const handleToggleWebSearch = () => {
    if (!canUseWebSearch) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.selectionAsync();
    setUseWebSearch(!useWebSearch);
  };

  const chatQuotaPerVideo = getLimit(userPlan, 'chatQuestionsPerVideo');
  const isUnlimitedChat = isUnlimited(userPlan, 'chatQuestionsPerVideo');
  const questionsUsed = messages.filter(m => m.role === 'user').length;
  const questionsRemaining = isUnlimitedChat ? -1 : chatQuotaPerVideo - questionsUsed;

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
  };

  // Animated glow ring values
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.6, 0.3, 0],
  });
  const glowScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.5],
  });

  // FAB entry interpolations
  const fabScale = fabEntryAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const fabTranslateY = fabEntryAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [60, 0],
  });

  return (
    <>
      {/* === FAB (Hidden when chat modal is open) === */}
      {!isOpen && (
        <Animated.View
          style={[
            styles.fabWrapper,
            {
              bottom: insets.bottom + 24,
              transform: [
                { scale: fabScale },
                { translateY: fabTranslateY },
              ],
            },
          ]}
          pointerEvents="box-none"
        >
          {/* Sonar glow ring */}
          <Animated.View
            style={[
              styles.glowRing,
              {
                opacity: glowOpacity,
                transform: [{ scale: glowScale }],
              },
            ]}
            pointerEvents="none"
          />

          {/* Main FAB button */}
          <Pressable
            onPress={handleOpen}
            style={({ pressed }) => [
              styles.fabPressable,
              { transform: [{ scale: pressed ? 0.93 : 1 }] },
            ]}
          >
            <LinearGradient
              colors={[FAB_GRADIENT[0], FAB_GRADIENT[1]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fab}
            >
              <Ionicons name="chatbubble-ellipses" size={22} color="#FFFFFF" />
              <Text style={styles.fabText}>Chat IA</Text>
            </LinearGradient>
          </Pressable>

          {/* "Nouveau" badge */}
          {showNewBadge && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>Nouveau</Text>
            </View>
          )}

          {/* Unread count badge */}
          {unreadCount > 0 && !showNewBadge && (
            <Animated.View
              style={[
                styles.unreadBadge,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Text style={styles.unreadText}>{unreadCount}</Text>
            </Animated.View>
          )}
        </Animated.View>
      )}

      {/* === Chat Modal === */}
      <Modal
        visible={isOpen}
        animationType="none"
        transparent
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.chatContainer,
              {
                backgroundColor: colors.bgPrimary,
                paddingBottom: insets.bottom,
                transform: [{ scale: scaleAnim }],
                opacity: scaleAnim,
                maxHeight: isMinimized ? 60 : SCREEN_HEIGHT * 0.7,
              },
            ]}
          >
            {/* Header */}
            <LinearGradient
              colors={[FAB_GRADIENT[0], FAB_GRADIENT[1]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.header}
            >
              <TouchableOpacity onPress={handleMinimize} style={styles.headerButton}>
                <Ionicons
                  name={isMinimized ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#FFFFFF"
                />
              </TouchableOpacity>

              <View style={styles.headerTitle}>
                <Ionicons name="chatbubble-ellipses" size={18} color="#FFFFFF" />
                <Text style={styles.headerText} numberOfLines={1}>
                  {videoTitle || t.chat.title}
                </Text>
              </View>

              <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </LinearGradient>

            {!isMinimized && (
              <KeyboardAvoidingView
                style={styles.chatContent}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              >
                {/* Messages */}
                <FlatList
                  ref={scrollRef}
                  data={messages}
                  keyExtractor={(item, index) => `float-${index}-${item.id || 'msg'}`}
                  keyboardDismissMode="interactive"
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.messagesList}
                  onContentSizeChange={() => scrollRef.current?.scrollToEnd()}
                  ListEmptyComponent={
                    <View style={styles.emptyState}>
                      <Ionicons name="chatbubble-outline" size={48} color={colors.textTertiary} />
                      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                        {t.chat.askQuestion}
                      </Text>
                      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        {t.chat.startConversation}
                      </Text>

                      {/* Question quota */}
                      <View style={[styles.quotaContainer, { backgroundColor: colors.bgSecondary }]}>
                        <Ionicons name="chatbubbles-outline" size={16} color={colors.textTertiary} />
                        <Text style={[styles.quotaText, { color: colors.textSecondary }]}>
                          {questionsRemaining === -1
                            ? t.chat.unlimitedQuestions
                            : `${questionsRemaining} ${t.chat.questionsRemaining}`}
                        </Text>
                      </View>

                      {/* Suggested questions */}
                      <SuggestedQuestions
                        onQuestionSelect={handleSuggestedQuestion}
                        category={category}
                        variant="chat"
                        disabled={questionsRemaining === 0}
                      />
                    </View>
                  }
                  renderItem={({ item, index }) => (
                    <ChatBubble
                      role={item.role}
                      content={item.content}
                      timestamp={item.timestamp}
                      index={index}
                    />
                  )}
                  ListFooterComponent={isLoading ? <TypingIndicator /> : null}
                />

                {/* Quota warning */}
                {questionsRemaining !== -1 && questionsRemaining <= 2 && questionsRemaining > 0 && (
                  <View style={[styles.quotaWarning, { backgroundColor: `${colors.accentWarning}20` }]}>
                    <Ionicons name="warning-outline" size={14} color={colors.accentWarning} />
                    <Text style={[styles.quotaWarningText, { color: colors.accentWarning }]}>
                      {questionsRemaining} {t.chat.questionsRemaining}
                    </Text>
                  </View>
                )}

                {/* Web search sources */}
                {lastSources.length > 0 && (
                  <View style={[styles.sourcesContainer, { backgroundColor: colors.bgSecondary }]}>
                    <View style={styles.sourcesHeader}>
                      <Ionicons name="globe-outline" size={14} color={colors.accentInfo} />
                      <Text style={[styles.sourcesTitle, { color: colors.textSecondary }]}>
                        {t.chat.webSources}
                      </Text>
                    </View>
                    {lastSources.slice(0, 3).map((source, index) => (
                      <Text
                        key={index}
                        style={[styles.sourceLink, { color: colors.accentPrimary }]}
                        numberOfLines={1}
                      >
                        {source.title || source.url}
                      </Text>
                    ))}
                  </View>
                )}

                <ChatInput
                  value={input}
                  onChangeText={setInput}
                  onSend={handleSend}
                  isLoading={isLoading}
                  placeholder={useWebSearch ? t.chat.webSearchPlaceholder : t.chat.placeholder}
                  maxLength={500}
                  disabled={questionsRemaining !== -1 && questionsRemaining <= 0}
                  showWebSearch
                  webSearchEnabled={useWebSearch}
                  onToggleWebSearch={handleToggleWebSearch}
                  canUseWebSearch={canUseWebSearch}
                />
              </KeyboardAvoidingView>
            )}
          </Animated.View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // === FAB Styles ===
  fabWrapper: {
    position: 'absolute',
    right: 16,
    zIndex: 999,
    elevation: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 160,
    height: FAB_HEIGHT,
    borderRadius: FAB_BORDER_RADIUS,
    backgroundColor: FAB_GLOW_COLOR,
  },
  fabPressable: {
    // Shadow for iOS
    shadowColor: FAB_GLOW_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    // Elevation for Android
    elevation: 12,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: FAB_HEIGHT,
    paddingHorizontal: 24,
    borderRadius: FAB_BORDER_RADIUS,
    gap: 10,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: Typography.fontFamily.bodySemiBold,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  newBadge: {
    position: 'absolute',
    top: -8,
    right: -4,
    backgroundColor: '#FF453A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    shadowColor: '#FF453A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6,
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  unreadBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF453A',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#0a0a0f',
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },

  // === Modal Styles ===
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  chatContainer: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  headerButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  chatContent: {
    flex: 1,
  },
  messagesList: {
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  quotaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  quotaText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  quotaWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  quotaWarningText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  sourcesContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  sourcesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  sourcesTitle: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  sourceLink: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginLeft: Spacing.sm,
    marginBottom: 2,
  },
});

export default FloatingChat;
