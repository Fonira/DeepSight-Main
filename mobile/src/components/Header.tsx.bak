import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  showLogo?: boolean;
  rightAction?: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  };
  transparent?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  showLogo = false,
  rightAction,
  transparent = false,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={transparent ? 'transparent' : colors.bgPrimary}
        translucent
      />
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + Spacing.sm,
            backgroundColor: transparent ? 'transparent' : colors.bgPrimary,
            borderBottomColor: transparent ? 'transparent' : colors.border,
          },
        ]}
      >
        <View style={styles.leftSection}>
          {showBack && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="chevron-back"
                size={28}
                color={colors.textPrimary}
              />
            </TouchableOpacity>
          )}

          {showLogo && (
            <TouchableOpacity
              onPress={() => (navigation as any).navigate('MainTabs', { screen: 'Dashboard' })}
              style={styles.logoContainer}
              activeOpacity={0.7}
            >
              <Image
                source={require('../assets/images/icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <View style={styles.logoTextContainer}>
                <Text style={[styles.logoText, { color: colors.accentPrimary }]}>
                  Deep
                </Text>
                <Text style={[styles.logoText, { color: colors.textPrimary }]}>
                  Sight
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {title && !showLogo && (
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {title}
              </Text>
              {subtitle && (
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {subtitle}
                </Text>
              )}
            </View>
          )}
        </View>

        {rightAction && (
          <TouchableOpacity
            onPress={rightAction.onPress}
            style={styles.rightAction}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={rightAction.icon}
              size={24}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: Spacing.sm,
    marginLeft: -Spacing.sm,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
  },
  logoTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginTop: 2,
  },
  rightAction: {
    padding: Spacing.xs,
  },
});

export default Header;
