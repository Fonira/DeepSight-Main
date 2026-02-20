import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/stores/authStore';
import { historyApi } from '@/services/api';
import { Avatar } from '@/components/ui/Avatar';
import { YouTubeSearch } from '@/components/home/YouTubeSearch';
import { URLInput } from '@/components/home/URLInput';
import { CreditBar } from '@/components/home/CreditBar';
import { RecentCarousel } from '@/components/home/RecentCarousel';
import { OptionsSheet } from '@/components/home/OptionsSheet';
import type { AnalysisSummary } from '@/types';
import { textStyles, fontFamily, fontSize } from '@/theme/typography';
import { sp, borderRadius } from '@/theme/spacing';
import { palette } from '@/theme/colors';
import { DoodleBackground } from '@/components/ui/DoodleBackground';

type InputMode = 'search' | 'url';

const TABS: { key: InputMode; label: string; icon: string }[] = [
  { key: 'search', label: 'Recherche', icon: 'search-outline' },
  { key: 'url', label: 'Coller un lien', icon: 'link-outline' },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const optionsRef = useRef<BottomSheet>(null);

  const [mode, setMode] = useState<InputMode>('search');
  const [recents, setRecents] = useState<AnalysisSummary[]>([]);
  const [favorites, setFavorites] = useState<AnalysisSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Animated tab indicator
  const indicatorX = useSharedValue(0);
  const [tabWidths, setTabWidths] = useState<number[]>([0, 0]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: tabWidths[mode === 'search' ? 0 : 1] || 100,
  }));

  const handleTabPress = useCallback((tab: InputMode, index: number) => {
    setMode(tab);
    const offset = tabWidths.slice(0, index).reduce((a, b) => a + b, 0);
    indicatorX.value = withSpring(offset, { damping: 20, stiffness: 200 });
  }, [tabWidths, indicatorX]);

  const loadData = useCallback(async () => {
    try {
      const [historyRes, favRes] = await Promise.all([
        historyApi.getHistory(1, 10),
        historyApi.getHistory(1, 10, { favoritesOnly: true }),
      ]);
      setRecents(historyRes.items);
      setFavorites(favRes.items);
    } catch {
      // Silent fail
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleOptionsPress = useCallback(() => {
    optionsRef.current?.snapToIndex(0);
  }, []);

  const handleOptionsClose = useCallback(() => {
    optionsRef.current?.close();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <DoodleBackground variant="default" density="low" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + sp.md,
            paddingBottom: 80 + Math.max(insets.bottom, sp.md),
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.textTertiary}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[textStyles.displaySm, { color: colors.textPrimary }]}>
            DeepSight
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            accessibilityLabel="Profil"
          >
            <Avatar
              uri={user?.avatar_url}
              name={user?.username}
              size="md"
            />
          </Pressable>
        </View>

        {/* Mode Tabs */}
        <View style={[styles.tabBar, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          <Animated.View
            style={[
              styles.tabIndicator,
              { backgroundColor: palette.indigo + '20' },
              indicatorStyle,
            ]}
          />
          {TABS.map((tab, index) => {
            const isActive = mode === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => handleTabPress(tab.key, index)}
                onLayout={(e) => {
                  const w = e.nativeEvent.layout.width;
                  setTabWidths((prev) => {
                    const next = [...prev];
                    next[index] = w;
                    return next;
                  });
                }}
                style={styles.tab}
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: isActive }}
              >
                <Ionicons
                  name={tab.icon as keyof typeof Ionicons.glyphMap}
                  size={16}
                  color={isActive ? palette.indigo : colors.textMuted}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isActive ? palette.indigo : colors.textMuted,
                      fontFamily: isActive ? fontFamily.bodySemiBold : fontFamily.body,
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Input zone based on mode */}
        {mode === 'search' ? (
          <YouTubeSearch onOptionsPress={handleOptionsPress} />
        ) : (
          <URLInput onOptionsPress={handleOptionsPress} />
        )}

        {/* Credit Bar */}
        <CreditBar />

        {/* Recents */}
        <View style={styles.sectionSpacing}>
          <RecentCarousel
            title="Récents"
            items={recents}
            isLoading={isLoading}
            showEmpty
          />
        </View>

        {/* Favorites */}
        {(favorites.length > 0 || isLoading) && (
          <RecentCarousel
            title="Favoris"
            items={favorites}
            isLoading={isLoading}
          />
        )}
      </ScrollView>

      {/* Options Bottom Sheet */}
      <OptionsSheet ref={optionsRef} onClose={handleOptionsClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: sp.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp.lg,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: 3,
    marginBottom: sp.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  tabIndicator: {
    position: 'absolute',
    top: 3,
    left: 3,
    bottom: 3,
    borderRadius: borderRadius.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sp.sm + 2,
    gap: sp.xs,
    zIndex: 1,
  },
  tabLabel: {
    fontSize: fontSize.sm,
  },
  sectionSpacing: {
    marginTop: sp.xl,
  },
});
