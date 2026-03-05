/**
 * LegalScreen - Page des mentions légales, CGU et politique de confidentialité
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenDoodleVariant } from '../contexts/DoodleVariantContext';
import { Header } from '../components';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import type { RootStackParamList } from '../types';

type TabType = 'terms' | 'privacy' | 'legal' | 'about';
type LegalRouteProp = RouteProp<RootStackParamList, 'Legal'>;

export const LegalScreen: React.FC = () => {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const navigation = useNavigation();
  const route = useRoute<LegalRouteProp>();
  const insets = useSafeAreaInsets();
  useScreenDoodleVariant('academic');

  // Use route param if provided, default to 'terms'
  const initialTab = route.params?.type || 'terms';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab as TabType);

  // Update tab when route param changes
  useEffect(() => {
    if (route.params?.type) {
      setActiveTab(route.params.type as TabType);
    }
  }, [route.params?.type]);

  const tabs: { id: TabType; label: string }[] = [
    { id: 'about', label: language === 'fr' ? 'À propos' : 'About' },
    { id: 'terms', label: language === 'fr' ? 'CGU' : 'Terms' },
    { id: 'privacy', label: language === 'fr' ? 'Confidentialité' : 'Privacy' },
    { id: 'legal', label: language === 'fr' ? 'Mentions légales' : 'Legal' },
  ];

  const handleOpenWebsite = () => {
    Linking.openURL('https://deepsight.app/legal');
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@deepsight.app');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'about':
        return (
          <View style={styles.contentSection}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'À propos de DeepSight' : 'About DeepSight'}
            </Text>
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
              {language === 'fr'
                ? 'DeepSight est une application innovante d\'analyse de vidéos YouTube et TikTok propulsée par l\'intelligence artificielle.'
                : 'DeepSight is an innovative YouTube & TikTok video analysis application powered by artificial intelligence.'}
            </Text>

            <Text style={[styles.sectionSubtitle, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'Fonctionnalités principales' : 'Key Features'}
            </Text>
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
              {language === 'fr'
                ? '• Synthèse automatique de vidéos\n• Extraction de concepts clés\n• Chat avec l\'IA sur le contenu\n• Outils d\'étude (Flashcards, Quiz)\n• Export multi-format\n• Sources académiques'
                : '• Automatic video summaries\n• Key concept extraction\n• AI chat about content\n• Study tools (Flashcards, Quiz)\n• Multi-format export\n• Academic sources'}
            </Text>

            <Text style={[styles.sectionSubtitle, { color: colors.textPrimary }]}>
              FAQ
            </Text>
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
              {language === 'fr'
                ? '• Comment fonctionne DeepSight ?\nNous utilisons des modèles d\'IA avancés pour analyser le contenu des vidéos YouTube et TikTok.\n\n• Quelles vidéos sont supportées ?\nToutes les vidéos YouTube et TikTok publiques avec des sous-titres disponibles.\n\n• Mes données sont-elles sécurisées ?\nOui, nous utilisons un chiffrement de bout en bout et nous conformons au RGPD.'
                : '• How does DeepSight work?\nWe use advanced AI models to analyze YouTube & TikTok video content.\n\n• Which videos are supported?\nAll public YouTube and TikTok videos with available subtitles.\n\n• Is my data secure?\nYes, we use end-to-end encryption and comply with GDPR.'}
            </Text>

            <Text style={[styles.sectionSubtitle, { color: colors.textPrimary }]}>
              Contact
            </Text>
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
              {language === 'fr'
                ? 'Pour toute question ou assistance :\n\n📧 Email: support@deepsight.app\n🌐 Site web: https://deepsight.app'
                : 'For any questions or support:\n\n📧 Email: support@deepsight.app\n🌐 Website: https://deepsight.app'}
            </Text>

            <Text style={[styles.sectionSubtitle, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'Version' : 'Version'}
            </Text>
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
              DeepSight Mobile v1.0.0
            </Text>
          </View>
        );

      case 'terms':
        return (
          <View style={styles.contentSection}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'Conditions Générales d\'Utilisation' : 'Terms of Service'}
            </Text>
            <Text style={[styles.lastUpdated, { color: colors.textTertiary }]}>
              {language === 'fr' ? 'Dernière mise à jour : Janvier 2025' : 'Last updated: January 2025'}
            </Text>

            <Text style={[styles.sectionSubtitle, { color: colors.textPrimary }]}>
              1. {language === 'fr' ? 'Acceptation des conditions' : 'Acceptance of Terms'}
            </Text>
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
              {language === 'fr'
                ? 'En utilisant DeepSight, vous acceptez d\'être lié par ces conditions d\'utilisation. Si vous n\'acceptez pas ces conditions, veuillez ne pas utiliser notre service.'
                : 'By using DeepSight, you agree to be bound by these terms of service. If you do not agree to these terms, please do not use our service.'}
            </Text>

            <Text style={[styles.sectionSubtitle, { color: colors.textPrimary }]}>
              2. {language === 'fr' ? 'Description du service' : 'Service Description'}
            </Text>
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
              {language === 'fr'
                ? 'DeepSight est une plateforme d\'analyse de contenu vidéo utilisant l\'intelligence artificielle pour fournir des résumés, des concepts clés, et des outils d\'étude.'
                : 'DeepSight is a video content analysis platform using artificial intelligence to provide summaries, key concepts, and study tools.'}
            </Text>

            <Text style={[styles.sectionSubtitle, { color: colors.textPrimary }]}>
              3. {language === 'fr' ? 'Utilisation acceptable' : 'Acceptable Use'}
            </Text>
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
              {language === 'fr'
                ? 'Vous vous engagez à utiliser DeepSight uniquement à des fins légales et conformément à toutes les lois applicables. L\'utilisation abusive ou frauduleuse est strictement interdite.'
                : 'You agree to use DeepSight only for lawful purposes and in accordance with all applicable laws. Abusive or fraudulent use is strictly prohibited.'}
            </Text>

            <Text style={[styles.sectionSubtitle, { color: colors.textPrimary }]}>
              4. {language === 'fr' ? 'Propriété intellectuelle' : 'Intellectual Property'}
            </Text>
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
              {language === 'fr'
                ? 'Le contenu généré par DeepSight est fourni à titre informatif. Vous êtes responsable de vérifier les informations et de respecter les droits d\'auteur des vidéos analysées.'
                : 'Content generated by DeepSight is provided for informational purposes. You are responsible for verifying information and respecting the copyrights of analyzed videos.'}
            </Text>

            <Text style={[styles.sectionSubtitle, { color: colors.textPrimary }]}>
              5. {language === 'fr' ? 'Limitation de responsabilité' : 'Limitation of Liability'}
            </Text>
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
              {language === 'fr'
                ? 'DeepSight ne garantit pas l\'exactitude des analyses générées par IA. Le service est fourni "tel quel" sans garantie d\'aucune sorte.'
                : 'DeepSight does not guarantee the accuracy of AI-generated analyses. The service is provided "as is" without warranty of any kind.'}
            </Text>
          </View>
        );

      case 'privacy':
        return (
          <View style={styles.contentSection}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'Politique de Confidentialité' : 'Privacy Policy'}
            </Text>
            <Text style={[styles.lastUpdated, { color: colors.textTertiary }]}>
              {language === 'fr' ? 'Dernière mise à jour : Janvier 2025' : 'Last updated: January 2025'}
            </Text>

            <Text style={[styles.sectionSubtitle, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'Données collectées' : 'Data Collected'}
            </Text>
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
              {language === 'fr'
                ? '• Informations de compte (email, nom d\'utilisateur)\n• Historique des analyses\n• Données d\'utilisation anonymisées'
                : '• Account information (email, username)\n• Analysis history\n• Anonymized usage data'}
            </Text>

            <Text style={[styles.sectionSubtitle, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'Utilisation des données' : 'Use of Data'}
            </Text>
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
              {language === 'fr'
                ? 'Vos données sont utilisées pour fournir et améliorer nos services. Nous ne vendons jamais vos données personnelles à des tiers.'
                : 'Your data is used to provide and improve our services. We never sell your personal data to third parties.'}
            </Text>

            <Text style={[styles.sectionSubtitle, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'Stockage et sécurité' : 'Storage and Security'}
            </Text>
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
              {language === 'fr'
                ? 'Vos données sont stockées de manière sécurisée sur des serveurs européens conformes au RGPD. Nous utilisons le chiffrement pour protéger vos informations.'
                : 'Your data is securely stored on GDPR-compliant European servers. We use encryption to protect your information.'}
            </Text>

            <Text style={[styles.sectionSubtitle, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'Vos droits' : 'Your Rights'}
            </Text>
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
              {language === 'fr'
                ? 'Vous avez le droit d\'accéder, modifier ou supprimer vos données personnelles. Contactez-nous pour exercer ces droits.'
                : 'You have the right to access, modify, or delete your personal data. Contact us to exercise these rights.'}
            </Text>

            <Text style={[styles.sectionSubtitle, { color: colors.textPrimary }]}>
              Cookies
            </Text>
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
              {language === 'fr'
                ? 'Nous utilisons des cookies essentiels pour le fonctionnement du service. Aucun cookie publicitaire n\'est utilisé.'
                : 'We use essential cookies for service operation. No advertising cookies are used.'}
            </Text>
          </View>
        );

      case 'legal':
        return (
          <View style={styles.contentSection}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'Mentions Légales' : 'Legal Notice'}
            </Text>

            <Text style={[styles.sectionSubtitle, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'Éditeur' : 'Publisher'}
            </Text>
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
              DeepSight{'\n'}
              {language === 'fr' ? 'Application d\'analyse vidéo IA' : 'AI Video Analysis Application'}
            </Text>

            <Text style={[styles.sectionSubtitle, { color: colors.textPrimary }]}>
              Contact
            </Text>
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
              Email: support@deepsight.app{'\n'}
              Web: https://deepsight.app
            </Text>

            <Text style={[styles.sectionSubtitle, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'Hébergement' : 'Hosting'}
            </Text>
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
              {language === 'fr'
                ? 'Nos services sont hébergés dans l\'Union Européenne conformément au RGPD.'
                : 'Our services are hosted in the European Union in compliance with GDPR.'}
            </Text>

            <Text style={[styles.sectionSubtitle, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'Propriété intellectuelle' : 'Intellectual Property'}
            </Text>
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
              {language === 'fr'
                ? 'DeepSight et son logo sont des marques déposées. Tous droits réservés.'
                : 'DeepSight and its logo are registered trademarks. All rights reserved.'}
            </Text>

            <Text style={[styles.sectionSubtitle, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'Droit applicable' : 'Applicable Law'}
            </Text>
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
              {language === 'fr'
                ? 'Ces conditions sont régies par le droit français. Tout litige sera soumis aux tribunaux compétents.'
                : 'These terms are governed by French law. Any dispute will be submitted to the competent courts.'}
            </Text>
          </View>
        );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <Header
        title={language === 'fr' ? 'Informations légales' : 'Legal Information'}
        showBack
      />

      {/* Tabs */}
      <View style={[styles.tabsContainer, { borderBottomColor: colors.border }]}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && { borderBottomColor: colors.accentPrimary },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab(tab.id);
            }}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === tab.id ? colors.accentPrimary : colors.textTertiary },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xxl }]}
      >
        {renderContent()}

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.bgElevated }]}
            onPress={handleOpenWebsite}
          >
            <Ionicons name="globe-outline" size={20} color={colors.accentPrimary} />
            <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'Voir sur le site web' : 'View on website'}
            </Text>
            <Ionicons name="open-outline" size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.bgElevated }]}
            onPress={handleContactSupport}
          >
            <Ionicons name="mail-outline" size={20} color={colors.accentPrimary} />
            <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'Contacter le support' : 'Contact support'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  contentSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.xs,
  },
  lastUpdated: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginBottom: Spacing.lg,
  },
  sectionSubtitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  paragraph: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.sm * 1.6,
  },
  actionsContainer: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  actionButtonText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
});

export default LegalScreen;
