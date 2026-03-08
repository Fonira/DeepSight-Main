import React, { useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { palette } from '@/theme/colors';
import { sp } from '@/theme/spacing';

interface TabBarIconProps {
  name: keyof typeof Ionicons.glyphMap;
  isFocused: boolean;
  color: string;
}

function TabBarIcon({ name, isFocused, color }: TabBarIconProps) {
  return (
    <Ionicons
      name={name}
      size={24}
      color={color}
      style={{ opacity: isFocused ? 1 : 0.6 }}
    />
  );
}

// Seules les routes avec une icône sont affichées dans la tab bar
// Les clés DOIVENT correspondre aux noms de fichiers dans app/(tabs)/
const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home',
  library: 'book',
  profile: 'settings-outline',
  subscription: 'sparkles-outline',
};

interface CustomTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

export function CustomTabBar({
  state,
  descriptors,
  navigation,
}: CustomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Se déconnecter',
      'Es-tu sûr de vouloir te déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)');
          },
        },
      ],
    );
  }, [logout, router]);

  // Filtrer : on n'affiche que les 4 routes principales
  const visibleRoutes = useMemo(
    () => state.routes.filter((route: any) => route.name in TAB_ICONS),
    [state.routes],
  );

  const tabWidth = width / visibleRoutes.length;

  // Index actif parmi les routes visibles uniquement
  const activeVisibleIndex = useMemo(() => {
    const activeRoute = state.routes[state.index];
    return visibleRoutes.findIndex((r: any) => r.key === activeRoute?.key);
  }, [state.index, state.routes, visibleRoutes]);

  const indicatorPosition = useSharedValue(
    Math.max(0, activeVisibleIndex) * tabWidth,
  );

  const indicatorAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorPosition.value }],
  }));

  const handleTabPress = (visibleIndex: number, routeName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const event = navigation.emit({
      type: 'tabPress',
      target: routeName,
      canPreventDefault: true,
    });

    if (!event.defaultPrevented) {
      navigation.navigate(routeName);
    }

    indicatorPosition.value = withSpring(visibleIndex * tabWidth, {
      damping: 12,
      mass: 1,
      overshootClamping: false,
    });
  };

  // Sync indicator quand l'onglet actif change (ex: navigation programmatique)
  React.useEffect(() => {
    if (activeVisibleIndex >= 0) {
      indicatorPosition.value = withSpring(activeVisibleIndex * tabWidth, {
        damping: 12,
        mass: 1,
      });
    }
  }, [activeVisibleIndex, tabWidth, indicatorPosition]);

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom,
          backgroundColor: colors.bgPrimary,
          borderTopColor: colors.border,
        },
      ]}
    >
      <BlurView intensity={isDark ? 85 : 50} tint={isDark ? 'dark' : 'light'} style={styles.blurContainer}>
        <View style={styles.tabBarContent}>
          {/* Animated Indicator */}
          {activeVisibleIndex >= 0 && (
            <Animated.View
              style={[
                styles.indicator,
                { width: tabWidth },
                indicatorAnimatedStyle,
              ]}
            >
              <View style={styles.indicatorInner} />
            </Animated.View>
          )}

          {/* Tab Items — seulement les routes visibles */}
          {visibleRoutes.map((route: any, index: number) => {
            const isFocused = activeVisibleIndex === index;
            const iconName = TAB_ICONS[route.name];

            return (
              <TouchableOpacity
                key={route.key}
                activeOpacity={1}
                style={[styles.tab, { width: tabWidth }]}
                onPress={() => handleTabPress(index, route.name)}
              >
                <TabBarIcon
                  name={iconName}
                  isFocused={isFocused}
                  color={
                    isFocused
                      ? palette.indigo
                      : isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.35)'
                  }
                />
              </TouchableOpacity>
            );
          })}

          {/* Bouton déconnexion */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.logoutTab}
            onPress={handleLogout}
          >
            <Ionicons
              name="log-out-outline"
              size={22}
              color={isDark ? 'rgba(239, 68, 68, 0.6)' : 'rgba(220, 38, 38, 0.5)'}
            />
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
  },
  blurContainer: {
    overflow: 'hidden',
  },
  tabBarContent: {
    flexDirection: 'row',
    position: 'relative',
    height: 60,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 4,
    backgroundColor: palette.indigo,
  },
  indicatorInner: {
    flex: 1,
    backgroundColor: palette.indigo,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutTab: {
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
