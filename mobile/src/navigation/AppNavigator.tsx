import React, { useMemo } from 'react';
import { View, StyleSheet, Keyboard } from 'react-native';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { DeepSightSpinner } from '../components/loading';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Linking from 'expo-linking';

import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { CustomTabBar } from '../components/navigation';
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
  StudyScreen,
  ContactScreen,
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
      <Tab.Screen name="Playlists" component={PlaylistsScreen} />
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
      <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
      <Stack.Screen
        name="StudyTools"
        component={StudyScreen}
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
          Playlists: 'playlists',
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
      PlaylistDetail: 'playlists/:playlistId',
    },
  },
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
