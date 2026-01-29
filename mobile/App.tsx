import React, { useEffect, useState, Suspense, lazy } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { StyleSheet, View, Platform } from 'react-native';
import Constants from 'expo-constants';

import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { ErrorProvider } from './src/contexts/ErrorContext';
import { OfflineProvider } from './src/contexts/OfflineContext';
import { PlanProvider } from './src/contexts/PlanContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary, OfflineBanner } from './src/components/common';
import { ToastProvider } from './src/components/ui/Toast';
import { QUERY_CONFIG } from './src/constants/config';
import { Colors } from './src/constants/theme';
import { initCrashReporting, setUser, captureException } from './src/services/CrashReporting';
import { tokenManager } from './src/services/TokenManager';

// Check if running in Expo Go (has version mismatch issues with Reanimated/Worklets)
const isExpoGo = Constants.appOwnership === 'expo';

// Lazy load DoodleBackground only in development builds (not Expo Go)
// This prevents the Worklets version mismatch crash in Expo Go
const DoodleBackground = !isExpoGo
  ? lazy(() => import('./src/components/backgrounds').then(mod => ({ default: mod.DoodleBackground })))
  : null;

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Initialize crash reporting early
initCrashReporting().catch(err => {
  console.warn('Failed to initialize crash reporting:', err);
});

// Create query client with error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_CONFIG.STALE_TIME,
      gcTime: QUERY_CONFIG.CACHE_TIME,
      retry: QUERY_CONFIG.RETRY_COUNT,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error) => {
        // Report mutation errors to crash reporting
        captureException(error, { tags: { type: 'mutation' } });
      },
    },
  },
});

// App content with theme-aware status bar and background
const AppContent: React.FC = () => {
  const { isDark, colors } = useTheme();

  // Use lower density on Android to avoid performance issues with Reanimated
  const doodleDensity = Platform.OS === 'android' ? 'low' : 'medium';

  return (
    <View style={[styles.appContainer, { backgroundColor: colors.bgPrimary }]}>
      <OfflineBanner />
      {/* DoodleBackground is disabled in Expo Go due to Worklets version mismatch */}
      {DoodleBackground && (
        <Suspense fallback={null}>
          <DoodleBackground density={doodleDensity} />
        </Suspense>
      )}
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </View>
  );
};

// Main App component
export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    let isComplete = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function prepare() {
      try {
        // Initialize token manager for proactive refresh
        await tokenManager.initialize();

        // Pre-load custom fonts with timeout
        const fontLoadPromise = Font.loadAsync({
          'DMSans-Regular': require('./src/assets/fonts/DMSans-Regular.ttf'),
          'DMSans-Medium': require('./src/assets/fonts/DMSans-Medium.ttf'),
          'DMSans-SemiBold': require('./src/assets/fonts/DMSans-SemiBold.ttf'),
          'DMSans-Bold': require('./src/assets/fonts/DMSans-Bold.ttf'),
          'Cormorant-Bold': require('./src/assets/fonts/CormorantGaramond-Bold.ttf'),
          'JetBrainsMono-Regular': require('./src/assets/fonts/JetBrainsMono-Regular.ttf'),
        });

        // Race between font loading and timeout
        await Promise.race([
          fontLoadPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Font load timeout')), 5000))
        ]);

        // Small delay for smoother experience
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (e) {
        console.warn('Error loading fonts:', e);
        captureException(e, { tags: { phase: 'init' } });
      } finally {
        if (!isComplete) {
          isComplete = true;
          clearTimeout(timeoutId);
          setAppIsReady(true);
        }
      }
    }

    // Absolute safety timeout: 8 seconds max for entire init
    timeoutId = setTimeout(() => {
      if (!isComplete) {
        isComplete = true;
        console.warn('App init timeout - forcing ready state');
        setAppIsReady(true);
      }
    }, 8000);

    prepare();

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  // Hide splash screen when app is ready
  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync().catch(console.warn);
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary
            onError={(error, errorInfo) => {
              // Log error to console in development
              console.error('App Error:', error, errorInfo);
              // Report to crash tracking service
              captureException(error, {
                extra: { componentStack: errorInfo?.componentStack },
                tags: { boundary: 'root' },
              });
            }}
          >
            <ErrorProvider>
              <OfflineProvider>
                <ThemeProvider>
                  <LanguageProvider>
                    <AuthProvider>
                      <PlanProvider>
                        <ToastProvider>
                          <AppContent />
                        </ToastProvider>
                      </PlanProvider>
                    </AuthProvider>
                  </LanguageProvider>
                </ThemeProvider>
              </OfflineProvider>
            </ErrorProvider>
          </ErrorBoundary>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appContainer: {
    flex: 1,
  },
});
