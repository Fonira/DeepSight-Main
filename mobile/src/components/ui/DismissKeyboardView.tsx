/**
 * DismissKeyboardView — Wrapper qui dismiss le clavier sur tap-outside.
 *
 * Posé en racine de l'app au-dessus du `<Slot />`, il intercepte tous les taps
 * qui ne sont pas absorbés par un enfant interactif (TextInput, Pressable,
 * Button, ScrollView avec keyboardShouldPersistTaps, etc.). Lorsqu'un tap
 * "vide" est détecté, on appelle `Keyboard.dismiss()`.
 *
 * Pourquoi `Pressable` plutôt que `TouchableWithoutFeedback` ?
 * - `Pressable` propage correctement aux enfants et coopère avec le système
 *   de responder de RN sans dépendre du wrap inutile en single child.
 * - `accessible={false}` empêche le wrapper d'apparaître comme un élément
 *   focusable pour les lecteurs d'écran.
 *
 * NB : on n'utilise PAS `pointerEvents="box-none"` car on a besoin de capter
 * le tap quand il atteint le wrapper (pas absorbé en amont).
 */

import React from "react";
import { Keyboard, Pressable, StyleSheet, type ViewProps } from "react-native";

export const DismissKeyboardView: React.FC<ViewProps> = ({
  children,
  style,
  ...rest
}) => {
  return (
    <Pressable
      onPress={() => Keyboard.dismiss()}
      style={[styles.container, style]}
      accessible={false}
      android_disableSound
      android_ripple={null}
      {...rest}
    >
      {children}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});

export default DismissKeyboardView;
