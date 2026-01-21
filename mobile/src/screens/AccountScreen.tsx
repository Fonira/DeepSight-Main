import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Header, Card, Avatar, Button, Input } from '../components';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

export const AccountScreen: React.FC = () => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Succès', 'Vos informations ont été mises à jour.');
    setIsEditing(false);
  };

  const handleChangePassword = () => {
    Alert.alert(
      'Changer le mot de passe',
      'Un email vous sera envoyé pour réinitialiser votre mot de passe.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Envoyer', onPress: () => Alert.alert('Email envoyé', 'Vérifiez votre boîte mail.') },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer le compte',
      'Cette action est irréversible. Toutes vos données seront supprimées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => Alert.alert('Compte supprimé', 'Votre compte a été supprimé.'),
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <Header title="Mon compte" showBack />

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
            onPress={() => Alert.alert('Changer la photo', 'Cette fonctionnalité sera disponible prochainement.')}
          >
            <Ionicons name="camera" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Account Info */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Informations
        </Text>
        <Card variant="elevated" style={styles.infoCard}>
          {isEditing ? (
            <>
              <Input
                label="Nom d'utilisateur"
                value={username}
                onChangeText={setUsername}
                leftIcon="person-outline"
              />
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon="mail-outline"
              />
              <View style={styles.editActions}>
                <Button
                  title="Annuler"
                  variant="outline"
                  onPress={() => setIsEditing(false)}
                  style={styles.editButton}
                />
                <Button
                  title="Enregistrer"
                  onPress={handleSave}
                  style={styles.editButton}
                />
              </View>
            </>
          ) : (
            <>
              <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
                <View style={styles.infoLabel}>
                  <Ionicons name="person-outline" size={20} color={colors.textTertiary} />
                  <Text style={[styles.infoLabelText, { color: colors.textSecondary }]}>
                    Nom d'utilisateur
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
                    Email
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
                    Membre depuis
                  </Text>
                </View>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR') : '-'}
                </Text>
              </View>
              <Button
                title="Modifier"
                variant="outline"
                onPress={() => setIsEditing(true)}
                style={styles.editInfoButton}
              />
            </>
          )}
        </Card>

        {/* Security */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Sécurité
        </Text>
        <Card variant="elevated" style={styles.securityCard}>
          <TouchableOpacity
            style={[styles.securityItem, { borderBottomColor: colors.border }]}
            onPress={handleChangePassword}
          >
            <View style={styles.securityItemLeft}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.accentPrimary} />
              <Text style={[styles.securityItemText, { color: colors.textPrimary }]}>
                Changer le mot de passe
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
          <View style={[styles.securityItem, { borderBottomWidth: 0 }]}>
            <View style={styles.securityItemLeft}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.accentSuccess} />
              <Text style={[styles.securityItemText, { color: colors.textPrimary }]}>
                Email vérifié
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
          Zone de danger
        </Text>
        <Card variant="elevated" style={styles.dangerCard}>
          <TouchableOpacity
            style={styles.dangerItem}
            onPress={handleDeleteAccount}
          >
            <View style={styles.securityItemLeft}>
              <Ionicons name="trash-outline" size={20} color={colors.accentError} />
              <Text style={[styles.securityItemText, { color: colors.accentError }]}>
                Supprimer mon compte
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.accentError} />
          </TouchableOpacity>
        </Card>
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
});

export default AccountScreen;
