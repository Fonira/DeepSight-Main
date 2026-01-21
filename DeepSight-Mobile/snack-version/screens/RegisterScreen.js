import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const colors = {
  bgPrimary: '#0a0a0b',
  bgElevated: '#1f1f23',
  textPrimary: '#FAFAF9',
  textSecondary: '#A1A1AA',
  textTertiary: '#71717A',
  accentPrimary: '#6366F1',
  border: '#27272A',
};

export default function RegisterScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.title}>Créer un compte</Text>
        <Text style={styles.subtitle}>
          Rejoignez Deep Sight et analysez vos vidéos avec l'IA
        </Text>

        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={20} color={colors.textTertiary} />
          <TextInput
            style={styles.input}
            placeholder="Nom d'utilisateur"
            placeholderTextColor={colors.textTertiary}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={20} color={colors.textTertiary} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} />
          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            placeholderTextColor={colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} />
          <TextInput
            style={styles.input}
            placeholder="Confirmer le mot de passe"
            placeholderTextColor={colors.textTertiary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity>
          <LinearGradient
            colors={['#6366F1', '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.registerButton}
          >
            <Text style={styles.registerButtonText}>S'inscrire</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.terms}>
          En vous inscrivant, vous acceptez nos{' '}
          <Text style={styles.link}>Conditions d'utilisation</Text> et notre{' '}
          <Text style={styles.link}>Politique de confidentialité</Text>
        </Text>

        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Déjà un compte ? </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.loginLink}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  backButton: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 32,
    lineHeight: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    paddingVertical: 16,
    marginLeft: 12,
  },
  registerButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  terms: {
    color: colors.textTertiary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 22,
  },
  link: {
    color: colors.accentPrimary,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  loginLink: {
    color: colors.accentPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
