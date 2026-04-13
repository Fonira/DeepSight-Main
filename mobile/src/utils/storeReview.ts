/**
 * Store Review — Prompt utilisateur pour noter l'app
 *
 * Conditions de déclenchement :
 * 1. ≥ 3 analyses complétées avec succès
 * 2. ≥ 3 jours depuis l'installation
 * 3. Jamais montré auparavant (ou > 90 jours depuis le dernier affichage)
 * 4. L'appareil supporte StoreReview
 *
 * Compatible iOS (SKStoreReviewController) + Android (In-App Review API)
 */

import * as StoreReview from "expo-store-review";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
  ANALYSES_COUNT: "deepsight_review_analyses_count",
  FIRST_USE_DATE: "deepsight_review_first_use",
  LAST_REVIEW_DATE: "deepsight_review_last_shown",
  HAS_REVIEWED: "deepsight_review_done",
} as const;

const MIN_ANALYSES = 3;
const MIN_DAYS_SINCE_INSTALL = 3;
const MIN_DAYS_BETWEEN_PROMPTS = 90;

/**
 * Enregistre la première utilisation si pas déjà fait
 */
export async function initStoreReview(): Promise<void> {
  try {
    const firstUse = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_USE_DATE);
    if (!firstUse) {
      await AsyncStorage.setItem(
        STORAGE_KEYS.FIRST_USE_DATE,
        new Date().toISOString(),
      );
    }
  } catch {
    // Silent fail — non-critical
  }
}

/**
 * Incrémente le compteur d'analyses réussies et tente le prompt
 */
export async function trackAnalysisComplete(): Promise<void> {
  try {
    const current = await AsyncStorage.getItem(STORAGE_KEYS.ANALYSES_COUNT);
    const count = (parseInt(current || "0", 10) || 0) + 1;
    await AsyncStorage.setItem(STORAGE_KEYS.ANALYSES_COUNT, count.toString());

    // Vérifier si on doit afficher le prompt
    if (count >= MIN_ANALYSES) {
      await maybeRequestReview();
    }
  } catch {
    // Silent fail
  }
}

/**
 * Vérifie toutes les conditions et affiche le prompt si OK
 */
async function maybeRequestReview(): Promise<void> {
  try {
    // 1. Vérifier que StoreReview est disponible
    const isAvailable = await StoreReview.isAvailableAsync();
    if (!isAvailable) return;

    // 2. Vérifier si déjà noté récemment
    const lastReview = await AsyncStorage.getItem(
      STORAGE_KEYS.LAST_REVIEW_DATE,
    );
    if (lastReview) {
      const daysSinceReview = getDaysSince(lastReview);
      if (daysSinceReview < MIN_DAYS_BETWEEN_PROMPTS) return;
    }

    // 3. Vérifier l'ancienneté de l'installation
    const firstUse = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_USE_DATE);
    if (firstUse) {
      const daysSinceInstall = getDaysSince(firstUse);
      if (daysSinceInstall < MIN_DAYS_SINCE_INSTALL) return;
    }

    // 4. Vérifier le nombre d'analyses
    const count = await AsyncStorage.getItem(STORAGE_KEYS.ANALYSES_COUNT);
    if ((parseInt(count || "0", 10) || 0) < MIN_ANALYSES) return;

    // Toutes les conditions sont remplies → afficher le prompt
    await StoreReview.requestReview();
    await AsyncStorage.setItem(
      STORAGE_KEYS.LAST_REVIEW_DATE,
      new Date().toISOString(),
    );

    if (__DEV__) {
      console.log("🌟 [StoreReview] Review prompt shown");
    }
  } catch (error) {
    if (__DEV__) {
      console.warn("⚠️ [StoreReview] Failed to request review:", error);
    }
  }
}

/**
 * Vérifie si on peut afficher le prompt (pour StoreReview natif)
 */
export async function hasAction(): Promise<boolean> {
  try {
    return await StoreReview.hasAction();
  } catch {
    return false;
  }
}

/**
 * Reset complet (pour debug/testing)
 */
export async function resetStoreReview(): Promise<void> {
  await Promise.all(
    Object.values(STORAGE_KEYS).map((key) => AsyncStorage.removeItem(key)),
  );
}

function getDaysSince(isoDate: string): number {
  const date = new Date(isoDate);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}
