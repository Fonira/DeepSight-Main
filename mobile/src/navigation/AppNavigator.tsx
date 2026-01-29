import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { DeepSightSpinner } from '../components/loading';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';

import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { AnimatedTabBarIcon } from '../components/navigation';
import {
  LandingScreen,
  LoginScreen,
  RegisterScreen,
  ForgotPasswordScreen,
  VerifyEmailScreen,
  DashboardScreen,
  HistoryScreen,
  PlaylistsScreen,
  PlaylistDetailScreen,
  ProfileScreen,
  SettingsScreen,
  AccountScreen,
  UpgradeScreen,
  UsageScreen,
  AnalysisScreen,
  PaymentSuccessScreen,
  PaymentCancelScreen,
  LegalScreen,
} from '../screens';
import { Typography, Spacing, BorderRadius } from '../constants/theme';
import type { RootStackParamList, MainTabParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Bottom Tab Navigator
const MainTabs: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgSecondary,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingTop: Spacing.sm,
          paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.sm,
          height: 60 + (insets.bottom > 0 ? insets.bottom : Spacing.sm),
        },
        tabBarActiveTintColor: colors.accentPrimary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: Typography.fontSize.xs,
          fontFamily: Typography.fontFamily.bodyMedium,
          marginTop: Spacing.xs,
        },
        tabBarIcon: ({ focused, color }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'History':
              iconName = focused ? 'time' : 'time-outline';
              break;
            case 'Playlists':
              iconName = focused ? 'list' : 'list-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'help-outline';
          }

          return (
            <AnimatedTabBarIcon
              name={iconName}
              focused={focused}
              color={color}
              size={24}
            />
          );
        },
      })}
      screenListeners={{
        tabPress: () => {
          Haptics.selectionAsync();
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarLabel: 'Accueil' }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarLabel: 'Historique' }}
      />
      <Tab.Screen
        name="Playlists"
        component={PlaylistsScreen}
        options={{ tabBarLabel: 'Playlists' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profil' }}
      />
    </Tab.Navigator>
  );
};

// Auth Stack Navigator
const AuthStack: React.FC = () => {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bgPrimary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="Landing"
        component={LandingScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
      />
      <Stack.Screen
        name="VerifyEmail"
        component={VerifyEmailScreen}
      />
    </Stack.Navigator>
  );
};

// Main Stack Navigator
const MainStack: React.FC = () => {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bgPrimary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="Analysis"
        component={AnalysisScreen}
        options={{
          animation: 'slide_from_bottom',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
      />
      <Stack.Screen
        name="Account"
        component={AccountScreen}
      />
      <Stack.Screen
        name="Upgrade"
        component={UpgradeScreen}
      />
      <Stack.Screen
        name="Usage"
        component={UsageScreen}
      />
      <Stack.Screen
        name="PaymentSuccess"
        component={PaymentSuccessScreen}
        options={{
          animation: 'fade',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="PaymentCancel"
        component={PaymentCancelScreen}
        options={{
          animation: 'fade',
        }}
      />
      <Stack.Screen
        name="Legal"
        component={LegalScreen}
      />
      <Stack.Screen
        name="PlaylistDetail"
        component={PlaylistDetailScreen}
      />
    </Stack.Navigator>
  );
};

// Deep Linking Configuration
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    Linking.createURL('/'),
    'deepsight://',
    'https://deepsightsynthesis.com',
    'https://www.deepsightsynthesis.com',
  ],
  config: {
    screens: {
      // Auth screens
      Landing: 'welcome',
      Login: 'login',
      Register: 'register',
      ForgotPassword: 'forgot-password',
      VerifyEmail: 'verify-email',
      // Main screens
      MainTabs: {
        screens: {
          Dashboard: 'home',
          History: 'history',
          Playlists: 'playlists',
          Profile: 'profile',
        },
      },
      Analysis: 'analysis/:videoId',
      Settings: 'settings',
      Account: 'account',
      Upgrade: 'upgrade',
      Usage: 'usage',
      PaymentSuccess: 'payment/success',
      PaymentCancel: 'payment/cancel',
      Legal: 'legal/:type',
      PlaylistDetail: 'playlists/:playlistId',
    },
  },
};

// Root Navigator
export const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors, isDark } = useTheme();

  // Memoize navigation theme
  const navigationTheme = useMemo(() => ({
    dark: isDark,
    colors: {
      primary: colors.accentPrimary,
      background: colors.bgPrimary,
      card: colors.bgSecondary,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.accentError,
    },
  }), [isDark, colors]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}>
        <DeepSightSpinner size="lg" showGlow />
      </View>
    );
  }

  return (
    <NavigationContainer
      linking={linking}
      theme={navigationTheme}
      onStateChange={(state) => {
        // Analytics tracking could be added here
        // e.g., analytics.logScreenView(currentRouteName);
      }}
    >
      {isAuthenticated ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AppNavigator;
