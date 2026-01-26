import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Header, Card, Avatar, Button, Input } from '../components';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { userApi, authApi, ApiError } from '../services/api';

export const AccountScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user, refreshUser, logout, forgotPassword } = useAuth();
  const insets = useSafeAreaInsets();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');

  // Delete account modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    if (!username.trim()) {
      Alert.alert(t.common.error, t.common.required);
      return;
    }

    setIsSaving(true);
    try {
      await userApi.updateProfile({ username: username.trim() });
      await refreshUser();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t.success.generic, t.success.profileUpdated);
      setIsEditing(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t.errors.generic;
      Alert.alert(t.common.error, message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = () => {
    if (!user?.email) {
      Alert.alert(t.common.error, t.errors.generic);
      return;
    }

    Alert.alert(
      t.settings.changePassword,
      user.email,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.send,
          onPress: async () => {
            try {
              await forgotPassword(user.email);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(t.success.generic, t.notifications.analysisReady);
            } catch (err) {
              Alert.alert(t.common.error, t.errors.generic);
            }
          }
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    // Show confirmation alert first
    Alert.alert(
      t.settings.deleteAccount,
      t.settings.deleteAccountConfirm,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: () => {
            // Show password confirmation modal
            setDeletePassword('');
            setShowDeleteModal(true);
          },
        },
      ]
    );
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      // Call delete account API (password is optional for Google accounts)
      await authApi.deleteAccount(deletePassword || undefined);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowDeleteModal(false);

      // Log user out after successful deletion
      Alert.alert(
        t.success?.generic || 'Succès',
        'Votre compte a été supprimé.',
        [{ text: 'OK', onPress: () => logout() }]
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t.errors.generic;
      Alert.alert(t.common.error, message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <Header title={t.settings.account} showBack />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <Avatar uri={user?.avatar_url} name={user?.username} size="xl" />
          <TouchableOpacity
            style={[styles.changeAvatarButton, { backgroundColor: colors.accentPrimary }]}
            onPress={() => Alert.alert(t.settings.profilePicture, t.common.optional)}
          >
            <Ionicons name="camera" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Account Info */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {t.settings.accountInfo}
        </Text>
        <Card variant="elevated" style={styles.infoCard}>
          {isEditing ? (
            <>
              <Input
                label={t.settings.displayName}
                value={username}
                onChangeText={setUsername}
                leftIcon="person-outline"
              />
              <Input
                label={t.auth.email}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon="mail-outline"
                editable={false}
                hint={t.common.optional}
              />
              <View style={styles.editActions}>
                <Button
                  title={t.common.cancel}
                  variant="outline"
                  onPress={() => setIsEditing(false)}
                  style={styles.editButton}
                  disabled={isSaving}
                />
                <Button
                  title={isSaving ? t.common.saving : t.common.save}
                  onPress={handleSave}
                  style={styles.editButton}
                  disabled={isSaving}
                  loading={isSaving}
                />
              </View>
            </>
          ) : (
            <>
              <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
                <View style={styles.infoLabel}>
                  <Ionicons name="person-outline" size={20} color={colors.textTertiary} />
                  <Text style={[styles.infoLabelText, { color: colors.textSecondary }]}>
                    {t.settings.displayName}
                  </Text>
                </View>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                  {user?.username}
                </Text>
              </View>
              <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
                <View style={styles.infoLabel}>
                  <Ionicons name="mail-outline" size={20} color={colors.textTertiary} />
                  <Text style={[styles.infoLabelText, { color: colors.textSecondary }]}>
                    {t.auth.email}
                  </Text>
                </View>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                  {user?.email}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.infoLabel}>
                  <Ionicons name="calendar-outline" size={20} color={colors.textTertiary} />
                  <Text style={[styles.infoLabelText, { color: colors.textSecondary }]}>
                    {t.settings.memberSince}
                  </Text>
                </View>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR') : '-'}
                </Text>
              </View>
              <Button
                title={t.common.edit}
                variant="outline"
                onPress={() => setIsEditing(true)}
                style={styles.editInfoButton}
              />
            </>
          )}
        </Card>

        {/* Security */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {t.settings.security}
        </Text>
        <Card variant="elevated" style={styles.securityCard}>
          <TouchableOpacity
            style={[styles.securityItem, { borderBottomColor: colors.border }]}
            onPress={handleChangePassword}
          >
            <View style={styles.securityItemLeft}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.accentPrimary} />
              <Text style={[styles.securityItemText, { color: colors.textPrimary }]}>
                {t.settings.changePassword}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
          <View style={[styles.securityItem, { borderBottomWidth: 0 }]}>
            <View style={styles.securityItemLeft}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.accentSuccess} />
              <Text style={[styles.securityItemText, { color: colors.textPrimary }]}>
                {t.settings.emailVerified}
              </Text>
            </View>
            <Ionicons
              name={user?.email_verified ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={user?.email_verified ? colors.accentSuccess : colors.accentError}
            />
          </View>
        </Card>

        {/* Danger Zone */}
        <Text style={[styles.sectionTitle, { color: colors.accentError }]}>
          {t.settings.dangerZone}
        </Text>
        <Card variant="elevated" style={styles.dangerCard}>
          <TouchableOpacity
            style={styles.dangerItem}
            onPress={handleDeleteAccount}
          >
            <View style={styles.securityItemLeft}>
              <Ionicons name="trash-outline" size={20} color={colors.accentError} />
              <Text style={[styles.securityItemText, { color: colors.accentError }]}>
                {t.settings.deleteAccount}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.accentError} />
          </TouchableOpacity>
        </Card>
      </ScrollView>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.bgPrimary }]}>
            <View style={[styles.modalIconContainer, { backgroundColor: `${colors.accentError}15` }]}>
              <Ionicons name="warning" size={32} color={colors.accentError} />
            </View>

            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {t.settings.deleteAccount}
            </Text>

            <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
              Cette action est irréversible. Toutes vos données seront supprimées définitivement.
            </Text>

            <View style={styles.modalInputContainer}>
              <Text style={[styles.modalInputLabel, { color: colors.textSecondary }]}>
                Entrez votre mot de passe pour confirmer
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: colors.bgSecondary,
                    color: colors.textPrimary,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Mot de passe"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                value={deletePassword}
                onChangeText={setDeletePassword}
                editable={!isDeleting}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton, { borderColor: colors.border }]}
                onPress={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>
                  {t.common.cancel}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalDeleteButton, { backgroundColor: colors.accentError }]}
                onPress={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Ionicons name="hourglass" size={16} color="#FFFFFF" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                    {t.common.delete}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingTop: Spacing.md,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  changeAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: '35%',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  infoCard: {
    padding: Spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  infoLabelText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  infoValue: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  editInfoButton: {
    marginTop: Spacing.lg,
  },
  editActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  editButton: {
    flex: 1,
  },
  securityCard: {
    padding: 0,
  },
  securityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  securityItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  securityItemText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
  },
  dangerCard: {
    padding: 0,
  },
  dangerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  // Delete Account Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bodySemiBold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  modalDescription: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: Typography.fontSize.base * 1.5,
  },
  modalInputContainer: {
    width: '100%',
    marginBottom: Spacing.xl,
  },
  modalInputLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginBottom: Spacing.sm,
  },
  modalInput: {
    width: '100%',
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    borderWidth: 1,
  },
  modalDeleteButton: {},
  modalButtonText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
});

export default AccountScreen;
