import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { playlistApi } from '../services/api';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import type { Playlist } from '../types';

interface AddToPlaylistModalProps {
  visible: boolean;
  onClose: () => void;
  summaryId: string;
  onSuccess?: (playlistName: string) => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  visible,
  onClose,
  summaryId,
  onSuccess,
}) => {
  const { colors } = useTheme();
  const { t, language } = useLanguage();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addingToId, setAddingToId] = useState<string | null>(null);

  // Create new playlist inline
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const loadPlaylists = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await playlistApi.getPlaylists();
      setPlaylists(response.playlists || []);
    } catch {
      // Silently fail - user will see empty list
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadPlaylists();
      setShowCreate(false);
      setNewName('');
    }
  }, [visible, loadPlaylists]);

  const handleAddToPlaylist = async (playlist: Playlist) => {
    setAddingToId(playlist.id);
    try {
      await playlistApi.addVideoToPlaylist(playlist.id, summaryId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess?.(playlist.name);
      onClose();
    } catch (err: any) {
      const message = err?.detail || err?.message ||
        (language === 'fr' ? 'Impossible d\'ajouter la vidéo' : 'Unable to add video');
      Alert.alert(t.common.error, message);
    } finally {
      setAddingToId(null);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newName.trim()) return;

    setIsCreating(true);
    try {
      const newPlaylist = await playlistApi.createPlaylist(newName.trim());
      const playlistId = (newPlaylist as any).playlist_id || newPlaylist.id;
      await playlistApi.addVideoToPlaylist(playlistId, summaryId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess?.(newName.trim());
      onClose();
    } catch (err: any) {
      const message = err?.detail || err?.message || t.errors.generic;
      Alert.alert(t.common.error, message);
    } finally {
      setIsCreating(false);
    }
  };

  const renderPlaylistItem = ({ item }: { item: Playlist }) => {
    const isAdding = addingToId === item.id;

    return (
      <TouchableOpacity
        style={[styles.playlistItem, { backgroundColor: colors.bgElevated }]}
        onPress={() => handleAddToPlaylist(item)}
        disabled={isAdding || addingToId !== null}
        activeOpacity={0.7}
      >
        <View style={[styles.playlistIcon, { backgroundColor: `${colors.accentPrimary}20` }]}>
          <Ionicons name="folder" size={20} color={colors.accentPrimary} />
        </View>
        <View style={styles.playlistInfo}>
          <Text style={[styles.playlistName, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.playlistCount, { color: colors.textTertiary }]}>
            {item.videoCount} {language === 'fr' ? 'vidéos' : 'videos'}
          </Text>
        </View>
        {isAdding ? (
          <ActivityIndicator size="small" color={colors.accentPrimary} />
        ) : (
          <Ionicons name="add-circle-outline" size={24} color={colors.accentPrimary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => { Keyboard.dismiss(); onClose(); }}
        />
        <View style={[styles.modalContent, { backgroundColor: colors.bgSecondary }]}>
          <View style={styles.modalHandle} />

          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'Ajouter à une playlist' : 'Add to playlist'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Loading */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accentPrimary} />
            </View>
          ) : (
            <>
              {/* Playlist List */}
              <FlatList
                data={playlists}
                renderItem={renderPlaylistItem}
                keyExtractor={(item) => item.id}
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="folder-outline" size={40} color={colors.textTertiary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      {language === 'fr' ? 'Aucune playlist' : 'No playlists'}
                    </Text>
                  </View>
                }
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                style={styles.list}
              />

              {/* Create new playlist inline */}
              {showCreate ? (
                <View style={styles.createContainer}>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.bgElevated, color: colors.textPrimary }]}
                    placeholder={language === 'fr' ? 'Nom de la playlist' : 'Playlist name'}
                    placeholderTextColor={colors.textMuted}
                    value={newName}
                    onChangeText={setNewName}
                    autoFocus
                    onSubmitEditing={handleCreateAndAdd}
                    returnKeyType="done"
                  />
                  <View style={styles.createActions}>
                    <TouchableOpacity
                      style={[styles.createCancelButton, { borderColor: colors.border }]}
                      onPress={() => {
                        setShowCreate(false);
                        setNewName('');
                      }}
                    >
                      <Text style={[styles.createCancelText, { color: colors.textSecondary }]}>
                        {t.common.cancel}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.createConfirmButton, { backgroundColor: colors.accentPrimary }]}
                      onPress={handleCreateAndAdd}
                      disabled={isCreating || !newName.trim()}
                    >
                      {isCreating ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.createConfirmText}>
                          {language === 'fr' ? 'Créer et ajouter' : 'Create & add'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.newPlaylistButton, { borderColor: colors.border }]}
                  onPress={() => setShowCreate(true)}
                >
                  <Ionicons name="add" size={20} color={colors.accentPrimary} />
                  <Text style={[styles.newPlaylistText, { color: colors.accentPrimary }]}>
                    {language === 'fr' ? 'Nouvelle playlist' : 'New playlist'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
    maxHeight: '70%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(150,150,150,0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  list: {
    maxHeight: 300,
  },
  listContent: {
    paddingVertical: Spacing.sm,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  playlistIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  playlistCount: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: 2,
  },
  separator: {
    height: Spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.sm,
  },
  newPlaylistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: Spacing.sm,
  },
  newPlaylistText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  createContainer: {
    marginTop: Spacing.md,
  },
  input: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
  },
  createActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  createCancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  createCancelText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  createConfirmButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  createConfirmText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
    color: '#FFFFFF',
  },
});

export default AddToPlaylistModal;
