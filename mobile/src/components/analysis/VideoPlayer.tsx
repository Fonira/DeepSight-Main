import React, { useCallback } from 'react';
import {
  View,
  Pressable,
  Linking,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { sp, borderRadius } from '../../theme/spacing';

interface VideoPlayerProps {
  videoId: string;
  title: string;
  scrollY: SharedValue<number>;
}

const EXPANDED_HEIGHT = 200;
const COLLAPSE_START = 50;
const COLLAPSE_END = 150;

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  title,
  scrollY,
}) => {
  const { colors } = useTheme();

  const animatedStyle = useAnimatedStyle(() => {
    const height = interpolate(
      scrollY.value,
      [0, COLLAPSE_START, COLLAPSE_END],
      [EXPANDED_HEIGHT, EXPANDED_HEIGHT, 0],
      'clamp'
    );
    const opacity = interpolate(
      scrollY.value,
      [0, COLLAPSE_START, COLLAPSE_END],
      [1, 1, 0],
      'clamp'
    );
    return { height, opacity };
  });

  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  const openYouTube = useCallback(() => {
    Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`);
  }, [videoId]);

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Pressable
        onPress={openYouTube}
        style={[styles.pressable, { backgroundColor: colors.bgSecondary }]}
        accessibilityLabel={`Regarder ${title} sur YouTube`}
        accessibilityRole="button"
      >
        <Image
          source={{ uri: thumbnailUrl }}
          style={styles.thumbnail}
          contentFit="cover"
          placeholder={undefined}
          transition={200}
        />
        <View style={styles.playOverlay}>
          <View style={[styles.playButton, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
            <Ionicons name="play" size={32} color="#ffffff" />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: borderRadius.lg,
    marginHorizontal: sp.lg,
    marginBottom: sp.md,
  },
  pressable: {
    flex: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
});

export default VideoPlayer;
