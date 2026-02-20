/**
 * DeepSight Router Configuration
 * Expo Router linking and navigation configuration
 */

export const linking = {
  prefixes: ['deepsight://', 'https://deepsightsynthesis.com', 'https://www.deepsightsynthesis.com', 'https://deepsight.app'],
  config: {
    screens: {
      // Auth screens
      '(auth)': {
        screens: {
          index: 'welcome',
          login: 'login',
          register: 'register',
          verify: 'verify',
          'forgot-password': 'forgot-password',
        },
      },
      // Tabs screens
      '(tabs)': {
        screens: {
          index: 'home',
          library: 'library',
          study: 'study',
          profile: 'profile',
          // Nested analysis route
          analysis: {
            screens: {
              '[id]': 'analysis/:id',
            },
          },
        },
      },
      // Error handling
      '_404': '*',
      'splash': 'splash',
      'not-found': '404',
    },
  },
};

/**
 * Screen options for different navigators
 */
export const commonScreenOptions = {
  headerShown: false,
  animationEnabled: true,
  cardStyle: { backgroundColor: '#0a0a0f' },
};

export const authScreenOptions = {
  ...commonScreenOptions,
  animationEnabled: true,
  gestureEnabled: false,
};

export const tabScreenOptions = {
  ...commonScreenOptions,
  animationEnabled: false,
  gestureEnabled: false,
};
