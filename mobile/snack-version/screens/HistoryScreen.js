import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
} from 'react-native';
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
  error: '#EF4444',
};

const historyData = [
  {
    id: '1',
    title: 'Comment fonctionne l\'IA en 2024 - Tout comprendre',
    channel: 'Tech Explained',
    mode: 'Synthèse',
    category: 'Tech',
    date: 'Aujourd\'hui',
    thumbnail: '🤖',
    isFavorite: true,
  },
  {
    id: '2',
    title: 'Les secrets de la productivité des entrepreneurs',
    channel: 'Mindset Pro',
    mode: 'Détaillé',
    category: 'Business',
    date: 'Hier',
    thumbnail: '🚀',
    isFavorite: false,
  },
  {
    id: '3',
    title: 'React Native - Créer des apps mobiles',
    channel: 'Code Academy',
    mode: 'Éducatif',
    category: 'Dev',
    date: 'Il y a 2j',
    thumbnail: '📱',
    isFavorite: true,
  },
  {
    id: '4',
    title: 'Comprendre la blockchain simplement',
    channel: 'Crypto France',
    mode: 'Synthèse',
    category: 'Crypto',
    date: 'Il y a 3j',
    thumbnail: '⛓️',
    isFavorite: false,
  },
  {
    id: '5',
    title: 'Les tendances design 2024',
    channel: 'Design Weekly',
    mode: 'Critique',
    category: 'Design',
    date: 'Il y a 5j',
    thumbnail: '🎨',
    isFavorite: false,
  },
];

export default function HistoryScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState(
    historyData.filter((v) => v.isFavorite).map((v) => v.id)
  );

  const toggleFavorite = (id) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
    );
  };

  const filteredData = historyData.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFavorite = showFavoritesOnly ? favorites.includes(item.id) : true;
    return matchesSearch && matchesFavorite;
  });

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.videoCard}>
      <View style={styles.thumbnailContainer}>
        <View style={styles.thumbnail}>
          <Text style={styles.thumbnailEmoji}>{item.thumbnail}</Text>
        </View>
      </View>
      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.videoChannel}>{item.channel}</Text>
        <View style={styles.badges}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.mode}</Text>
          </View>
          <View style={[styles.badge, styles.badgeSecondary]}>
            <Text style={styles.badgeTextSecondary}>{item.category}</Text>
          </View>
        </View>
        <Text style={styles.videoDate}>{item.date}</Text>
      </View>
      <TouchableOpacity
        style={styles.favoriteButton}
        onPress={() => toggleFavorite(item.id)}
      >
        <Ionicons
          name={favorites.includes(item.id) ? 'heart' : 'heart-outline'}
          size={22}
          color={favorites.includes(item.id) ? colors.error : colors.textTertiary}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historique</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.filterButton,
            showFavoritesOnly && styles.filterButtonActive,
          ]}
          onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
        >
          <Ionicons
            name={showFavoritesOnly ? 'heart' : 'heart-outline'}
            size={20}
            color={showFavoritesOnly ? '#FFFFFF' : colors.textTertiary}
          />
        </TouchableOpacity>
      </View>

      {/* Results count */}
      <Text style={styles.resultsCount}>
        {filteredData.length} analyse{filteredData.length > 1 ? 's' : ''}
        {showFavoritesOnly ? ' en favoris' : ''}
      </Text>

      {/* List */}
      <FlatList
        data={filteredData}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name={showFavoritesOnly ? 'heart-outline' : 'folder-open-outline'}
              size={48}
              color={colors.textTertiary}
            />
            <Text style={styles.emptyTitle}>
              {showFavoritesOnly ? 'Aucun favori' : 'Aucun résultat'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {showFavoritesOnly
                ? 'Ajoutez des vidéos à vos favoris'
                : 'Essayez une autre recherche'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    paddingVertical: 12,
    marginLeft: 12,
  },
  filterButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterButtonActive: {
    backgroundColor: colors.accentPrimary,
    borderColor: colors.accentPrimary,
  },
  resultsCount: {
    color: colors.textSecondary,
    fontSize: 14,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  videoCard: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  thumbnailContainer: {
    marginRight: 12,
  },
  thumbnail: {
    width: 100,
    height: 60,
    backgroundColor: colors.bgSecondary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailEmoji: {
    fontSize: 28,
  },
  videoInfo: {
    flex: 1,
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
    marginBottom: 6,
  },
  badges: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  badge: {
    backgroundColor: `${colors.accentPrimary}20`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 6,
  },
  badgeText: {
    color: colors.accentPrimary,
    fontSize: 10,
    fontWeight: '500',
  },
  badgeSecondary: {
    backgroundColor: colors.bgSecondary,
  },
  badgeTextSecondary: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '500',
  },
  videoDate: {
    color: colors.textTertiary,
    fontSize: 11,
  },
  favoriteButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 8,
  },
});
