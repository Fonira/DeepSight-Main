/**
 * SimpleBottomSheet - Expo Go compatible bottom sheet
 *
 * Replaces @gorhom/bottom-sheet with a Modal + Animated approach
 * that works in Expo Go without native modules.
 */

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  View,
  Modal,
  Pressable,
  Animated,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export interface SimpleBottomSheetRef {
  snapToIndex: (index: number) => void;
  close: () => void;
}

interface SimpleBottomSheetProps {
  children: React.ReactNode;
  snapPoint?: string; // e.g. '40%', '65%'
  backgroundStyle?: ViewStyle;
  handleIndicatorStyle?: ViewStyle;
  onClose?: () => void;
}

export const SimpleBottomSheet = forwardRef<
  SimpleBottomSheetRef,
  SimpleBottomSheetProps
>(
  (
    {
      children,
      snapPoint = "50%",
      backgroundStyle,
      handleIndicatorStyle,
      onClose,
    },
    ref,
  ) => {
    const [visible, setVisible] = useState(false);
    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const insets = useSafeAreaInsets();

    const open = useCallback(() => {
      setVisible(true);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 25,
          stiffness: 200,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0.5,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }, [translateY, backdropOpacity]);

    const close = useCallback(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setVisible(false);
        onClose?.();
      });
    }, [translateY, backdropOpacity, onClose]);

    useImperativeHandle(ref, () => ({
      snapToIndex: (_index: number) => open(),
      close,
    }));

    const sheetHeight = snapPoint.endsWith("%")
      ? (parseFloat(snapPoint) / 100) * SCREEN_HEIGHT
      : parseFloat(snapPoint);

    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={close}
      >
        <View style={styles.overlay}>
          {/* Backdrop */}
          <Animated.View
            style={[styles.backdrop, { opacity: backdropOpacity }]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          </Animated.View>

          {/* Sheet */}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboardView}
          >
            <Animated.View
              style={[
                styles.sheet,
                {
                  height: sheetHeight + insets.bottom,
                  paddingBottom: insets.bottom,
                  transform: [{ translateY }],
                },
                backgroundStyle,
              ]}
            >
              {/* Handle */}
              <View style={styles.handleContainer}>
                <View style={[styles.handle, handleIndicatorStyle]} />
              </View>

              {children}
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  },
);

SimpleBottomSheet.displayName = "SimpleBottomSheet";

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  keyboardView: {
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#1a1a2e",
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#666",
  },
});

export default SimpleBottomSheet;
