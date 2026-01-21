import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  Linking,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useTheme } from '../contexts/ThemeContext';
import { videoApi, chatApi, studyApi, exportApi } from '../services/api';
import { Header, Card, Badge, Button } from '../components';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { formatDuration, formatDate } from '../utils/formatters';
import type { RootStackParamList, AnalysisSummary, ChatMessage } from '../types';

type AnalysisNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Analysis'>;
type AnalysisRouteProp = RouteProp<RootStackParamList, 'Analysis'>;

type TabType = 'summary' | 'concepts' | 'chat' | 'tools';

export const AnalysisScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<AnalysisNavigationProp>();
  const route = useRoute<AnalysisRouteProp>();
  const insets = useSafeAreaInsets();
  const chatScrollRef = useRef<FlatList>(null);

  const { summaryId, videoUrl } = route.params || {};

  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [concepts, setConcepts] = useState<Array<{ name: string; definition: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  // Analysis status polling
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Study tools state
  const [flashcards, setFlashcards] = useState<Array<{ front: string; back: string }>>([]);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [showFlashcardAnswer, setShowFlashcardAnswer] = useState(false);
  const [isLoadingTools, setIsLoadingTools] = useState(false);

  // Load analysis data
  const loadAnalysis = useCallback(async () => {
    if (!summaryId) return;

    try {
      setIsLoading(true);
      setError(null);

      // Check if this is a task ID (new analysis) or summary ID (existing)
      const status = await videoApi.getStatus(summaryId);

      if (status.status === 'completed' && status.summary_id) {
        const summaryData = await videoApi.getSummary(status.summary_id);
        setSummary(summaryData);
        setAnalysisProgress(100);

        // Load concepts
        try {
          const conceptsData = await videoApi.getEnrichedConcepts(status.summary_id);
          setConcepts(conceptsData.concepts || []);
        } catch {
          // Concepts might not be available
        }

        // Load chat history
        try {
          const chatHistory = await chatApi.getHistory(status.summary_id);
          setChatMessages(chatHistory.messages || []);
        } catch {
          // Chat history might not exist
        }
      } else if (status.status === 'processing') {
        setAnalysisProgress(status.progress || 0);
        setAnalysisStatus(status.message || 'Analyse en cours...');
        // Poll for updates
        setTimeout(() => loadAnalysis(), 2000);
      } else if (status.status === 'failed') {
        setError(status.error || 'L\'analyse a échoué');
      }
    } catch (err: any) {
      // Try loading as existing summary
      try {
        const summaryData = await videoApi.getSummary(summaryId);
        setSummary(summaryData);
        setAnalysisProgress(100);

        try {
          const conceptsData = await videoApi.getEnrichedConcepts(summaryId);
          setConcepts(conceptsData.concepts || []);
        } catch {}

        try {
          const chatHistory = await chatApi.getHistory(summaryId);
          setChatMessages(chatHistory.messages || []);
        } catch {}
      } catch {
        setError('Impossible de charger l\'analyse');
      }
    } finally {
      setIsLoading(false);
    }
  }, [summaryId]);

  useEffect(() => {
    loadAnalysis();
  }, [loadAnalysis]);

  // Send chat message
  const handleSendMessage = async () => {
    if (!chatInput.trim() || !summary?.id || isSendingMessage) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setIsSendingMessage(true);

    // Add user message to chat
    const newUserMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, newUserMessage]);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const response = await chatApi.sendMessage(summary.id, userMessage);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
      };
      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      Alert.alert('Erreur', 'Impossible d\'envoyer le message');
      // Remove the user message on error
      setChatMessages(prev => prev.filter(m => m.id !== newUserMessage.id));
      setChatInput(userMessage);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Generate flashcards
  const handleGenerateFlashcards = async () => {
    if (!summary?.id || isLoadingTools) return;

    setIsLoadingTools(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const result = await studyApi.generateFlashcards(summary.id);
      setFlashcards(result.flashcards || []);
      setCurrentFlashcardIndex(0);
      setShowFlashcardAnswer(false);
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de générer les flashcards');
    } finally {
      setIsLoadingTools(false);
    }
  };

  // Share summary
  const handleShare = async () => {
    if (!summary) return;

    try {
      await Share.share({
        message: `${summary.title}\n\n${summary.content?.substring(0, 500)}...\n\nAnalysé avec DeepSight`,
        title: summary.title,
      });
    } catch {}
  };

  // Copy to clipboard
  const handleCopy = async () => {
    if (!summary) return;

    await Clipboard.setStringAsync(summary.content || '');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copié', 'Le résumé a été copié dans le presse-papiers');
  };

  // Open YouTube video
  const handleOpenVideo = () => {
    if (summary?.videoId) {
      Linking.openURL(`https://www.youtube.com/watch?v=${summary.videoId}`);
    }
  };

  // Render loading state
  if (isLoading && analysisProgress < 100) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <Header title="Analyse" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentPrimary} />
          <Text style={[styles.loadingText, { color: colors.textPrimary }]}>
            {analysisStatus || 'Chargement...'}
          </Text>
          {analysisProgress > 0 && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { backgroundColor: colors.bgTertiary }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${analysisProgress}%`, backgroundColor: colors.accentPrimary },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: colors.textTertiary }]}>
                {Math.round(analysisProgress)}%
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // Render error state
  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <Header title="Analyse" showBack />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.accentError} />
          <Text style={[styles.errorText, { color: colors.textPrimary }]}>
            {error}
          </Text>
          <Button title="Réessayer" onPress={loadAnalysis} style={styles.retryButton} />
        </View>
      </View>
    );
  }

  // Tabs
  const tabs: { id: TabType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'summary', label: 'Résumé', icon: 'document-text-outline' },
    { id: 'concepts', label: 'Concepts', icon: 'bulb-outline' },
    { id: 'chat', label: 'Chat', icon: 'chatbubble-outline' },
    { id: 'tools', label: 'Outils', icon: 'school-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header
        title="Analyse"
        showBack
        rightAction={{ icon: 'share-outline', onPress: handleShare }}
      />

      {/* Video Header */}
      {summary && (
        <TouchableOpacity onPress={handleOpenVideo} style={styles.videoHeader}>
          <Image
            source={{ uri: summary.videoInfo?.thumbnail }}
            style={styles.thumbnail}
            contentFit="cover"
          />
          <View style={styles.videoInfo}>
            <Text style={[styles.videoTitle, { color: colors.textPrimary }]} numberOfLines={2}>
              {summary.title}
            </Text>
            <Text style={[styles.videoMeta, { color: colors.textTertiary }]}>
              {summary.videoInfo?.channel} • {formatDuration(summary.videoInfo?.duration || 0)}
            </Text>
          </View>
          <Ionicons name="play-circle" size={32} color={colors.accentPrimary} />
        </TouchableOpacity>
      )}

      {/* Tabs */}
      <View style={[styles.tabsContainer, { borderBottomColor: colors.border }]}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && { borderBottomColor: colors.accentPrimary },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab(tab.id);
            }}
          >
            <Ionicons
              name={tab.icon}
              size={20}
              color={activeTab === tab.id ? colors.accentPrimary : colors.textTertiary}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === tab.id ? colors.accentPrimary : colors.textTertiary },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      {activeTab === 'summary' && (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        >
          {/* Summary badges */}
          <View style={styles.badgesRow}>
            <Badge label={summary?.mode || 'Standard'} variant="primary" />
            <Badge label={summary?.category || 'Général'} variant="default" />
            {summary?.language && (
              <Badge label={summary.language.toUpperCase()} variant="default" />
            )}
          </View>

          {/* Summary content */}
          <Card variant="elevated" style={styles.summaryCard}>
            <Text style={[styles.summaryContent, { color: colors.textPrimary }]}>
              {summary?.content || 'Aucun résumé disponible'}
            </Text>
          </Card>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.bgElevated }]} onPress={handleCopy}>
              <Ionicons name="copy-outline" size={20} color={colors.accentPrimary} />
              <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>Copier</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.bgElevated }]} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color={colors.accentPrimary} />
              <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>Partager</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.bgElevated }]} onPress={handleOpenVideo}>
              <Ionicons name="play-outline" size={20} color={colors.accentPrimary} />
              <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>Vidéo</Text>
            </TouchableOpacity>
          </View>

          {/* Analysis date */}
          <Text style={[styles.dateText, { color: colors.textMuted }]}>
            Analysé le {formatDate(summary?.createdAt || '')}
          </Text>
        </ScrollView>
      )}

      {activeTab === 'concepts' && (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        >
          {concepts.length > 0 ? (
            concepts.map((concept, index) => (
              <Card key={index} variant="elevated" style={styles.conceptCard}>
                <Text style={[styles.conceptName, { color: colors.accentPrimary }]}>
                  {concept.name}
                </Text>
                <Text style={[styles.conceptDefinition, { color: colors.textSecondary }]}>
                  {concept.definition}
                </Text>
              </Card>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="bulb-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Aucun concept extrait
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {activeTab === 'chat' && (
        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={100}
        >
          <FlatList
            ref={chatScrollRef}
            data={chatMessages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.chatMessages, { paddingBottom: 20 }]}
            onContentSizeChange={() => chatScrollRef.current?.scrollToEnd()}
            ListEmptyComponent={
              <View style={styles.chatEmptyState}>
                <Ionicons name="chatbubble-outline" size={48} color={colors.textTertiary} />
                <Text style={[styles.chatEmptyText, { color: colors.textSecondary }]}>
                  Posez une question sur la vidéo
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View
                style={[
                  styles.chatMessage,
                  item.role === 'user' ? styles.userMessage : styles.assistantMessage,
                  {
                    backgroundColor:
                      item.role === 'user' ? colors.accentPrimary : colors.bgElevated,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chatMessageText,
                    { color: item.role === 'user' ? '#FFFFFF' : colors.textPrimary },
                  ]}
                >
                  {item.content}
                </Text>
              </View>
            )}
          />

          <View style={[styles.chatInputContainer, { backgroundColor: colors.bgSecondary, borderTopColor: colors.border }]}>
            <TextInput
              style={[styles.chatInput, { backgroundColor: colors.bgElevated, color: colors.textPrimary }]}
              placeholder="Posez votre question..."
              placeholderTextColor={colors.textMuted}
              value={chatInput}
              onChangeText={setChatInput}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: colors.accentPrimary }]}
              onPress={handleSendMessage}
              disabled={!chatInput.trim() || isSendingMessage}
            >
              {isSendingMessage ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {activeTab === 'tools' && (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        >
          {/* Flashcards Section */}
          <Text style={[styles.toolsTitle, { color: colors.textPrimary }]}>Flashcards</Text>

          {flashcards.length === 0 ? (
            <Button
              title={isLoadingTools ? 'Génération...' : 'Générer des flashcards'}
              onPress={handleGenerateFlashcards}
              loading={isLoadingTools}
              fullWidth
              variant="outline"
              style={styles.generateButton}
            />
          ) : (
            <View style={styles.flashcardsContainer}>
              <TouchableOpacity
                style={[styles.flashcard, { backgroundColor: colors.bgElevated }]}
                onPress={() => setShowFlashcardAnswer(!showFlashcardAnswer)}
              >
                <Text style={[styles.flashcardLabel, { color: colors.textTertiary }]}>
                  {showFlashcardAnswer ? 'Réponse' : 'Question'} ({currentFlashcardIndex + 1}/{flashcards.length})
                </Text>
                <Text style={[styles.flashcardContent, { color: colors.textPrimary }]}>
                  {showFlashcardAnswer
                    ? flashcards[currentFlashcardIndex]?.back
                    : flashcards[currentFlashcardIndex]?.front}
                </Text>
                <Text style={[styles.flashcardHint, { color: colors.textMuted }]}>
                  Touchez pour retourner
                </Text>
              </TouchableOpacity>

              <View style={styles.flashcardNav}>
                <TouchableOpacity
                  style={[styles.flashcardNavButton, { backgroundColor: colors.bgElevated }]}
                  onPress={() => {
                    setCurrentFlashcardIndex(Math.max(0, currentFlashcardIndex - 1));
                    setShowFlashcardAnswer(false);
                  }}
                  disabled={currentFlashcardIndex === 0}
                >
                  <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.flashcardNavButton, { backgroundColor: colors.bgElevated }]}
                  onPress={() => {
                    setCurrentFlashcardIndex(Math.min(flashcards.length - 1, currentFlashcardIndex + 1));
                    setShowFlashcardAnswer(false);
                  }}
                  disabled={currentFlashcardIndex === flashcards.length - 1}
                >
                  <Ionicons name="chevron-forward" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* More tools coming soon */}
          <View style={[styles.comingSoon, { borderColor: colors.border }]}>
            <Ionicons name="construct-outline" size={24} color={colors.textTertiary} />
            <Text style={[styles.comingSoonText, { color: colors.textSecondary }]}>
              Plus d'outils bientôt : Quiz, Mind Maps, Export PDF
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
  progressContainer: {
    width: '80%',
    marginTop: Spacing.lg,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Spacing.lg,
  },
  videoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  thumbnail: {
    width: 80,
    height: 45,
    borderRadius: BorderRadius.sm,
  },
  videoInfo: {
    flex: 1,
  },
  videoTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  videoMeta: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  summaryCard: {
    marginBottom: Spacing.md,
  },
  summaryContent: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.base * 1.6,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: Spacing.md,
  },
  actionButton: {
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    minWidth: 80,
  },
  actionLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.xs,
  },
  dateText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  conceptCard: {
    marginBottom: Spacing.md,
  },
  conceptName: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.xs,
  },
  conceptDefinition: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.sm * 1.5,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.md,
  },
  chatContainer: {
    flex: 1,
  },
  chatMessages: {
    padding: Spacing.md,
  },
  chatEmptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  chatEmptyText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.md,
  },
  chatMessage: {
    maxWidth: '80%',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  userMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  chatMessageText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.sm * 1.5,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  chatInput: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    maxHeight: 100,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolsTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.md,
  },
  generateButton: {
    marginBottom: Spacing.xl,
  },
  flashcardsContainer: {
    marginBottom: Spacing.xl,
  },
  flashcard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    minHeight: 200,
    justifyContent: 'center',
  },
  flashcardLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
    textTransform: 'uppercase',
    marginBottom: Spacing.md,
  },
  flashcardContent: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    lineHeight: Typography.fontSize.lg * 1.5,
  },
  flashcardHint: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.lg,
  },
  flashcardNav: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  flashcardNavButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingSoon: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    borderStyle: 'dashed',
    gap: Spacing.md,
  },
  comingSoonText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
});

export default AnalysisScreen;
