import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const colors = {
  bgPrimary: '#0a0a0b',
  bgSecondary: '#111113',
  bgElevated: '#1f1f23',
  textPrimary: '#FAFAF9',
  textSecondary: '#A1A1AA',
  textTertiary: '#71717A',
  accentPrimary: '#6366F1',
  border: '#27272A',
};

const analysisTypes = [
  { id: 'synthesis', label: 'Synthèse', icon: 'document-text' },
  { id: 'detailed', label: 'Détaillé', icon: 'list' },
  { id: 'critique', label: 'Critique', icon: 'alert-circle' },
  { id: 'educational', label: 'Éducatif', icon: 'school' },
];

const recentVideos = [
  {
    id: '1',
    title: 'Comment fonctionne l\'IA en 2024',
    channel: 'Tech Explained',
    thumbnail: '🤖',
    date: 'Il y a 2h',
  },
  {
    id: '2',
    title: 'Les secrets de la productivité',
    channel: 'Mindset Pro',
    thumbnail: '🚀',
    date: 'Hier',
  },
  {
    id: '3',
    title: 'Apprendre React Native',
    channel: 'Code Academy',
    thumbnail: '📱',
    date: 'Il y a 3j',
  },
];

export default function DashboardScreen() {
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedType, setSelectedType] = useState('synthesis');
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = () => {
    if (!videoUrl.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une URL YouTube');
      return;
    }
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
      Alert.alert('Analyse terminée !', 'Votre vidéo a été analysée avec succès.');
      setVideoUrl('');
    }, 2000);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Bonjour,</Text>
            <Text style={styles.username}>Maxime 👋</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>ML</Text>
          </View>
        </View>

        {/* Credits Card */}
        <LinearGradient
          colors={['#6366F1', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.creditsCard}
        >
          <View style={styles.creditsContent}>
            <View>
              <Text style={styles.creditsLabel}>Crédits restants</Text>
              <Text style={styles.creditsValue}>18/20</Text>
            </View>
            <View style={styles.planBadge}>
              <Text style={styles.planText}>FREE</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.upgradeButton}>
            <Text style={styles.upgradeText}>Upgrade</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Analysis Section */}
        <Text style={styles.sectionTitle}>Analyser une vidéo</Text>

        {/* URL Input */}
        <View style={styles.urlInputContainer}>
          <Ionicons name="logo-youtube" size={24} color="#FF0000" />
          <TextInput
            style={styles.urlInput}
            placeholder="Collez l'URL YouTube ici..."
            placeholderTextColor={colors.textTertiary}
            value={videoUrl}
            onChangeText={setVideoUrl}
            autoCapitalize="none"
          />
          {videoUrl.length > 0 && (
            <TouchableOpacity onPress={() => setVideoUrl('')}>
              <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Analysis Types */}
        <Text style={styles.optionLabel}>Type d'analyse</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typesScroll}>
          {analysisTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.typeChip,
                selectedType === type.id && styles.typeChipActive,
              ]}
              onPress={() => setSelectedType(type.id)}
            >
              <Ionicons
                name={type.icon}
                size={16}
                color={selectedType === type.id ? '#FFFFFF' : colors.textSecondary}
              />
              <Text
                style={[
                  styles.typeChipText,
                  selectedType === type.id && styles.typeChipTextActive,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Analyze Button */}
        <TouchableOpacity onPress={handleAnalyze} disabled={analyzing}>
          <LinearGradient
            colors={analyzing ? ['#4B5563', '#6B7280'] : ['#6366F1', '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.analyzeButton}
          >
            {analyzing ? (
              <Text style={styles.analyzeButtonText}>Analyse en cours...</Text>
            ) : (
              <>
                <Ionicons name="sparkles" size={20} color="#FFFFFF" />
                <Text style={styles.analyzeButtonText}>Analyser</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Recent Analyses */}
        <View style={styles.recentHeader}>
          <Text style={styles.sectionTitle}>Analyses récentes</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>Voir tout</Text>
          </TouchableOpacity>
        </View>

        {recentVideos.map((video) => (
          <TouchableOpacity key={video.id} style={styles.videoCard}>
            <View style={styles.videoThumbnail}>
              <Text style={styles.videoEmoji}>{video.thumbnail}</Text>
            </View>
            <View style={styles.videoInfo}>
              <Text style={styles.videoTitle} numberOfLines={2}>
                {video.title}
              </Text>
              <Text style={styles.videoChannel}>{video.channel}</Text>
              <Text style={styles.videoDate}>{video.date}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  username: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  creditsCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  creditsContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  creditsLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 4,
  },
  creditsValue: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
  },
  planBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  planText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
  },
  upgradeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  urlInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  urlInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    marginLeft: 12,
  },
  optionLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  typesScroll: {
    marginBottom: 20,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: {
    backgroundColor: colors.accentPrimary,
    borderColor: colors.accentPrimary,
  },
  typeChipText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  typeChipTextActive: {
    color: '#FFFFFF',
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 32,
  },
  analyzeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAll: {
    color: colors.accentPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  videoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  videoThumbnail: {
    width: 80,
    height: 50,
    backgroundColor: colors.bgSecondary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoEmoji: {
    fontSize: 24,
  },
  videoInfo: {
    flex: 1,
    marginLeft: 12,
  },
  videoTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  videoChannel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  videoDate: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
});
