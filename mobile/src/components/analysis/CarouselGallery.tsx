import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Image,
  FlatList,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Text,
  SafeAreaView,
  StatusBar,
  ViewToken,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";

interface CarouselGalleryProps {
  images: string[];
  title?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_WIDTH = SCREEN_WIDTH - sp.lg * 2;
const IMAGE_HEIGHT = IMAGE_WIDTH * 0.75;

export const CarouselGallery: React.FC<CarouselGalleryProps> = ({
  images,
  title,
}) => {
  const { colors } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const fullscreenListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const openFullscreen = useCallback((index: number) => {
    setFullscreenIndex(index);
    setFullscreenVisible(true);
  }, []);

  const onFullscreenViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setFullscreenIndex(viewableItems[0].index);
      }
    },
    [],
  );

  if (!images || images.length === 0) return null;

  const renderItem = ({ item, index }: { item: string; index: number }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => openFullscreen(index)}
      accessibilityLabel={`Image ${index + 1} sur ${images.length}${title ? ` - ${title}` : ""}`}
      accessibilityRole="image"
    >
      <Image
        source={{ uri: item }}
        style={[
          styles.image,
          {
            width: IMAGE_WIDTH,
            height: IMAGE_HEIGHT,
            borderColor: colors.border,
          },
        ]}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  const renderFullscreenItem = ({ item }: { item: string }) => (
    <View style={styles.fullscreenSlide}>
      <Image
        source={{ uri: item }}
        style={styles.fullscreenImage}
        resizeMode="contain"
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header badge */}
      <View style={[styles.headerBadge, { backgroundColor: colors.glassBg }]}>
        <Text style={styles.headerEmoji}>{"📸"}</Text>
        <Text style={[styles.headerText, { color: colors.textSecondary }]}>
          Photo Mode
        </Text>
        <Text style={[styles.headerCount, { color: colors.textTertiary }]}>
          {images.length} photo{images.length > 1 ? "s" : ""}
        </Text>
      </View>

      {/* Carousel */}
      <FlatList
        data={images}
        renderItem={renderItem}
        keyExtractor={(_, index) => `carousel-${index}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={IMAGE_WIDTH + sp.sm}
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        ItemSeparatorComponent={() => <View style={{ width: sp.sm }} />}
      />

      {/* Pagination dots */}
      {images.length > 1 && (
        <View style={styles.dotsContainer}>
          {images.map((_, index) => (
            <View
              key={`dot-${index}`}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    index === activeIndex
                      ? colors.accentPrimary
                      : colors.textMuted,
                  width: index === activeIndex ? 16 : 6,
                },
              ]}
            />
          ))}
        </View>
      )}

      {/* Fullscreen modal */}
      <Modal
        visible={fullscreenVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenVisible(false)}
        statusBarTranslucent
      >
        <SafeAreaView style={styles.fullscreenContainer}>
          <StatusBar hidden />

          {/* Close button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setFullscreenVisible(false)}
            accessibilityLabel="Fermer"
            accessibilityRole="button"
          >
            <Text style={styles.closeText}>{"✕"}</Text>
          </TouchableOpacity>

          {/* Counter */}
          <View style={styles.counterContainer}>
            <Text style={styles.counterText}>
              {fullscreenIndex + 1} / {images.length}
            </Text>
          </View>

          {/* Fullscreen carousel */}
          <FlatList
            ref={fullscreenListRef}
            data={images}
            renderItem={renderFullscreenItem}
            keyExtractor={(_, index) => `fullscreen-${index}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={fullscreenIndex}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            onViewableItemsChanged={onFullscreenViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: sp.sm,
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs,
    borderRadius: borderRadius.full,
    gap: sp.xs,
    marginBottom: sp.sm,
  },
  headerEmoji: {
    fontSize: fontSize.sm,
  },
  headerText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },
  headerCount: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },
  listContent: {
    paddingHorizontal: sp.lg,
  },
  image: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: sp.xs,
    marginTop: sp.sm,
  },
  dot: {
    height: 6,
    borderRadius: borderRadius.full,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
  },
  closeButton: {
    position: "absolute",
    top: sp["3xl"] + sp.lg,
    right: sp.lg,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeText: {
    color: "#ffffff",
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bodyBold,
  },
  counterContainer: {
    position: "absolute",
    top: sp["3xl"] + sp.lg,
    left: sp.lg,
    zIndex: 10,
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs,
    borderRadius: borderRadius.full,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  counterText: {
    color: "#ffffff",
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bodyMedium,
  },
  fullscreenSlide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: "100%",
  },
});

export default CarouselGallery;
