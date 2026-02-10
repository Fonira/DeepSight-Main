import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  Image,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
  SharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { sp, borderRadius } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  showLogo?: boolean;
  rightAction?: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  };
  rightActions?: Array<{
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  }>;
  transparent?: boolean;
  /** Pass a scrollY shared value for animated title on scroll */
  scrollY?: SharedValue<number>;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  showLogo = false,
  rightAction,
  rightActions,
  transparent = false,
  scrollY,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  // Animated title opacity (fades in when scrolling past threshold)
  const animatedTitleStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: 1 };
    return {
      opacity: interpolate(scrollY.value, [0, 80, 120], [0, 0, 1]),
    };
  });

  // Animated blur intensity
  const animatedBlurStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: transparent ? 0 : 1 };
    return {
      opacity: interpolate(scrollY.value, [0, 60], [0, 1]),
    };
  });

  const allRightActions = rightActions || (rightAction ? [rightAction] : []);

  const headerContent = (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + sp.sm,
          borderBottomColor: transparent ? 'transparent' : colors.border,
        },
      ]}
    >
      <View style={styles.leftSection}>
        {showBack && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.goBack();
            }}
            style={styles.backButton}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
          </Pressable>
        )}

        {showLogo && (
          <Pressable
            onPress={() => (navigation as any).navigate('MainTabs', { screen: 'Dashboard' })}
            style={styles.logoContainer}
          >
            <Image
              source={require('../assets/images/icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <View style={styles.logoTextContainer}>
              <Text style={[styles.logoText, { color: colors.accentPrimary }]}>Deep</Text>
              <Text style={[styles.logoText, { color: colors.textPrimary }]}>Sight</Text>
            </View>
          </Pressable>
        )}

        {title && !showLogo && (
          <Animated.View style={[styles.titleContainer, scrollY ? animatedTitleStyle : undefined]}>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle && (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </Animated.View>
        )}
      </View>

      {allRightActions.length > 0 && (
        <View style={styles.rightSection}>
          {allRightActions.map((action, index) => (
            <Pressable
              key={index}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                action.onPress();
              }}
              style={[styles.rightAction, { backgroundColor: colors.glassBg }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={action.icon} size={20} color={colors.textPrimary} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  // Use blur background
  if (!transparent && Platform.OS === 'ios') {
    return (
      <>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Animated.View style={[styles.blurWrapper, animatedBlurStyle]}>
          <BlurView
            intensity={isDark ? 40 : 60}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <View style={{ backgroundColor: scrollY ? 'transparent' : `${colors.bgPrimary}E6` }}>
          {headerContent}
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={transparent ? 'transparent' : colors.bgPrimary}
        translucent
      />
      <View style={{ backgroundColor: transparent ? 'transparent' : `${colors.bgPrimary}F2` }}>
        {headerContent}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  blurWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sp.lg,
    paddingBottom: sp.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: sp.sm,
    marginLeft: -sp.sm,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    marginRight: sp.sm,
  },
  logoTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: fontSize['2xl'],
    fontFamily: fontFamily.bodySemiBold,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.bodySemiBold,
  },
  subtitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.body,
    marginTop: 2,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
  },
  rightAction: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Header;
