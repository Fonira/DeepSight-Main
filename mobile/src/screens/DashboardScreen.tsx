import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  RefreshControl,
  LayoutAnimation,
  Platform,
  UIManager,
  Linking,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
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
import { useScreenDoodleVariant } from '../contexts/DoodleVariantContext';
import { videoApi, historyApi } from '../services/api';
import { Header, VideoCard, Card, Badge, Avatar, FreeTrialLimitModal, PlanBadge } from '../components';
import SmartInputBar from '../components/SmartInputBar';
import { CustomizationPanel } from '../components/customization';
import { VideoDiscoveryModal } from '../components/VideoDiscoveryModal';
import { usePlan } from '../hooks/usePlan';
import { sp, borderRadius } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';
import { gradients } from '../theme/colors';
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
  useScreenDoodleVariant('analysis');

  const userPlan = normalizePlanId(user?.plan);
  const { planName, planIcon, planColor, limits, usage, refetch: refetchPlan } = usePlan();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisSummary[]>([]);
  const [favorites, setFavorites] = useState<AnalysisSummary[]>([]);
  const [estimatedCredits, setEstimatedCredits] = useState<number | undefined>(undefined);

  const [showFreeTrialModal, setShowFreeTrialModal] = useState(false);
  const [analysesUsedThisMonth, setAnalysesUsedThisMonth] = useState(0);

  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [pendingSearchData, setPendingSearchData] = useState<{
    mode: string;
    category: string;
    language: string;
    deepResearch: boolean;
    searchQuery: string;
  } | null>(null);

  const [showCustomization, setShowCustomization] = useState(false);
  const [customization, setCustomization] = useState<AnalysisCustomization>(DEFAULT_CUSTOMIZATION);

  const toggleCustomization = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowCustomization(!showCustomization);
  }, [showCustomization]);

  const loadRecentAnalyses = useCallback(async () => {
    try {
      const response = await historyApi.getHistory(1, 5);
      setRecentAnalyses(response.items ?? []);
    } catch (error) {
      if (__DEV__) { console.error('Failed to load recent analyses:', error); }
    }
  }, []);

  const loadFavorites = useCallback(async () => {
    try {
      const favs = await historyApi.getFavorites(3);
      setFavorites(favs ?? []);
    } catch (error) {
      if (__DEV__) { console.error('Failed to load favorites:', error); }
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshUser(), loadRecentAnalyses(), loadFavorites(), refetchPlan()]);
    setRefreshing(false);
  }, [refreshUser, loadRecentAnalyses, loadFavorites, refetchPlan]);

  React.useEffect(() => {
    loadRecentAnalyses();
    loadFavorites();
  }, [loadRecentAnalyses, loadFavorites]);

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
    if (isOffline) {
      Alert.alert(t.common.error, t.errors.offlineError);
      return;
    }

    // Check monthly analysis quota
    if (
      limits.monthlyAnalyses !== -1 &&
      usage.analyses_this_month >= limits.monthlyAnalyses
    ) {
      Alert.alert(
        language === 'fr' ? 'Quota atteint' : 'Quota reached',
        language === 'fr'
          ? `Vous avez utilisé ${usage.analyses_this_month}/${limits.monthlyAnalyses} analyses ce mois-ci.`
          : `You have used ${usage.analyses_this_month}/${limits.monthlyAnalyses} analyses this month.`,
        [
          { text: t.common.cancel, style: 'cancel' },
          {
            text: language === 'fr' ? 'Voir les plans' : 'View plans',
            onPress: () => Linking.openURL('https://www.deepsightsynthesis.com/upgrade'),
          },
        ]
      );
      return;
    }

    if (user && (user.credits ?? 0) <= 0) {
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

    if (data.inputType === 'url' && !isValidYouTubeUrl(data.value)) {
      Alert.alert(t.common.error, t.errors.invalidYoutubeUrl);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsAnalyzing(true);

    try {
      const analysisRequest: {
        mode: string;
        category: string;
        language: string;
        deep_research: boolean;
        model: string;
        url?: string;
        raw_text?: string;
        title?: string;
        source?: string;
      } = {
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
        setPendingSearchData({
          mode: data.mode,
          category: data.category,
          language: data.language || 'fr',
          deepResearch: data.deepResearch || false,
          searchQuery: data.value,
        });
        setShowDiscoveryModal(true);
        setIsAnalyzing(false);
        return;
      }

      const hasCustomization =
        customization.userPrompt ||
        customization.antiAIDetection ||
        customization.writingStyle !== DEFAULT_CUSTOMIZATION.writingStyle ||
        customization.targetLength !== DEFAULT_CUSTOMIZATION.targetLength ||
        customization.formalityLevel !== DEFAULT_CUSTOMIZATION.formalityLevel ||
        customization.vocabularyComplexity !== DEFAULT_CUSTOMIZATION.vocabularyComplexity;

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

      if (userPlan === 'free') {
        const newCount = analysesUsedThisMonth + 1;
        setAnalysesUsedThisMonth(newCount);
        const promptStatus = shouldShowUpgradePrompt(userPlan, newCount);
        if (promptStatus === 'blocked') {
          setShowFreeTrialModal(true);
        } else if (promptStatus === 'warning') {
          setTimeout(() => {
            setShowFreeTrialModal(true);
          }, 2000);
        }
      }

      navigation.navigate('Analysis', {
        videoUrl: (analysisRequest as { url?: string }).url,
        summaryId: task_id,
      });
    } catch (error) {
      if (__DEV__) { console.error('Analysis error:', error); }
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
      setRecentAnalyses((prev) =>
        prev.map((item) =>
          item.id === summary.id ? { ...item, isFavorite } : item
        )
      );
      if (!isFavorite) {
        setFavorites((prev) => prev.filter((item) => item.id !== summary.id));
      } else {
        loadFavorites();
      }
    } catch (error) {
      if (__DEV__) { console.error('Failed to toggle favorite:', error); }
    }
  };

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
      if (__DEV__) { console.error('Analysis error:', error); }
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
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accentPrimary}
          />
        }
      >
        {/* Welcome Section */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.welcomeSection}>
          <View style={styles.welcomeHeader}>
            <View>
              <Text style={[styles.welcomeText, { color: colors.textSecondary }]}>
                {t.auth.welcomeBack}
              </Text>
              <Text style={[styles.userName, { color: colors.textPrimary }]}>
                {user?.username || t.admin.user}
              </Text>
              <View style={{ marginTop: sp.sm }}>
                <PlanBadge
                  planName={planName}
                  planIcon={planIcon}
                  planColor={planColor}
                  analysesUsed={usage.analyses_this_month}
                  analysesLimit={limits.monthlyAnalyses}
                  compact
                />
              </View>
            </View>
            <Pressable
              onPress={() => navigation.navigate('Account')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Avatar uri={user?.avatar_url} name={user?.username} size="lg" />
            </Pressable>
          </View>

          {/* Credits Card */}
          <Card variant="elevated" style={styles.creditsCard}>
            <LinearGradient
              colors={[...gradients.primary]}
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
                <Pressable
                  style={styles.upgradeButton}
                  onPress={() => navigation.navigate('Upgrade')}
                >
                  <Text style={styles.upgradeText}>{t.nav.upgrade}</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </Pressable>
              )}
            </LinearGradient>
          </Card>
        </Animated.View>

        {/* Analysis Input Section */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.analysisSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {t.dashboard.title}
            </Text>

            <Pressable
              style={[
                styles.customizeButton,
                {
                  backgroundColor: showCustomization
                    ? colors.accentPrimary
                    : colors.glassBg,
                  borderColor: showCustomization
                    ? colors.accentPrimary
                    : colors.glassBorder,
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
            </Pressable>
          </View>

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
        </Animated.View>

        {/* Favorites Section */}
        {favorites.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="heart" size={18} color={colors.accentError} style={{ marginRight: sp.xs }} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  {t.history.favorites || 'Favoris'}
                </Text>
              </View>
              <Pressable onPress={() => navigation.navigate('History')}>
                <Text style={[styles.seeAllText, { color: colors.accentPrimary }]}>
                  {t.dashboard.viewAll}
                </Text>
              </Pressable>
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
          </Animated.View>
        )}

        {/* Recent Analyses */}
        {recentAnalyses.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t.dashboard.recentAnalyses}
              </Text>
              <Pressable onPress={() => navigation.navigate('History')}>
                <Text style={[styles.seeAllText, { color: colors.accentPrimary }]}>
                  {t.dashboard.viewAll}
                </Text>
              </Pressable>
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
          </Animated.View>
        )}

        {/* Quick Stats */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.statsSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {t.admin.statistics}
          </Text>
          <View style={styles.statsGrid}>
            <Card variant="elevated" style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: `${colors.accentPrimary}15` }]}>
                <Ionicons name="videocam" size={22} color={colors.accentPrimary} />
              </View>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                {user?.total_videos || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t.admin.videosAnalyzed}
              </Text>
            </Card>
            <Card variant="elevated" style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: `${colors.accentSecondary}15` }]}>
                <Ionicons name="document-text" size={22} color={colors.accentSecondary} />
              </View>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                {user?.total_words ? `${Math.round(user.total_words / 1000)}k` : '0'}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t.admin.wordsGenerated}
              </Text>
            </Card>
          </View>
        </Animated.View>
      </ScrollView>

      <FreeTrialLimitModal
        visible={showFreeTrialModal}
        onClose={() => setShowFreeTrialModal(false)}
        analysesUsed={analysesUsedThisMonth}
        lastVideoDuration={0}
        onStartTrial={() => {
          navigation.navigate('Upgrade');
        }}
        onUpgrade={() => {
          navigation.navigate('Upgrade');
        }}
      />

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
    paddingHorizontal: sp.lg,
  },
  welcomeSection: {
    marginBottom: sp.xl,
  },
  welcomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp.lg,
  },
  welcomeText: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.body,
  },
  userName: {
    fontSize: fontSize['2xl'],
    fontFamily: fontFamily.bodySemiBold,
  },
  creditsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  creditsGradient: {
    padding: sp.lg,
    borderRadius: borderRadius.lg,
  },
  creditsContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  creditsLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.body,
    marginBottom: sp.xs,
  },
  creditsValue: {
    color: '#FFFFFF',
    fontSize: fontSize['3xl'],
    fontFamily: fontFamily.bodySemiBold,
  },
  planBadge: {
    alignItems: 'flex-end',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: sp.md,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    borderRadius: borderRadius.full,
  },
  upgradeText: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bodyMedium,
    marginRight: sp.xs,
  },
  analysisSection: {
    marginBottom: sp.xl,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bodySemiBold,
    marginBottom: sp.md,
  },
  smartInputCard: {
    padding: 0,
    overflow: 'hidden',
  },
  recentSection: {
    marginBottom: sp.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bodyMedium,
    minHeight: 44,
    textAlignVertical: 'center',
    lineHeight: 44,
  },
  statsSection: {
    marginBottom: sp.xl,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: sp.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: sp.lg,
  },
  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sp.sm,
  },
  statValue: {
    fontSize: fontSize['2xl'],
    fontFamily: fontFamily.bodySemiBold,
    marginTop: sp.xs,
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.body,
    marginTop: sp.xs,
    textAlign: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp.md,
  },
  customizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: sp.xs,
  },
  customizeButtonText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bodyMedium,
  },
  antiAIIndicator: {
    marginLeft: sp.xs,
  },
  customizationCard: {
    padding: 0,
    marginBottom: sp.md,
    overflow: 'hidden',
  },
});

export default DashboardScreen;
