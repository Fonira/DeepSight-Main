import React, { useEffect, Component } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Slot, Stack, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { ThemeProvider } from "../src/contexts/ThemeContext";
import { TTSProvider } from "../src/contexts/TTSContext";
import { PlanProvider } from "../src/contexts/PlanContext";
import { LanguageProvider } from "../src/contexts/LanguageContext";
import { ErrorProvider } from "../src/contexts/ErrorContext";
import { OfflineProvider } from "../src/contexts/OfflineContext";
import { BackgroundAnalysisProvider } from "../src/contexts/BackgroundAnalysisContext";
import { ElevenLabsProvider } from "@elevenlabs/react-native";
import { createQueryClient } from "../src/utils/queryClient";
import { darkColors } from "../src/theme/colors";
import { useShareIntent } from "../src/hooks/useShareIntent";
import { AmbientLightLayer } from "../src/components/backgrounds/AmbientLightLayer";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {});

// Global error boundary — catches unhandled render errors
class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) {
      console.error("[ErrorBoundary] Unhandled render error:", error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={ebStyles.container}>
          <Text style={ebStyles.title}>Une erreur est survenue</Text>
          <Text style={ebStyles.message}>{this.state.error?.message}</Text>
          <Pressable
            style={ebStyles.button}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={ebStyles.buttonText}>Réessayer</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const ebStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: { color: "#ffffff", fontSize: 18, fontWeight: "600", marginBottom: 8 },
  message: {
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#6366f1",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
});

const queryClient = createQueryClient();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "DMSans-Regular": require("../src/assets/fonts/DMSans-Regular.ttf"),
    "DMSans-Medium": require("../src/assets/fonts/DMSans-Medium.ttf"),
    "DMSans-SemiBold": require("../src/assets/fonts/DMSans-SemiBold.ttf"),
    "DMSans-Bold": require("../src/assets/fonts/DMSans-Bold.ttf"),
    "JetBrainsMono-Regular": require("../src/assets/fonts/JetBrainsMono-Regular.ttf"),
    "CormorantGaramond-Bold": require("../src/assets/fonts/CormorantGaramond-Bold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  // Check for OTA updates on launch
  useEffect(() => {
    if (__DEV__) return; // Skip in dev mode
    (async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (e) {
        // Silent fail — non-blocking
      }
    })();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <LanguageProvider>
                <ErrorProvider>
                  <AuthProvider>
                    <OfflineProvider>
                      <PlanProvider>
                        <BackgroundAnalysisProvider>
                          <ElevenLabsProvider>
                            <TTSProvider>
                              <RootNavigator />
                            </TTSProvider>
                          </ElevenLabsProvider>
                        </BackgroundAnalysisProvider>
                      </PlanProvider>
                    </OfflineProvider>
                  </AuthProvider>
                </ErrorProvider>
              </LanguageProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Handle incoming shared URLs from TikTok, YouTube, etc.
  useShareIntent();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, segments]);

  return (
    <View style={rootStyles.root}>
      <AmbientLightLayer intensity="normal" />
      <StatusBar style="light" backgroundColor={darkColors.bgPrimary} />
      <Stack
        screenOptions={{
          headerShown: false,
          // Transparent so AmbientLightLayer (rendered behind via the root
          // View) shows through on screens that don't paint their own opaque
          // background. Screens that DO set backgroundColor: bgPrimary keep
          // it as-is — c'est un choix par écran. Le bg opaque global est
          // porté par le View root (rootStyles.root).
          contentStyle: { backgroundColor: "transparent" },
          animation: "fade",
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="splash" />
      </Stack>
    </View>
  );
}

const rootStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: darkColors.bgPrimary },
});
