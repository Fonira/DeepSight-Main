import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { chatApi } from '../../services/api';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';
import { hasFeature, getLimit, isUnlimited } from '../../config/planPrivileges';
import { SuggestedQuestions } from './SuggestedQuestions';
import type { ChatMessage } from '../../types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [lastSources, setLastSources] = useState<Array<{ url: string; title: string }>>([]);

  // Pulse animation for unread badge
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

    // Cleanup: stop animation on unmount or when unreadCount changes
    return () => {
      if (animation) {
        animation.stop();
      }
      pulseAnim.setValue(1);
    };
  }, [unreadCount, pulseAnim]);

  // Open/close animation
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isOpen ? 1 : 0,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [isOpen]);

  const handleOpen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsOpen(true);
    setUnreadCount(0);
  };

  const handleClose = () => {
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

      // Store sources if web search was used
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
      // Remove failed message
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
      setInput(userMessage.content);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user can use web search based on plan privileges
  const userPlan = user?.plan || 'free';
  const canUseWebSearch = hasFeature(userPlan, 'chatWebSearch');

  const handleToggleWebSearch = () => {
    if (!canUseWebSearch) {
      // Show upgrade prompt
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.selectionAsync();
    setUseWebSearch(!useWebSearch);
  };

  // Get user's chat quota based on plan privileges
  const chatQuotaPerVideo = getLimit(userPlan, 'chatQuestionsPerVideo');
  const isUnlimitedChat = isUnlimited(userPlan, 'chatQuestionsPerVideo');
  const questionsUsed = messages.filter(m => m.role === 'user').length;
  const questionsRemaining = isUnlimitedChat ? -1 : chatQuotaPerVideo - questionsUsed;

  // Handle suggested question selection
  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
  };

  return (
    <>
      {/* Floating Button */}
      <TouchableOpacity
        style={[
          styles.floatingButton,
          {
            backgroundColor: colors.accentPrimary,
            bottom: insets.bottom + 100,
          },
        ]}
        onPress={handleOpen}
      >
        <Ionicons name="chatbubble-ellipses" size={28} color="#FFFFFF" />

        {unreadCount > 0 && (
          <Animated.View
            style={[
              styles.unreadBadge,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <Text style={styles.unreadText}>{unreadCount}</Text>
          </Animated.View>
        )}
      </TouchableOpacity>

      {/* Chat Modal */}
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
            <View style={[styles.header, { backgroundColor: colors.accentPrimary }]}>
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
            </View>

            {!isMinimized && (
              <KeyboardAvoidingView
                style={styles.chatContent}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              >
                {/* Messages */}
                <FlatList
                  ref={scrollRef}
                  data={messages}
                  keyExtractor={(item) => item.id}
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

                      {/* Suggested questions - using new component */}
                      <SuggestedQuestions
                        onQuestionSelect={handleSuggestedQuestion}
                        category={category}
                        variant="chat"
                        disabled={questionsRemaining === 0}
                      />
                    </View>
                  }
                  renderItem={({ item }) => (
                    <View
                      style={[
                        styles.messageBubble,
                        item.role === 'user' ? styles.userBubble : styles.assistantBubble,
                        {
                          backgroundColor:
                            item.role === 'user' ? colors.accentPrimary : colors.bgSecondary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageText,
                          { color: item.role === 'user' ? '#FFFFFF' : colors.textPrimary },
                        ]}
                      >
                        {item.content}
                      </Text>
                    </View>
                  )}
                />

                {/* Input */}
                {/* Question quota indicator at bottom */}
                {questionsRemaining !== -1 && questionsRemaining <= 2 && questionsRemaining > 0 && (
                  <View style={[styles.quotaWarning, { backgroundColor: `${colors.accentWarning}20` }]}>
                    <Ionicons name="warning-outline" size={14} color={colors.accentWarning} />
                    <Text style={[styles.quotaWarningText, { color: colors.accentWarning }]}>
                      {questionsRemaining} {t.chat.questionsRemaining}
                    </Text>
                  </View>
                )}

                {/* Sources from last web search */}
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
                        • {source.title || source.url}
                      </Text>
                    ))}
                  </View>
                )}

                <View style={[styles.inputContainer, { borderTopColor: colors.border }]}>
                  {/* Web Search Toggle */}
                  <TouchableOpacity
                    style={[
                      styles.webSearchToggle,
                      {
                        backgroundColor: useWebSearch ? colors.accentPrimary + '20' : colors.bgSecondary,
                        borderColor: useWebSearch ? colors.accentPrimary : colors.border,
                      },
                    ]}
                    onPress={handleToggleWebSearch}
                    disabled={!canUseWebSearch}
                  >
                    <Ionicons
                      name="globe-outline"
                      size={16}
                      color={useWebSearch ? colors.accentPrimary : canUseWebSearch ? colors.textSecondary : colors.textMuted}
                    />
                    {!canUseWebSearch && (
                      <Ionicons name="lock-closed" size={10} color={colors.textMuted} style={styles.lockIcon} />
                    )}
                  </TouchableOpacity>

                  <TextInput
                    style={[
                      styles.input,
                      { backgroundColor: colors.bgSecondary, color: colors.textPrimary },
                    ]}
                    placeholder={useWebSearch ? t.chat.webSearchPlaceholder : t.chat.placeholder}
                    placeholderTextColor={colors.textMuted}
                    value={input}
                    onChangeText={setInput}
                    multiline
                    maxLength={500}
                    editable={questionsRemaining === -1 || questionsRemaining > 0}
                  />
                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      { backgroundColor: input.trim() ? colors.accentPrimary : colors.bgTertiary },
                    ]}
                    onPress={handleSend}
                    disabled={!input.trim() || isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="send" size={18} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            )}
          </Animated.View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    right: Spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF453A',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
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
  suggestedContainer: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  suggestedButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  suggestedText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.sm * 1.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    maxHeight: 80,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webSearchToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  lockIcon: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  sourcesContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
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
