import React, { useMemo, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Keyboard } from 'react-native';
import { NavigationContainer, LinkingOptions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DeepSightSpinner } from '../components/loading';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Linking from 'expo-linking';

import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  getInitialUrl,
  subscribeToDeepLinks,
  parseDeepLink,
  LinkType,
} from '../services/DeepLinking';
import type { ParsedLink } from '../services/DeepLinking';
import {
  addNotificationReceivedListener,
  addNotificationResponseListener,
  getLastNotificationResponse,
  clearBadge,
} from '../services/notifications';
import { CustomTabBar } from '../components/navigation';
import {
  LandingScreen,
  LoginScreen,
  RegisterScreen,
  ForgotPasswordScreen,
  VerifyEmailScreen,
  DashboardScreen,
  HistoryScreen,
  ProfileScreen,
  SettingsScreen,
  AccountScreen,
  UpgradeScreen,
  UsageScreen,
  AnalysisScreen,
  PaymentSuccessScreen,
  PaymentCancelScreen,
  LegalScreen,
  StudyScreen,
  ContactScreen,
  AnalyticsScreen,
  PlaylistDetailScreen,
} from '../screens';
import type { RootStackParamList, MainTabParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Bottom Tab Navigator with custom TabBar
const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      sceneContainerStyle={{ backgroundColor: 'transparent' }}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Upgrade" component={UpgradeScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

// Auth Stack Navigator
const AuthStack: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
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
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
    </Stack.Navigator>
  );
};

// Main Stack Navigator
const MainStack: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
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
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="Upgrade" component={UpgradeScreen} />
      <Stack.Screen name="Usage" component={UsageScreen} />
      <Stack.Screen
        name="PaymentSuccess"
        component={PaymentSuccessScreen}
        options={{ animation: 'fade', gestureEnabled: false }}
      />
      <Stack.Screen
        name="PaymentCancel"
        component={PaymentCancelScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen name="Legal" component={LegalScreen} />
      <Stack.Screen name="Contact" component={ContactScreen} />
      <Stack.Screen
        name="StudyTools"
        component={StudyScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} />
      <Stack.Screen
        name="PlaylistDetail"
        component={PlaylistDetailScreen}
        options={{ animation: 'slide_from_right' }}
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
    'https://deepsight.app',
  ],
  config: {
    screens: {
      Landing: 'welcome',
      Login: 'login',
      Register: 'register',
      ForgotPassword: 'forgot-password',
      VerifyEmail: 'verify-email',
      MainTabs: {
        screens: {
          Dashboard: 'home',
          History: 'history',
          Upgrade: 'plans',
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
      Contact: 'contact',
      StudyTools: 'study/:summaryId',
      Analytics: 'analytics',
    },
  },
};

// Auth-aware deep link routes
const AUTH_REQUIRED_ROUTES = new Set([
  'Analysis', 'Settings', 'Account', 'Usage', 'StudyTools', 'PlaylistDetail',
]);

// Handles incoming deep links with auth redirect
const DeepLinkHandler: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isAuthenticated } = useAuth();
  const pendingLink = useRef<ParsedLink | null>(null);

  const navigateToLink = useCallback(
    (parsed: ParsedLink) => {
      if (parsed.type === LinkType.UNKNOWN || !parsed.route) return;

      if (AUTH_REQUIRED_ROUTES.has(parsed.route) && !isAuthenticated) {
        pendingLink.current = parsed;
        navigation.navigate('Login' as any);
        return;
      }

      navigation.navigate(parsed.route as any, parsed.params as any);
    },
    [isAuthenticated, navigation],
  );

  // Cold-start URL
  useEffect(() => {
    let cancelled = false;
    getInitialUrl().then((url) => {
      if (cancelled || !url) return;
      navigateToLink(parseDeepLink(url));
    });
    return () => { cancelled = true; };
  }, [navigateToLink]);

  // Foreground links
  useEffect(() => {
    return subscribeToDeepLinks((parsed) => navigateToLink(parsed));
  }, [navigateToLink]);

  // After auth, consume pending link
  useEffect(() => {
    if (isAuthenticated && pendingLink.current) {
      const link = pendingLink.current;
      pendingLink.current = null;
      const timer = setTimeout(() => {
        navigation.navigate(link.route as any, link.params as any);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, navigation]);

  // Push notification handlers
  useEffect(() => {
    // Clear badge on app launch
    clearBadge();

    // Foreground notification received — no-op (OS shows banner via handler config)
    const receivedSub = addNotificationReceivedListener(() => {
      // Badge will be managed by the OS
    });

    // User tapped notification — navigate to appropriate screen
    const responseSub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (!isAuthenticated || !data) return;

      const screen = data.screen as string | undefined;
      const summaryId = data.summaryId as string | undefined;
      const videoId = data.videoId as string | undefined;
      if (screen === 'Analysis' && (summaryId || videoId)) {
        navigation.navigate('Analysis', { videoId: videoId || summaryId } as any);
      } else if (screen === 'Dashboard') {
        navigation.navigate('MainTabs' as any);
      } else if (screen === 'Upgrade') {
        navigation.navigate('Upgrade' as any);
      }

      clearBadge();
    });

    // Handle cold-start notification tap
    getLastNotificationResponse().then((response) => {
      if (!response || !isAuthenticated) return;
      const data = response.notification.request.content.data as Record<string, unknown>;
      const screen = data?.screen as string | undefined;
      const summaryId = data?.summaryId as string | undefined;
      const videoId = data?.videoId as string | undefined;

      if (screen === 'Analysis' && (summaryId || videoId)) {
        setTimeout(() => {
          navigation.navigate('Analysis', { videoId: videoId || summaryId } as any);
        }, 500);
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [isAuthenticated, navigation]);

  return null;
};

// Root Navigator
export const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors, isDark } = useTheme();

  const navigationTheme = useMemo(() => ({
    dark: isDark,
    colors: {
      primary: colors.accentPrimary,
      background: 'transparent',
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
    <NavigationContainer linking={linking} theme={navigationTheme} onStateChange={() => Keyboard.dismiss()}>
      <DeepLinkHandler />
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
