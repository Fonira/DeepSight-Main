import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { playlistApi, videoApi } from '../services/api';
import { Header, Card, EmptyState, Button, Badge, UpgradePromptModal, DeepSightSpinner } from '../components';
import { GlassCard } from '../components/ui/GlassCard';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { normalizePlanId, hasFeature, getLimit, getMinPlanForFeature, getPlanInfo } from '../config/planPrivileges';
import type { Playlist, RootStackParamList } from '../types';

type PlaylistsNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const PlaylistsScreen: React.FC = () => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigation = useNavigation<PlaylistsNavigationProp>();
  const insets = useSafeAreaInsets();

  // Plan access checks
  const userPlan = normalizePlanId(user?.plan);
  const hasPlaylistAccess = hasFeature(userPlan, 'playlists');
  const maxPlaylists = getLimit(userPlan, 'maxPlaylists');
  const minPlanForPlaylists = getMinPlanForFeature('playlists');
  const minPlanInfo = minPlanForPlaylists ? getPlanInfo(minPlanForPlaylists) : null;

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create playlist modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDescription, setNewPlaylistDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Analyze playlist modal
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Upgrade modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Load playlists from API
  const loadPlaylists = useCallback(async () => {
    try {
      const response = await playlistApi.getPlaylists();
      setPlaylists(response.playlists || []);
    } catch (err) {
      console.error('Error loading playlists:', err);
      // Don't show error alert on initial load failure
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPlaylists();
    setRefreshing(false);
  }, [loadPlaylists]);

  // Check plan access before showing create modal
  const handleShowCreateModal = () => {
    if (!hasPlaylistAccess) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowUpgradeModal(true);
      return;
    }

    // Check if user has reached playlist limit
    if (maxPlaylists !== -1 && playlists.length >= maxPlaylists) {
      Alert.alert(
        language === 'fr' ? 'Limite atteinte' : 'Limit reached',
        language === 'fr'
          ? `Vous avez atteint la limite de ${maxPlaylists} playlists pour votre plan. Passez à un plan supérieur pour en créer plus.`
          : `You've reached the limit of ${maxPlaylists} playlists for your plan. Upgrade to create more.`,
        [
          { text: t.common.cancel, style: 'cancel' },
          { text: t.nav.upgrade, onPress: () => navigation.navigate('Upgrade') },
        ]
      );
      return;
    }

    setShowCreateModal(true);
  };

  // Check plan access before showing analyze modal
  const handleShowAnalyzeModal = () => {
    if (!hasPlaylistAccess) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowUpgradeModal(true);
      return;
    }
    setShowAnalyzeModal(true);
  };

  // Create a new playlist
  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      Alert.alert(t.common.error, t.playlists.playlistName);
      return;
    }

    setIsCreating(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const newPlaylist = await playlistApi.createPlaylist(
        newPlaylistName.trim(),
        newPlaylistDescription.trim() || undefined
      );
      setPlaylists(prev => [newPlaylist, ...prev]);
      setShowCreateModal(false);
      setNewPlaylistName('');
      setNewPlaylistDescription('');
      Alert.alert(t.success.playlistCreated, t.success.playlistCreated);
    } catch (err) {
      Alert.alert(t.common.error, t.errors.generic);
    } finally {
      setIsCreating(false);
    }
  };

  // Analyze a YouTube playlist
  const handleAnalyzePlaylist = async () => {
    if (!playlistUrl.trim()) {
      Alert.alert(t.common.error, t.playlists.enterPlaylistUrl);
      return;
    }

    // Validate YouTube playlist URL
    const isValidUrl = playlistUrl.includes('youtube.com/playlist') ||
                       playlistUrl.includes('youtu.be') ||
                       playlistUrl.includes('list=');

    if (!isValidUrl) {
      Alert.alert(t.common.error, t.errors.invalidUrl);
      return;
    }

    setIsAnalyzing(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const result = await playlistApi.analyzePlaylist(playlistUrl.trim(), {
        mode: 'detailed',
        category: 'general',
        model: 'gpt-4',
        language: 'fr',
      });

      setShowAnalyzeModal(false);
      setPlaylistUrl('');

      // Navigate to analysis screen with task ID
      navigation.navigate('Analysis', { summaryId: result.task_id });
    } catch (err) {
      Alert.alert(t.common.error, t.errors.generic);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Delete a playlist
  const handleDeletePlaylist = (playlist: Playlist) => {
    Alert.alert(
      t.playlists.deletePlaylist,
      t.playlists.deletePlaylistConfirm,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await playlistApi.deletePlaylist(playlist.id);
              setPlaylists(prev => prev.filter(p => p.id !== playlist.id));
            } catch (err) {
              Alert.alert(t.common.error, t.errors.generic);
            }
          },
        },
      ]
    );
  };

  const handlePlaylistPress = (playlist: Playlist) => {
    Haptics.selectionAsync();
    navigation.navigate('PlaylistDetail', { playlistId: playlist.id });
  };

  const renderPlaylistItem = useCallback(
    ({ item }: { item: Playlist }) => (
      <TouchableOpacity
        onPress={() => handlePlaylistPress(item)}
        onLongPress={() => handleDeletePlaylist(item)}
        activeOpacity={0.7}
      >
        <Card variant="elevated" style={styles.playlistCard}>
          <View style={styles.playlistContent}>
            <View style={[styles.playlistThumbnails, { backgroundColor: colors.bgElevated }]}>
              {item.thumbnails && item.thumbnails.length > 0 ? (
                <View style={styles.thumbnailGrid}>
                  {item.thumbnails.slice(0, 4).map((thumb, index) => (
                    <Image
                      key={index}
                      source={{ uri: thumb }}
                      style={styles.thumbnailImage}
                      contentFit="cover"
                    />
                  ))}
                </View>
              ) : (
                <Ionicons name="folder-outline" size={32} color={colors.textTertiary} />
              )}
            </View>
            <View style={styles.playlistInfo}>
              <Text style={[styles.playlistName, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.name}
              </Text>
              {item.description && (
                <Text style={[styles.playlistDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
              <View style={styles.playlistMeta}>
                <Badge label={`${item.videoCount} ${t.playlists.videos}`} variant="default" />
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </View>
        </Card>
      </TouchableOpacity>
    ),
    [colors]
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <EmptyState
        icon="folder-outline"
        title={t.playlists.empty}
        description={t.playlists.emptyDesc}
        actionLabel={t.playlists.create}
        onAction={() => setShowCreateModal(true)}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <Header
        title={t.playlists.title}
        rightAction={{
          icon: 'add',
          onPress: handleShowCreateModal,
        }}
      />

      {/* Pro Feature Banner (shown for non-Pro users) */}
      {!hasPlaylistAccess && (
        <TouchableOpacity
          style={[styles.proBanner, { backgroundColor: `${colors.accentPrimary}15` }]}
          onPress={() => setShowUpgradeModal(true)}
        >
          <View style={styles.proBannerContent}>
            <View style={[styles.proBadge, { backgroundColor: colors.accentPrimary }]}>
              <Ionicons name="star" size={14} color="#FFFFFF" />
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
            <Text style={[styles.proBannerText, { color: colors.textPrimary }]}>
              {language === 'fr'
                ? 'Analysez des playlists entières'
                : 'Analyze entire playlists'}
            </Text>
            <Text style={[styles.proBannerSubtext, { color: colors.textSecondary }]}>
              {language === 'fr'
                ? `Disponible à partir du plan ${minPlanInfo?.name.fr || 'Pro'}`
                : `Available from ${minPlanInfo?.name.en || 'Pro'} plan`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.accentPrimary} />
        </TouchableOpacity>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[
            styles.actionCard,
            { backgroundColor: colors.bgElevated },
            !hasPlaylistAccess && { opacity: 0.7 },
          ]}
          onPress={handleShowAnalyzeModal}
        >
          <View style={[styles.actionIcon, { backgroundColor: `${colors.accentPrimary}20` }]}>
            <Ionicons name="play-circle" size={24} color={colors.accentPrimary} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={[styles.actionTitle, { color: colors.textPrimary }]}>
              {t.playlists.analyzePlaylist}
            </Text>
            <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
              {t.playlists.enterPlaylistUrl}
            </Text>
          </View>
          {!hasPlaylistAccess ? (
            <View style={[styles.lockBadge, { backgroundColor: colors.accentWarning }]}>
              <Ionicons name="lock-closed" size={12} color="#FFFFFF" />
            </View>
          ) : (
            <Ionicons name="arrow-forward" size={20} color={colors.textTertiary} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionCard,
            { backgroundColor: colors.bgElevated },
            !hasPlaylistAccess && { opacity: 0.7 },
          ]}
          onPress={handleShowCreateModal}
        >
          <View style={[styles.actionIcon, { backgroundColor: `${colors.accentSuccess}20` }]}>
            <Ionicons name="add-circle" size={24} color={colors.accentSuccess} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={[styles.actionTitle, { color: colors.textPrimary }]}>
              {t.playlists.newPlaylist}
            </Text>
            <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
              {t.playlists.subtitle}
            </Text>
          </View>
          {!hasPlaylistAccess ? (
            <View style={[styles.lockBadge, { backgroundColor: colors.accentWarning }]}>
              <Ionicons name="lock-closed" size={12} color="#FFFFFF" />
            </View>
          ) : (
            <Ionicons name="arrow-forward" size={20} color={colors.textTertiary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Stats */}
      {playlists.length > 0 && (
        <View style={styles.statsContainer}>
          <View style={[styles.statItem, { backgroundColor: colors.bgElevated }]}>
            <Ionicons name="folder" size={20} color={colors.accentPrimary} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {playlists.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
              {t.playlists.title}
            </Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: colors.bgElevated }]}>
            <Ionicons name="videocam" size={20} color={colors.accentWarning} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {playlists.reduce((sum, p) => sum + p.videoCount, 0)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
              {t.playlists.videos}
            </Text>
          </View>
        </View>
      )}

      {/* Section Title */}
      {playlists.length > 0 && (
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {t.playlists.myPlaylists}
        </Text>
      )}

      {/* Playlist List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <DeepSightSpinner size="lg" showGlow />
        </View>
      ) : (
        <FlatList
          data={playlists}
          renderItem={renderPlaylistItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 80 },
            playlists.length === 0 && styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accentPrimary}
            />
          }
          ListEmptyComponent={renderEmpty}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Create Playlist Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowCreateModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: colors.bgSecondary }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {t.playlists.newPlaylist}
            </Text>

            <TextInput
              style={[styles.input, { backgroundColor: colors.bgElevated, color: colors.textPrimary }]}
              placeholder={t.playlists.playlistName}
              placeholderTextColor={colors.textMuted}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              autoFocus
            />

            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.bgElevated, color: colors.textPrimary }]}
              placeholder={t.playlists.playlistDescription}
              placeholderTextColor={colors.textMuted}
              value={newPlaylistDescription}
              onChangeText={setNewPlaylistDescription}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <Button
                title={t.common.cancel}
                variant="outline"
                onPress={() => setShowCreateModal(false)}
                style={styles.modalButton}
              />
              <Button
                title={t.common.create}
                onPress={handleCreatePlaylist}
                loading={isCreating}
                style={styles.modalButton}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Analyze Playlist Modal */}
      <Modal
        visible={showAnalyzeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAnalyzeModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowAnalyzeModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: colors.bgSecondary }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {t.playlists.analyzePlaylist}
            </Text>

            <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
              {t.playlists.pastePlaylistUrl}
            </Text>

            <TextInput
              style={[styles.input, { backgroundColor: colors.bgElevated, color: colors.textPrimary }]}
              placeholder="https://www.youtube.com/playlist?list=..."
              placeholderTextColor={colors.textMuted}
              value={playlistUrl}
              onChangeText={setPlaylistUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            <View style={styles.modalActions}>
              <Button
                title={t.common.cancel}
                variant="outline"
                onPress={() => setShowAnalyzeModal(false)}
                style={styles.modalButton}
              />
              <Button
                title={t.common.analyze}
                onPress={handleAnalyzePlaylist}
                loading={isAnalyzing}
                style={styles.modalButton}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Upgrade Modal */}
      <UpgradePromptModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        limitType="playlist"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  proBannerContent: {
    flex: 1,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 4,
    marginBottom: Spacing.xs,
  },
  proBadgeText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  proBannerText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  proBannerSubtext: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginTop: 2,
  },
  lockBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  actionSubtitle: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  statValue: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  statLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  separator: {
    height: Spacing.md,
  },
  playlistCard: {
    padding: Spacing.md,
  },
  playlistContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playlistThumbnails: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    height: '100%',
  },
  thumbnailImage: {
    width: '50%',
    height: '50%',
  },
  playlistInfo: {
    flex: 1,
    marginLeft: Spacing.md,
    marginRight: Spacing.sm,
  },
  playlistName: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.xs,
  },
  playlistDescription: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginBottom: Spacing.xs,
  },
  playlistMeta: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(150,150,150,0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: Spacing.md,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.md,
  },
  modalDescription: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginBottom: Spacing.lg,
    lineHeight: Typography.fontSize.sm * 1.5,
  },
  input: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    marginBottom: Spacing.md,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  modalButton: {
    flex: 1,
  },
});

export default PlaylistsScreen;
