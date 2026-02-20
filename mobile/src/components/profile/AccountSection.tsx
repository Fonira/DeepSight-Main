import React, { useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { userApi, authApi, ApiError } from '@/services/api';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { sp, borderRadius } from '@/theme/spacing';
import { fontFamily, fontSize } from '@/theme/typography';

export const AccountSection: React.FC = () => {
  const { colors } = useTheme();
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();

  // Sheet state
  const [activeSheet, setActiveSheet] = useState<'profile' | 'password' | 'delete' | null>(null);
  const sheetRef = useRef<BottomSheet>(null);

  // Profile edit
  const [editUsername, setEditUsername] = useState(user?.username ?? '');
  const [editEmail, setEditEmail] = useState(user?.email ?? '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Password change
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Delete account
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const snapPoints = useMemo(() => ['65%'], []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    [],
  );

  const openSheet = (type: 'profile' | 'password' | 'delete') => {
    setActiveSheet(type);
    // Reset states
    if (type === 'profile') {
      setEditUsername(user?.username ?? '');
      setEditEmail(user?.email ?? '');
      setProfileError('');
    } else if (type === 'password') {
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
    } else {
      setDeletePassword('');
    }
    sheetRef.current?.snapToIndex(0);
  };

  const handleSaveProfile = async () => {
    if (!editUsername.trim()) {
      setProfileError('Le nom d\'utilisateur est requis');
      return;
    }
    setProfileLoading(true);
    setProfileError('');
    try {
      await userApi.updateProfile({ username: editUsername.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshUser();
      sheetRef.current?.close();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Erreur lors de la mise à jour';
      setProfileError(message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError('Tous les champs sont requis');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Le mot de passe doit faire au moins 8 caractères');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }
    setPasswordLoading(true);
    setPasswordError('');
    try {
      await userApi.changePassword(oldPassword, newPassword);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Succès', 'Mot de passe modifié avec succès.');
      sheetRef.current?.close();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Erreur lors du changement';
      setPasswordError(message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer le compte',
      'Es-tu sûr ? Cette action est irréversible. Toutes tes données seront supprimées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Continuer',
          style: 'destructive',
          onPress: () => openSheet('delete'),
        },
      ],
    );
  };

  const handleConfirmDelete = async () => {
    if (!deletePassword) {
      Alert.alert('Erreur', 'Le mot de passe est requis pour confirmer.');
      return;
    }
    setDeleteLoading(true);
    try {
      await authApi.deleteAccount(deletePassword);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sheetRef.current?.close();
      await logout();
      router.replace('/(auth)');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Erreur lors de la suppression';
      Alert.alert('Erreur', message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const renderRow = (
    label: string,
    onPress: () => void,
    options?: { danger?: boolean; icon?: keyof typeof Ionicons.glyphMap },
  ) => (
    <Pressable
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text
        style={[
          styles.rowLabel,
          { color: options?.danger ? colors.accentError : colors.textPrimary },
        ]}
      >
        {label}
      </Text>
      <Ionicons
        name={options?.icon ?? 'chevron-forward'}
        size={18}
        color={options?.danger ? colors.accentError : colors.textMuted}
      />
    </Pressable>
  );

  const inputStyle = [
    styles.sheetInput,
    {
      backgroundColor: colors.bgElevated,
      borderColor: colors.border,
      color: colors.textPrimary,
    },
  ];

  return (
    <>
      <GlassCard style={styles.container}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          Compte
        </Text>

        {renderRow('Modifier le profil', () => openSheet('profile'))}
        {renderRow('Changer le mot de passe', () => openSheet('password'), { icon: 'lock-closed-outline' })}
        {renderRow('Conditions d\'utilisation', () =>
          Linking.openURL('https://www.deepsightsynthesis.com/legal'),
        { icon: 'document-text-outline' })}
        {renderRow('Nous contacter', () =>
          Linking.openURL('mailto:contact@deepsightsynthesis.com'),
        { icon: 'mail-outline' })}

        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        {renderRow('Supprimer mon compte', handleDeleteAccount, {
          danger: true,
          icon: 'trash-outline',
        })}
      </GlassCard>

      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.bgSecondary }}
        handleIndicatorStyle={{ backgroundColor: colors.textMuted }}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        <BottomSheetView style={styles.sheetContent}>
          {/* Modifier le profil */}
          {activeSheet === 'profile' && (
            <>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                Modifier le profil
              </Text>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Nom d'utilisateur
              </Text>
              <BottomSheetTextInput
                style={inputStyle}
                value={editUsername}
                onChangeText={setEditUsername}
                placeholder="Nom d'utilisateur"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Email
              </Text>
              <BottomSheetTextInput
                style={[inputStyle, { opacity: 0.6 }]}
                value={editEmail}
                editable={false}
                placeholderTextColor={colors.textMuted}
              />
              <Text style={[styles.hintText, { color: colors.textTertiary }]}>
                L'email ne peut pas être modifié pour le moment.
              </Text>
              {profileError ? (
                <Text style={[styles.errorText, { color: colors.accentError }]}>
                  {profileError}
                </Text>
              ) : null}
              <Button
                title="Sauvegarder"
                onPress={handleSaveProfile}
                loading={profileLoading}
                fullWidth
                style={styles.sheetButton}
              />
            </>
          )}

          {/* Changer le mot de passe */}
          {activeSheet === 'password' && (
            <>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                Changer le mot de passe
              </Text>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Mot de passe actuel
              </Text>
              <BottomSheetTextInput
                style={inputStyle}
                value={oldPassword}
                onChangeText={setOldPassword}
                placeholder="Mot de passe actuel"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
              />
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Nouveau mot de passe
              </Text>
              <BottomSheetTextInput
                style={inputStyle}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Minimum 8 caractères"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
              />
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Confirmer le mot de passe
              </Text>
              <BottomSheetTextInput
                style={inputStyle}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirmer le nouveau mot de passe"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
              />
              {passwordError ? (
                <Text style={[styles.errorText, { color: colors.accentError }]}>
                  {passwordError}
                </Text>
              ) : null}
              <Button
                title="Modifier le mot de passe"
                onPress={handleChangePassword}
                loading={passwordLoading}
                fullWidth
                style={styles.sheetButton}
              />
            </>
          )}

          {/* Confirmation suppression */}
          {activeSheet === 'delete' && (
            <>
              <Text style={[styles.sheetTitle, { color: colors.accentError }]}>
                Supprimer le compte
              </Text>
              <Text style={[styles.deleteWarning, { color: colors.textSecondary }]}>
                Confirme en saisissant ton mot de passe. Cette action est irréversible.
              </Text>
              <BottomSheetTextInput
                style={inputStyle}
                value={deletePassword}
                onChangeText={setDeletePassword}
                placeholder="Ton mot de passe"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
              />
              <Button
                title="Supprimer définitivement"
                variant="danger"
                onPress={handleConfirmDelete}
                loading={deleteLoading}
                fullWidth
                style={styles.sheetButton}
              />
            </>
          )}
        </BottomSheetView>
      </BottomSheet>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: sp.lg,
  },
  sectionTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    marginBottom: sp.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sp.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: sp.sm,
  },
  sheetContent: {
    paddingHorizontal: sp.xl,
    paddingBottom: sp['3xl'],
  },
  sheetTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    marginBottom: sp.lg,
    textAlign: 'center',
  },
  inputLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    marginBottom: sp.xs,
  },
  sheetInput: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingVertical: sp.md,
    paddingHorizontal: sp.lg,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    marginBottom: sp.md,
  },
  hintText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginBottom: sp.md,
    marginTop: -sp.sm,
  },
  errorText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginBottom: sp.md,
  },
  deleteWarning: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginBottom: sp.lg,
    textAlign: 'center',
  },
  sheetButton: {
    marginTop: sp.sm,
  },
});

export default AccountSection;
