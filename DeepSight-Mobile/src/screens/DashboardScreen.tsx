import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { videoApi, historyApi } from '../services/api';
import { Header, VideoCard, Button, Card, Badge, Avatar } from '../components';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { ANALYSIS_MODES, ANALYSIS_CATEGORIES, AI_MODELS } from '../constants/config';
import { isValidYouTubeUrl, formatCredits } from '../utils/formatters';
import type { RootStackParamList, MainTabParamList, AnalysisSummary } from '../types';

type DashboardNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

export const DashboardScreen: React.FC = () => {
  const { colors } = useTheme();
  const { user, refreshUser } = useAuth();
  const navigation = useNavigation<DashboardNavigationProp>();
  const insets = useSafeAreaInsets();

  const [videoUrl, setVideoUrl] = useState('');
  const [selectedMode, setSelectedMode] = useState('synthesis');
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisSummary[]>([]);

  const loadRecentAnalyses = useCallback(async () => {
    try {
      const response = await historyApi.getHistory(1, 5);
      setRecentAnalyses(response.items);
    } catch (error) {
      console.error('Failed to load recent analyses:', error);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshUser(), loadRecentAnalyses()]);
    setRefreshing(false);
  }, [refreshUser, loadRecentAnalyses]);

  React.useEffect(() => {
    loadRecentAnalyses();
  }, [loadRecentAnalyses]);

  const handleAnalyze = async () => {
    if (!videoUrl.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une URL YouTube');
      return;
    }

    if (!isValidYouTubeUrl(videoUrl)) {
      Alert.alert('Erreur', 'URL YouTube invalide');
      return;
    }

    if (user && user.credits <= 0) {
      Alert.alert(
        'Crédits insuffisants',
        'Vous n\'avez plus de crédits. Passez à un plan supérieur pour continuer.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Upgrade', onPress: () => navigation.navigate('Upgrade') },
        ]
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsAnalyzing(true);

    try {
      const { task_id } = await videoApi.analyze({
        url: videoUrl,
        mode: selectedMode,
        category: selectedCategory,
        model: selectedModel,
        language: 'fr',
      });

      navigation.navigate('Analysis', { videoUrl, summaryId: task_id });
      setVideoUrl('');
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'analyse');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleVideoPress = (summary: AnalysisSummary) => {
    navigation.navigate('Analysis', { summaryId: summary.id });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
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
                Bonjour,
              </Text>
              <Text style={[styles.userName, { color: colors.textPrimary }]}>
                {user?.username || 'Utilisateur'}
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
                  <Text style={styles.creditsLabel}>Crédits restants</Text>
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
              {user?.plan === 'free' && (
                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={() => navigation.navigate('Upgrade')}
                >
                  <Text style={styles.upgradeText}>Upgrade</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </LinearGradient>
          </Card>
        </View>

        {/* Analysis Input Section */}
        <View style={styles.analysisSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Analyser une vidéo
          </Text>

          <View style={[styles.inputContainer, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
            <Ionicons name="logo-youtube" size={24} color="#FF0000" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              placeholder="Collez l'URL YouTube ici..."
              placeholderTextColor={colors.textMuted}
              value={videoUrl}
              onChangeText={setVideoUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {videoUrl.length > 0 && (
              <TouchableOpacity onPress={() => setVideoUrl('')}>
                <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Mode Selection */}
          <Text style={[styles.optionLabel, { color: colors.textSecondary }]}>Mode d'analyse</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.optionsScroll}
          >
            {ANALYSIS_MODES.map((mode) => (
              <TouchableOpacity
                key={mode.id}
                style={[
                  styles.optionChip,
                  { backgroundColor: colors.bgElevated, borderColor: colors.border },
                  selectedMode === mode.id && { backgroundColor: colors.accentPrimary, borderColor: colors.accentPrimary },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedMode(mode.id);
                }}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    { color: colors.textSecondary },
                    selectedMode === mode.id && { color: '#FFFFFF' },
                  ]}
                >
                  {mode.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Category Selection */}
          <Text style={[styles.optionLabel, { color: colors.textSecondary }]}>Catégorie</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.optionsScroll}
          >
            {ANALYSIS_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.optionChip,
                  { backgroundColor: colors.bgElevated, borderColor: colors.border },
                  selectedCategory === cat.id && { backgroundColor: colors.accentPrimary, borderColor: colors.accentPrimary },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedCategory(cat.id);
                }}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    { color: colors.textSecondary },
                    selectedCategory === cat.id && { color: '#FFFFFF' },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Analyze Button */}
          <Button
            title={isAnalyzing ? 'Analyse en cours...' : 'Analyser'}
            onPress={handleAnalyze}
            loading={isAnalyzing}
            fullWidth
            disabled={!videoUrl.trim() || isAnalyzing}
            style={styles.analyzeButton}
          />
        </View>

        {/* Recent Analyses */}
        {recentAnalyses.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Analyses récentes
              </Text>
              <TouchableOpacity onPress={() => (navigation as any).navigate('History')}>
                <Text style={[styles.seeAllText, { color: colors.accentPrimary }]}>
                  Voir tout
                </Text>
              </TouchableOpacity>
            </View>

            {recentAnalyses.map((analysis) => (
              <VideoCard
                key={analysis.id}
                video={analysis}
                onPress={() => handleVideoPress(analysis)}
                isFavorite={analysis.isFavorite}
                compact
              />
            ))}
          </View>
        )}

        {/* Quick Stats */}
        <View style={styles.statsSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Vos statistiques
          </Text>
          <View style={styles.statsGrid}>
            <Card variant="elevated" style={styles.statCard}>
              <Ionicons name="videocam" size={24} color={colors.accentPrimary} />
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                {user?.total_videos || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
                Vidéos analysées
              </Text>
            </Card>
            <Card variant="elevated" style={styles.statCard}>
              <Ionicons name="document-text" size={24} color={colors.accentSecondary} />
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                {user?.total_words ? `${Math.round(user.total_words / 1000)}k` : '0'}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
                Mots générés
              </Text>
            </Card>
          </View>
        </View>
      </ScrollView>
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    paddingVertical: Spacing.sm,
  },
  optionLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  optionsScroll: {
    marginBottom: Spacing.sm,
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  optionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  optionChipText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  analyzeButton: {
    marginTop: Spacing.lg,
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
});

export default DashboardScreen;
