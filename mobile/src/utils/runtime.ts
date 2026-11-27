/**
 * Environnement d'exécution de l'app.
 */
import Constants from "expo-constants";

/**
 * true dans l'app Expo Go (« storeClient ») : les modules natifs absents d'Expo Go
 * (LiveKit/WebRTC pour la voix, …) ne doivent pas y être chargés.
 * false dans un build EAS (development, preview, production).
 */
export const isExpoGo: boolean =
  (Constants.executionEnvironment as string | undefined) === "storeClient" ||
  Constants.appOwnership === "expo";
