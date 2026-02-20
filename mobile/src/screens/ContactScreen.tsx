/**
 * ContactScreen — Contact form + native email button for mobile.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Header } from '../components/Header';
import { sp, borderRadius } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';
import { contactApi } from '../services/api';

const CONTACT_EMAIL = 'maxime@deepsightsynthesis.com';

export const ContactScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const canSubmit = name.length >= 2 && email.includes('@') && subject.length >= 2 && message.length >= 10;

  const handleSubmit = async () => {
    if (!canSubmit || sending) return;
    setSending(true);
    try {
      await contactApi.submit({ name, email, subject, message });
      setSent(true);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err: any) {
      Alert.alert(
        'Erreur',
        err?.detail || err?.message || "Impossible d'envoyer le message. Réessayez plus tard.",
      );
    } finally {
      setSending(false);
    }
  };

  const openNativeEmail = () => {
    const url = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject || 'Contact DeepSight')}&body=${encodeURIComponent(message || '')}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Erreur', "Impossible d'ouvrir l'application email.");
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header
        title="Contact"
        showBack
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + sp['2xl'] }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.heroSection}>
            <View style={[styles.heroIcon, { backgroundColor: `${colors.accentPrimary}15` }]}>
              <Ionicons name="mail-outline" size={28} color={colors.accentPrimary} />
            </View>
            <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
              Contactez-nous
            </Text>
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
              Une question ou un problème ? Nous sommes là pour vous aider.
            </Text>
          </View>

          {sent ? (
            <View style={[styles.successCard, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
              <View style={[styles.successIcon, { backgroundColor: '#10b98120' }]}>
                <Ionicons name="checkmark-circle" size={32} color="#10b981" />
              </View>
              <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
                Message envoyé !
              </Text>
              <Text style={[styles.successText, { color: colors.textSecondary }]}>
                Nous vous répondrons sous 24 heures.
              </Text>
              <Pressable
                onPress={() => setSent(false)}
                style={[styles.againButton, { borderColor: colors.glassBorder }]}
              >
                <Text style={[styles.againButtonText, { color: colors.accentPrimary }]}>
                  Envoyer un autre message
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.formCard, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
              <Text style={[styles.formTitle, { color: colors.textPrimary }]}>
                Envoyer un message
              </Text>

              {/* Name */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Nom</Text>
                <View style={[styles.inputRow, { backgroundColor: `${colors.bgSecondary}`, borderColor: colors.glassBorder }]}>
                  <Ionicons name="person-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary }]}
                    value={name}
                    onChangeText={setName}
                    placeholder="Votre nom"
                    placeholderTextColor={colors.textTertiary}
                    maxLength={100}
                  />
                </View>
              </View>

              {/* Email */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
                <View style={[styles.inputRow, { backgroundColor: `${colors.bgSecondary}`, borderColor: colors.glassBorder }]}>
                  <Ionicons name="mail-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary }]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="votre@email.com"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Subject */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Sujet</Text>
                <View style={[styles.inputRow, { backgroundColor: `${colors.bgSecondary}`, borderColor: colors.glassBorder }]}>
                  <Ionicons name="chatbubble-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary }]}
                    value={subject}
                    onChangeText={setSubject}
                    placeholder="Sujet de votre message"
                    placeholderTextColor={colors.textTertiary}
                    maxLength={200}
                  />
                </View>
              </View>

              {/* Message */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Message</Text>
                <View style={[styles.textAreaRow, { backgroundColor: `${colors.bgSecondary}`, borderColor: colors.glassBorder }]}>
                  <TextInput
                    style={[styles.textArea, { color: colors.textPrimary }]}
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Décrivez votre demande..."
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                    maxLength={5000}
                  />
                </View>
              </View>

              {/* Submit Button */}
              <Pressable
                onPress={handleSubmit}
                disabled={!canSubmit || sending}
                style={[
                  styles.submitButton,
                  { backgroundColor: colors.accentPrimary, opacity: !canSubmit || sending ? 0.5 : 1 },
                ]}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#fff" />
                    <Text style={styles.submitText}>Envoyer</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* Native Email Button */}
          <Pressable
            onPress={openNativeEmail}
            style={[styles.emailButton, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
          >
            <Ionicons name="open-outline" size={20} color={colors.accentPrimary} />
            <View style={styles.emailButtonTextGroup}>
              <Text style={[styles.emailButtonTitle, { color: colors.textPrimary }]}>
                Ouvrir l'app email
              </Text>
              <Text style={[styles.emailButtonSub, { color: colors.textTertiary }]}>
                {CONTACT_EMAIL}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: sp.lg, paddingTop: sp.md },

  heroSection: { alignItems: 'center', marginBottom: sp.xl },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sp.md,
  },
  heroTitle: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize['2xl'],
    marginBottom: sp.xs,
  },
  heroSubtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: 'center',
    maxWidth: 280,
  },

  formCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: sp.lg,
    marginBottom: sp.lg,
  },
  formTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    marginBottom: sp.lg,
  },

  fieldGroup: { marginBottom: sp.md },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    marginBottom: sp.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: sp.sm,
  },
  inputIcon: { marginRight: sp.xs },
  input: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    paddingVertical: Platform.OS === 'ios' ? sp.sm : sp.xs,
  },
  textAreaRow: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: sp.sm,
  },
  textArea: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    minHeight: 120,
  },

  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.xs,
    paddingVertical: sp.sm + 2,
    borderRadius: borderRadius.md,
    marginTop: sp.sm,
  },
  submitText: {
    color: '#fff',
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },

  successCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: sp.xl,
    alignItems: 'center',
    marginBottom: sp.lg,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sp.md,
  },
  successTitle: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.lg,
    marginBottom: sp.xs,
  },
  successText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: sp.lg,
  },
  againButton: {
    paddingVertical: sp.xs,
    paddingHorizontal: sp.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  againButtonText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    padding: sp.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginBottom: sp.lg,
  },
  emailButtonTextGroup: { flex: 1 },
  emailButtonTitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
  emailButtonSub: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },
});

export default ContactScreen;
