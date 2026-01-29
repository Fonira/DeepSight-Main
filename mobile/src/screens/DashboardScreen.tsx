import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { videoApi, historyApi } from '../services/api';
import { Header, VideoCard, Card, Badge, Avatar, FreeTrialLimitModal } from '../components';
import SmartInputBar from '../components/SmartInputBar';
import { CustomizationPanel } from '../components/customization';
import { VideoDiscoveryModal } from '../components/VideoDiscoveryModal';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { isValidYouTubeUrl, formatCredits } from '../utils/formatters';
import { useIsOffline } from '../hooks/useNetworkStatus';
import {
  normalizePlanId,
  shouldShowUpgradePrompt,
  CONVERSION_TRIGGERS,
} from '../config/planPrivileges';
import type { RootStackParamList, MainTabParamList, AnalysisSummary } from '../types';
import { AnalysisCustomization, DEFAULT_CUSTOMIZATION } from '../types/analysis';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Composite type for navigating to both tab screens and stack screens
type DashboardNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Dashboard'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export const DashboardScreen: React.FC = () => {
  const { colors } = useTheme();
  const { user, refreshUser } = useAuth();
  const { t, language } = useLanguage();
  const navigation = useNavigation<DashboardNavigationProp>();
  const insets = useSafeAreaInsets();
  const isOffline = useIsOffline();

  // Normalize user plan
  const userPlan = normalizePlanId(user?.plan);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisSummary[]>([]);
  const [favorites, setFavorites] = useState<AnalysisSummary[]>([]);
  const [estimatedCredits, setEstimatedCredits] = useState<number | undefined>(undefined);

  // Free trial limit modal state
  const [showFreeTrialModal, setShowFreeTrialModal] = useState(false);
  const [analysesUsedThisMonth, setAnalysesUsedThisMonth] = useState(0);
  // Note: lastVideoDuration reserved for future FreeTrialLimitModal enhancement
  // Currently the modal shows 0 for duration, which is acceptable as a placeholder

  // Video discovery modal state
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [pendingSearchData, setPendingSearchData] = useState<{
    mode: string;
    category: string;
    language: string;
    deepResearch: boolean;
    searchQuery: string;
  } | null>(null);

  // Customization panel state
  const [showCustomization, setShowCustomization] = useState(false);
  const [customization, setCustomization] = useState<AnalysisCustomization>(DEFAULT_CUSTOMIZATION);

  // Handle customization toggle with animation
  const toggleCustomization = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowCustomization(!showCustomization);
  }, [showCustomization]);

  const loadRecentAnalyses = useCallback(async () => {
    try {
      const response = await historyApi.getHistory(1, 5);
      setRecentAnalyses(response.items);
    } catch (error) {
      console.error('Failed to load recent analyses:', error);
    }
  }, []);

  const loadFavorites = useCallback(async () => {
    try {
      const favs = await historyApi.getFavorites(3);
      setFavorites(favs);
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshUser(), loadRecentAnalyses(), loadFavorites()]);
    setRefreshing(false);
  }, [refreshUser, loadRecentAnalyses, loadFavorites]);

  React.useEffect(() => {
    loadRecentAnalyses();
    loadFavorites();
  }, [loadRecentAnalyses, loadFavorites]);

  // Track analyses used this month from user data
  useEffect(() => {
    if (user?.analyses_this_month !== undefined) {
      setAnalysesUsedThisMonth(user.analyses_this_month);
    }
  }, [user?.analyses_this_month]);

  const handleSmartInputSubmit = async (data: {
    inputType: 'url' | 'text' | 'search';
    value: string;
    category: string;
    mode: string;
    language?: string;
    title?: string;
    source?: string;
    deepResearch?: boolean;
    model?: string;
  }) => {
    // Block submission when offline
    if (isOffline) {
      Alert.alert(t.common.error, t.errors.offlineError);
      return;
    }

    // Check credits
    if (user && user.credits <= 0) {
      Alert.alert(
        t.errors.noCredits,
        t.chat.upgradeForMore,
        [
          { text: t.common.cancel, style: 'cancel' },
          { text: t.nav.upgrade, onPress: () => navigation.navigate('Upgrade') },
        ]
      );
      return;
    }

    // Validate URL if input type is URL
    if (data.inputType === 'url' && !isValidYouTubeUrl(data.value)) {
      Alert.alert(t.common.error, t.errors.invalidYoutubeUrl);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsAnalyzing(true);

    try {
      // Build the analysis request based on input type
      const analysisRequest: any = {
        mode: data.mode,
        category: data.category,
        language: data.language || 'fr',
        deep_research: data.deepResearch || false,
        model: data.model || 'mistral-small-latest',
      };

      if (data.inputType === 'url') {
        analysisRequest.url = data.value;
      } else if (data.inputType === 'text') {
        analysisRequest.raw_text = data.value;
        analysisRequest.title = data.title;
        analysisRequest.source = data.source;
      } else if (data.inputType === 'search') {
        // For search, show the VideoDiscoveryModal for user to select a video
        setPendingSearchData({
          mode: data.mode,
          category: data.category,
          language: data.language || 'fr',
          deepResearch: data.deepResearch || false,
          searchQuery: data.value, // Pass the search query to pre-fill the modal
        });
        setShowDiscoveryModal(true);
        setIsAnalyzing(false);
        return; // Exit early - analysis will continue after video selection
      }

      // Use V2 API with customization options if any customization is set
      const hasCustomization = 
        customization.userPrompt ||
        customization.antiAIDetection ||
        customization.writingStyle !== DEFAULT_CUSTOMIZATION.writingStyle ||
        customization.targetLength !== DEFAULT_CUSTOMIZATION.targetLength ||
        customization.formalityLevel !== DEFAULT_CUSTOMIZATION.formalityLevel ||
        customization.vocabularyComplexity !== DEFAULT_CUSTOMIZATION.vocabularyComplexity;

      let task_id: string;
      
      if (hasCustomization) {
        // Use V2 API with customization
        const result = await videoApi.analyzeVideoV2({
          ...analysisRequest,
          customization: {
            userPrompt: customization.userPrompt,
            antiAIDetection: customization.antiAIDetection,
            writingStyle: customization.writingStyle,
            targetLength: customization.targetLength,
            formalityLevel: customization.formalityLevel,
            vocabularyComplexity: customization.vocabularyComplexity,
            includeExamples: customization.includeExamples,
            personalTone: customization.personalTone,
          },
        });
        task_id = result.task_id;
      } else {
        // Use standard API for non-customized requests
        const result = await videoApi.analyze(analysisRequest);
        task_id = result.task_id;
      }

      // For free users, track analysis and potentially show upgrade modal
      if (userPlan === 'free') {
        const newCount = analysesUsedThisMonth + 1;
        setAnalysesUsedThisMonth(newCount);

        // Check if we should show the upgrade prompt
        const promptStatus = shouldShowUpgradePrompt(userPlan, newCount);

        if (promptStatus === 'blocked') {
          // User has hit the limit - show modal immediately
          setShowFreeTrialModal(true);
        } else if (promptStatus === 'warning') {
          // User is approaching limit - show modal after a delay
          setTimeout(() => {
            setShowFreeTrialModal(true);
          }, 2000);
        }
      }

      navigation.navigate('Analysis', {
        videoUrl: analysisRequest.url,
        summaryId: task_id,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      Alert.alert(t.common.error, t.errors.generic);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleVideoPress = (summary: AnalysisSummary) => {
    navigation.navigate('Analysis', { summaryId: summary.id });
  };

  const handleFavoritePress = async (summary: AnalysisSummary) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { isFavorite } = await historyApi.toggleFavorite(summary.id);
      // Update local state
      setRecentAnalyses((prev) =>
        prev.map((item) =>
          item.id === summary.id ? { ...item, isFavorite } : item
        )
      );
      // Reload favorites if needed
      if (!isFavorite) {
        setFavorites((prev) => prev.filter((item) => item.id !== summary.id));
      } else {
        loadFavorites();
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  // Handle video selection from discovery modal
  const handleVideoSelect = async (videoId: string, videoUrl: string) => {
    if (!pendingSearchData) return;

    setShowDiscoveryModal(false);
    setIsAnalyzing(true);

    try {
      const analysisRequest = {
        url: videoUrl,
        mode: pendingSearchData.mode,
        category: pendingSearchData.category,
        language: pendingSearchData.language,
        model: user?.default_model || 'mistral-small-latest',
        deep_research: pendingSearchData.deepResearch,
      };

      // Use V2 API with customization options if any customization is set
      const hasCustomization = 
        customization.userPrompt ||
        customization.antiAIDetection ||
        customization.writingStyle !== DEFAULT_CUSTOMIZATION.writingStyle ||
        customization.targetLength !== DEFAULT_CUSTOMIZATION.targetLength;

      let task_id: string;
      
      if (hasCustomization) {
        const result = await videoApi.analyzeVideoV2({
          ...analysisRequest,
          customization: {
            userPrompt: customization.userPrompt,
            antiAIDetection: customization.antiAIDetection,
            writingStyle: customization.writingStyle,
            targetLength: customization.targetLength,
            formalityLevel: customization.formalityLevel,
            vocabularyComplexity: customization.vocabularyComplexity,
            includeExamples: customization.includeExamples,
            personalTone: customization.personalTone,
          },
        });
        task_id = result.task_id;
      } else {
        const result = await videoApi.analyze(analysisRequest);
        task_id = result.task_id;
      }

      // For free users, track analysis
      if (userPlan === 'free') {
        const newCount = analysesUsedThisMonth + 1;
        setAnalysesUsedThisMonth(newCount);
        const promptStatus = shouldShowUpgradePrompt(userPlan, newCount);
        if (promptStatus === 'blocked') {
          setShowFreeTrialModal(true);
        } else if (promptStatus === 'warning') {
          setTimeout(() => setShowFreeTrialModal(true), 2000);
        }
      }

      navigation.navigate('Analysis', {
        videoUrl: videoUrl,
        summaryId: task_id,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      Alert.alert(t.common.error, t.errors.generic);
    } finally {
      setIsAnalyzing(false);
      setPendingSearchData(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <Header showLogo rightAction={{ icon: 'notifications-outline', onPress: () => {} }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accentPrimary}
          />
        }
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeHeader}>
            <View>
              <Text style={[styles.welcomeText, { color: colors.textSecondary }]}>
                {t.auth.welcomeBack}
              </Text>
              <Text style={[styles.userName, { color: colors.textPrimary }]}>
                {user?.username || t.admin.user}
              </Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Account')}>
              <Avatar uri={user?.avatar_url} name={user?.username} size="lg" />
            </TouchableOpacity>
          </View>

          {/* Credits Card */}
          <Card variant="elevated" style={styles.creditsCard}>
            <LinearGradient
              colors={Colors.gradientPrimary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.creditsGradient}
            >
              <View style={styles.creditsContent}>
                <View>
                  <Text style={styles.creditsLabel}>{t.dashboard.creditsRemaining}</Text>
                  <Text style={styles.creditsValue}>
                    {formatCredits(user?.credits || 0, user?.credits_monthly || 20)}
                  </Text>
                </View>
                <View style={styles.planBadge}>
                  <Badge
                    label={user?.plan?.toUpperCase() || 'FREE'}
                    variant="default"
                    style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                    textStyle={{ color: '#FFFFFF' }}
                  />
                </View>
              </View>
              {userPlan === 'free' && (
                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={() => navigation.navigate('Upgrade')}
                >
                  <Text style={styles.upgradeText}>{t.nav.upgrade}</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </LinearGradient>
          </Card>
        </View>

        {/* Analysis Input Section - SmartInputBar */}
        <View style={styles.analysisSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {t.dashboard.title}
            </Text>
            
            {/* Customization Toggle Button */}
            <TouchableOpacity
              style={[
                styles.customizeButton,
                { 
                  backgroundColor: showCustomization 
                    ? colors.accentPrimary 
                    : colors.bgTertiary,
                  borderColor: showCustomization
                    ? colors.accentPrimary
                    : colors.border,
                },
              ]}
              onPress={toggleCustomization}
              accessibilityLabel="Personnaliser"
            >
              <Ionicons 
                name={showCustomization ? 'options' : 'options-outline'} 
                size={16} 
                color={showCustomization ? '#FFFFFF' : colors.textSecondary} 
              />
              <Text style={[
                styles.customizeButtonText,
                { color: showCustomization ? '#FFFFFF' : colors.textSecondary },
              ]}>
                Personnaliser
              </Text>
              {customization.antiAIDetection && (
                <View style={styles.antiAIIndicator}>
                  <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Customization Panel (Collapsible) */}
          {showCustomization && (
            <Card variant="elevated" style={styles.customizationCard}>
              <CustomizationPanel
                onCustomizationChange={setCustomization}
                initialCustomization={customization}
                language={language as 'fr' | 'en'}
                compact={false}
                showAdvanced={true}
                persistPreferences={true}
              />
            </Card>
          )}

          <Card variant="elevated" style={styles.smartInputCard}>
            <SmartInputBar
              onSubmit={handleSmartInputSubmit}
              isLoading={isAnalyzing}
              creditCost={estimatedCredits}
              creditsRemaining={user?.credits}
              userPlan={user?.plan}
            />
          </Card>
        </View>

        {/* Favorites Section */}
        {favorites.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="heart" size={18} color={colors.accentError} style={{ marginRight: Spacing.xs }} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  {t.history.favorites || 'Favoris'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => {
                // Navigate to History with favorites filter active
                navigation.navigate('History');
              }}>
                <Text style={[styles.seeAllText, { color: colors.accentPrimary }]}>
                  {t.dashboard.viewAll}
                </Text>
              </TouchableOpacity>
            </View>

            {favorites.map((analysis) => (
              <VideoCard
                key={analysis.id}
                video={analysis}
                onPress={() => handleVideoPress(analysis)}
                onFavoritePress={() => handleFavoritePress(analysis)}
                isFavorite={true}
                compact
              />
            ))}
          </View>
        )}

        {/* Recent Analyses */}
        {recentAnalyses.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t.dashboard.recentAnalyses}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('History')}>
                <Text style={[styles.seeAllText, { color: colors.accentPrimary }]}>
                  {t.dashboard.viewAll}
                </Text>
              </TouchableOpacity>
            </View>

            {recentAnalyses.map((analysis) => (
              <VideoCard
                key={analysis.id}
                video={analysis}
                onPress={() => handleVideoPress(analysis)}
                onFavoritePress={() => handleFavoritePress(analysis)}
                isFavorite={analysis.isFavorite}
                compact
              />
            ))}
          </View>
        )}

        {/* Quick Stats */}
        <View style={styles.statsSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {t.admin.statistics}
          </Text>
          <View style={styles.statsGrid}>
            <Card variant="elevated" style={styles.statCard}>
              <Ionicons name="videocam" size={24} color={colors.accentPrimary} />
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                {user?.total_videos || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
                {t.admin.videosAnalyzed}
              </Text>
            </Card>
            <Card variant="elevated" style={styles.statCard}>
              <Ionicons name="document-text" size={24} color={colors.accentSecondary} />
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                {user?.total_words ? `${Math.round(user.total_words / 1000)}k` : '0'}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
                {t.admin.wordsGenerated}
              </Text>
            </Card>
          </View>
        </View>
      </ScrollView>

      {/* Free Trial Limit Modal */}
      <FreeTrialLimitModal
        visible={showFreeTrialModal}
        onClose={() => setShowFreeTrialModal(false)}
        analysesUsed={analysesUsedThisMonth}
        lastVideoDuration={0} // Placeholder - could be enhanced to track actual duration
        onStartTrial={() => {
          // TODO: Implement trial start logic
          navigation.navigate('Upgrade');
        }}
        onUpgrade={() => {
          navigation.navigate('Upgrade');
        }}
      />

      {/* Video Discovery Modal for Search Mode */}
      <VideoDiscoveryModal
        visible={showDiscoveryModal}
        onClose={() => {
          setShowDiscoveryModal(false);
          setPendingSearchData(null);
        }}
        onSelectVideo={handleVideoSelect}
        initialQuery={pendingSearchData?.searchQuery}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  welcomeSection: {
    marginBottom: Spacing.xl,
  },
  welcomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  welcomeText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
  },
  userName: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  creditsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  creditsGradient: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  creditsContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  creditsLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginBottom: Spacing.xs,
  },
  creditsValue: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize['3xl'],
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  planBadge: {
    alignItems: 'flex-end',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  upgradeText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
    marginRight: Spacing.xs,
  },
  analysisSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.md,
  },
  smartInputCard: {
    padding: 0,
    overflow: 'hidden',
  },
  recentSection: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  statsSection: {
    marginBottom: Spacing.xl,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.lg,
  },
  statValue: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginTop: Spacing.sm,
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  // Customization section styles
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  customizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  customizeButtonText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  antiAIIndicator: {
    marginLeft: Spacing.xs,
  },
  customizationCard: {
    padding: 0,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
});

export default DashboardScreen;
