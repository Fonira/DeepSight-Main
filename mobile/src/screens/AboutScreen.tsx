/**
 * AboutScreen — Credits, partners, open-source, vision
 * Mobile equivalent of frontend/src/pages/AboutPage.tsx
 */

import React from 'react';
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
import Constants from 'expo-constants';
import { useTheme } from '../contexts/ThemeContext';
import { useScreenDoodleVariant } from '../contexts/DoodleVariantContext';
import { Header } from '../components';
import { sp, borderRadius } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';

// ═══════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════

interface Partner {
  name: string;
  role: string;
  url: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const TECH_PARTNERS: Partner[] = [
  { name: 'Mistral AI', role: "Moteur d'analyse", url: 'https://mistral.ai', icon: 'hardware-chip-outline' },
  { name: 'Perplexity AI', role: 'Fact-checking', url: 'https://perplexity.ai', icon: 'search-outline' },
  { name: 'Brave Search', role: 'Recherche complémentaire', url: 'https://search.brave.com', icon: 'globe-outline' },
  { name: 'Tournesol', role: 'Recommandations communautaires', url: 'https://tournesol.app', icon: 'people-outline' },
];

const INFRA_PARTNERS: Partner[] = [
  { name: 'Vercel', role: 'Frontend hosting', url: 'https://vercel.com', icon: 'globe-outline' },
  { name: 'Railway', role: 'Backend hosting', url: 'https://railway.app', icon: 'server-outline' },
  { name: 'Cloudflare', role: 'CDN & storage', url: 'https://cloudflare.com', icon: 'shield-checkmark-outline' },
  { name: 'Stripe', role: 'Paiements', url: 'https://stripe.com', icon: 'card-outline' },
];

interface LibRow {
  name: string;
  license: string;
  url: string;
}

const OPEN_SOURCE_LIBS: LibRow[] = [
  { name: 'React Native / Expo', license: 'MIT', url: 'https://expo.dev' },
  { name: 'React', license: 'MIT', url: 'https://react.dev' },
  { name: 'FastAPI', license: 'MIT', url: 'https://fastapi.tiangolo.com' },
  { name: 'PostgreSQL', license: 'PostgreSQL License', url: 'https://www.postgresql.org' },
  { name: 'Tailwind CSS', license: 'MIT', url: 'https://tailwindcss.com' },
  { name: 'Lucide Icons', license: 'ISC', url: 'https://lucide.dev' },
];

interface Acknowledgement {
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const ACKNOWLEDGEMENTS: Acknowledgement[] = [
  { name: 'Communauté Tournesol', description: 'Pour leur plateforme de recommandations collaboratives et éthiques', icon: 'flower-outline' },
  { name: 'Mistral AI', description: "Pour leur IA performante et souveraine, moteur de toutes nos analyses", icon: 'hardware-chip-outline' },
  { name: 'Communauté open-source', description: 'Pour les outils extraordinaires sur lesquels DeepSight est construit', icon: 'code-slash-outline' },
  { name: 'Bêta-testeurs DeepSight', description: 'Pour leurs retours précieux qui façonnent le produit chaque jour', icon: 'heart-outline' },
  { name: 'Claude (Anthropic)', description: "Pour l'assistance au développement et l'accélération du projet", icon: 'sparkles-outline' },
];

// ═══════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════

const PartnerCard: React.FC<Partner & { colors: any }> = ({ name, role, url, icon, colors }) => (
  <TouchableOpacity
    style={[styles.partnerCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
    onPress={() => Linking.openURL(url)}
    activeOpacity={0.7}
  >
    <View style={[styles.partnerIcon, { backgroundColor: `${colors.accentPrimary}15` }]}>
      <Ionicons name={icon} size={20} color={colors.accentPrimary} />
    </View>
    <View style={styles.partnerInfo}>
      <Text style={[styles.partnerName, { color: colors.textPrimary }]}>{name}</Text>
      <Text style={[styles.partnerRole, { color: colors.textMuted }]}>{role}</Text>
    </View>
    <Ionicons name="open-outline" size={14} color={colors.textMuted} />
  </TouchableOpacity>
);

// ═══════════════════════════════════════════════════════════════════
// SCREEN
// ═══════════════════════════════════════════════════════════════════

export const AboutScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  useScreenDoodleVariant('academic');

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <Header title="À propos" showBack />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + sp['2xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <View style={[styles.badge, { backgroundColor: `${colors.accentPrimary}15` }]}>
            <Text style={[styles.badgeText, { color: colors.accentPrimary }]}>À propos</Text>
          </View>
          <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>DeepSight</Text>
          <Text style={[styles.heroTagline, { color: colors.textSecondary }]}>
            Analyser, comprendre, apprendre autrement
          </Text>
          <Text style={[styles.heroVersion, { color: colors.textMuted }]}>
            Version {appVersion}
          </Text>
        </View>

        {/* Vision */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Vision du projet</Text>
          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
              DeepSight est né d'un constat simple : nous consommons des heures de contenu vidéo
              chaque jour, mais nous n'en retenons qu'une infime partie. Notre mission est de
              transformer cette consommation passive en apprentissage actif.
            </Text>
            <Text style={[styles.paragraph, { color: colors.textSecondary, marginTop: sp.md }]}>
              Grâce à l'intelligence artificielle 100% française et européenne, DeepSight
              extrait, structure et enrichit le contenu des vidéos pour vous permettre
              d'analyser, réviser et approfondir vos connaissances — sur web, mobile et
              extension Chrome.
            </Text>
          </View>
        </View>

        {/* Partenaires Technologiques */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Partenaires Technologiques</Text>
          <View style={styles.partnersGrid}>
            {TECH_PARTNERS.map((p) => (
              <PartnerCard key={p.name} {...p} colors={colors} />
            ))}
          </View>
        </View>

        {/* Infrastructure */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Infrastructure</Text>
          <View style={styles.partnersGrid}>
            {INFRA_PARTNERS.map((p) => (
              <PartnerCard key={p.name} {...p} colors={colors} />
            ))}
          </View>
        </View>

        {/* Open Source */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Bibliothèques Open Source</Text>
          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, padding: 0, overflow: 'hidden' }]}>
            {/* Table header */}
            <View style={[styles.tableHeader, { backgroundColor: colors.bgSecondary }]}>
              <Text style={[styles.tableHeaderText, { color: colors.textMuted, flex: 1 }]}>Bibliothèque</Text>
              <Text style={[styles.tableHeaderText, { color: colors.textMuted }]}>Licence</Text>
            </View>
            {OPEN_SOURCE_LIBS.map((lib, i) => (
              <TouchableOpacity
                key={lib.name}
                style={[
                  styles.tableRow,
                  i < OPEN_SOURCE_LIBS.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                ]}
                onPress={() => Linking.openURL(lib.url)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tableCell, { color: colors.textPrimary, flex: 1 }]}>{lib.name}</Text>
                <View style={styles.tableRowRight}>
                  <Text style={[styles.tableCellMuted, { color: colors.textMuted }]}>{lib.license}</Text>
                  <Ionicons name="open-outline" size={12} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Remerciements */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Remerciements</Text>
          <View style={styles.acknowledgementsContainer}>
            {ACKNOWLEDGEMENTS.map((a) => (
              <View
                key={a.name}
                style={[styles.ackCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              >
                <View style={[styles.ackIcon, { backgroundColor: `${colors.accentPrimary}15` }]}>
                  <Ionicons name={a.icon} size={18} color={colors.accentPrimary} />
                </View>
                <View style={styles.ackInfo}>
                  <Text style={[styles.ackName, { color: colors.textPrimary }]}>{a.name}</Text>
                  <Text style={[styles.ackDesc, { color: colors.textMuted }]}>{a.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Créé par */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Créé par</Text>
          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.creatorHeader}>
              <View style={[styles.creatorAvatar, { backgroundColor: `${colors.accentPrimary}15` }]}>
                <Ionicons name="person-outline" size={28} color={colors.accentPrimary} />
              </View>
              <View style={styles.creatorInfo}>
                <Text style={[styles.creatorName, { color: colors.textPrimary }]}>Maxime Le Parc</Text>
                <Text style={[styles.creatorRole, { color: colors.accentPrimary }]}>Fondateur & Développeur</Text>
              </View>
            </View>

            <View style={styles.creatorDetails}>
              <View style={styles.creatorDetail}>
                <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.creatorDetailText, { color: colors.textSecondary }]}>Lyon, France</Text>
              </View>
              <TouchableOpacity
                style={styles.creatorDetail}
                onPress={() => Linking.openURL('mailto:maxime@deepsightsynthesis.com')}
                activeOpacity={0.7}
              >
                <Ionicons name="mail-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.creatorDetailText, { color: colors.accentPrimary }]}>
                  maxime@deepsightsynthesis.com
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Footer legal */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            RCS 994 558 898 R.C.S. Lyon
          </Text>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            © {new Date().getFullYear()} DeepSight — Tous droits réservés
          </Text>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Propulsé par Mistral AI · Fait avec ♥ à Lyon
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: sp.lg,
    paddingTop: sp.md,
  },

  // Header
  headerSection: {
    alignItems: 'center',
    marginBottom: sp.xl,
    gap: sp.sm,
  },
  badge: {
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bodySemiBold,
  },
  heroTitle: {
    fontSize: 36,
    fontFamily: fontFamily.bodySemiBold,
    letterSpacing: -0.5,
  },
  heroTagline: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.body,
    textAlign: 'center',
    lineHeight: fontSize.base * 1.5,
  },
  heroVersion: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.body,
  },

  // Section
  section: {
    marginBottom: sp.xl,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bodySemiBold,
    marginBottom: sp.md,
  },

  // Card
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: sp.lg,
  },
  paragraph: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.body,
    lineHeight: fontSize.sm * 1.6,
  },

  // Partners
  partnersGrid: {
    gap: sp.sm,
  },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: sp.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: sp.md,
  },
  partnerIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerInfo: {
    flex: 1,
  },
  partnerName: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bodySemiBold,
  },
  partnerRole: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.body,
    marginTop: 2,
  },

  // Open source table
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
  },
  tableHeaderText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm + 2,
  },
  tableRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
  },
  tableCell: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.body,
  },
  tableCellMuted: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.body,
  },

  // Acknowledgements
  acknowledgementsContainer: {
    gap: sp.sm,
  },
  ackCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: sp.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: sp.md,
  },
  ackIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ackInfo: {
    flex: 1,
  },
  ackName: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bodySemiBold,
  },
  ackDesc: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.body,
    marginTop: 2,
    lineHeight: fontSize.xs * 1.5,
  },

  // Creator
  creatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
    marginBottom: sp.lg,
  },
  creatorAvatar: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorInfo: {
    flex: 1,
  },
  creatorName: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bodySemiBold,
  },
  creatorRole: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.body,
    marginTop: 2,
  },
  creatorDetails: {
    gap: sp.sm,
  },
  creatorDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
  },
  creatorDetailText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.body,
  },

  // Footer
  footer: {
    borderTopWidth: 1,
    paddingTop: sp.xl,
    alignItems: 'center',
    gap: sp.xs,
    marginTop: sp.md,
  },
  footerText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.body,
    textAlign: 'center',
  },
});

export default AboutScreen;
