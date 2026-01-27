/**
 * OfflineBanner - Shows a banner when the device is offline
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Colors, Spacing, Typography } from '../../constants/theme';

interface OfflineBannerProps {
  /** Show retry button */
  showRetry?: boolean;
  /** Callback when retry is pressed */
  onRetry?: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  showRetry = true,
  onRetry,
}) => {
  const { isDark } = useTheme();
  const { language } = useLanguage();
  const { status, refresh } = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const isEn = language === 'en';

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: status.isOffline ? 0 : -100,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [status.isOffline, slideAnim]);

  const handleRetry = () => {
    refresh();
    onRetry?.();
  };

  if (!status.isOffline) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          paddingTop: insets.top,
          backgroundColor: isDark ? Colors.accentWarning : '#F59E0B',
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name="cloud-offline" size={20} color="#FFFFFF" />
        <Text style={styles.text}>
          {isEn ? 'No internet connection' : 'Pas de connexion internet'}
        </Text>
        {showRetry && (
          <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  text: {
    color: '#FFFFFF',
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.fontSize.sm,
  },
  retryButton: {
    padding: Spacing.xs,
    marginLeft: Spacing.sm,
  },
});

export default OfflineBanner;
