/**
 * Navigation type definitions for Expo Router
 * Provides type-safe route parameters and navigation
 */

export type RootStackParamList = {
  splash: undefined;
  '(auth)': undefined;
  '(tabs)': undefined;
  _404: undefined;
};

export type AuthStackParamList = {
  index: undefined;
  login: undefined;
  register: undefined;
  verify: { email?: string };
  'forgot-password': undefined;
};

export type TabsStackParamList = {
  index: undefined;
  library: undefined;
  study: undefined;
  profile: undefined;
  'analysis/[id]': { id: string };
};

/**
 * Hook for type-safe navigation
 * Usage: const navigation = useNavigation<NavigationProp<TabsStackParamList>>();
 */
export type NavigationProp<T> = T;

/**
 * Route params type
 * Usage: const route = useRoute<RouteProp<TabsStackParamList, 'analysis/[id]'>>();
 */
export type RouteProp<T, K extends keyof T> = {
  params: T[K];
};
