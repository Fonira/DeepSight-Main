/**
 * ExportMenu - Menu d'export d'une analyse au format PDF / Markdown / Texte.
 *
 * Télécharge le contenu via `exportsApi`, écrit dans FileSystem.documentDirectory,
 * puis ouvre le menu de partage natif via `expo-sharing`.
 *
 * Plan gating :
 * - PDF & Markdown : plan Pro+ (plus)
 * - Texte simple : accessible à tous
 */

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../contexts/ThemeContext";
import { usePlan } from "../../contexts/PlanContext";
import { exportsApi } from "../../services/api";

export interface ExportMenuProps {
  summaryId: number;
  videoTitle: string;
  visible: boolean;
  onClose: () => void;
}

type ExportFormat = "pdf" | "markdown" | "text";

interface ExportOptionConfig {
  id: ExportFormat;
  icon: keyof typeof Ionicons.glyphMap;
  emoji: string;
  label: string;
  description: string;
  extension: string;
  mimeType: string;
  requiresPro: boolean;
}

const EXPORT_OPTIONS: ExportOptionConfig[] = [
  {
    id: "pdf",
    icon: "document-text",
    emoji: "📄",
    label: "PDF",
    description: "Document formaté prêt à imprimer",
    extension: "pdf",
    mimeType: "application/pdf",
    requiresPro: true,
  },
  {
    id: "markdown",
    icon: "code-slash",
    emoji: "📝",
    label: "Markdown (.md)",
    description: "Texte structuré avec mise en forme",
    extension: "md",
    mimeType: "text/markdown",
    requiresPro: true,
  },
  {
    id: "text",
    icon: "document-outline",
    emoji: "📃",
    label: "Texte simple (.txt)",
    description: "Texte brut sans mise en forme",
    extension: "txt",
    mimeType: "text/plain",
    requiresPro: false,
  },
];

/** Nettoie un titre de vidéo pour en faire un nom de fichier sûr. */
function makeSafeFilename(title: string, extension: string): string {
  const safe = (title || "analyse")
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  const base = safe.length > 0 ? safe : "analyse";
  return `${base}.${extension}`;
}

/** Convertit un Blob en string base64 (sans le préfixe data:). */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error ?? new Error("FileReader error"));
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Invalid FileReader result"));
        return;
      }
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

/** Crée une instance File dans le document directory, en overwrite si besoin. */
function makeTargetFile(filename: string): File {
  const file = new File(Paths.document, filename);
  if (file.exists) {
    try {
      file.delete();
    } catch {
      // Best effort — la création suivante lèvera si besoin
    }
  }
  return file;
}

const ExportMenu: React.FC<ExportMenuProps> = ({
  summaryId,
  videoTitle,
  visible,
  onClose,
}) => {
  const { colors } = useTheme();
  const { features, canUseFeature } = usePlan();
  const [loadingFormat, setLoadingFormat] = useState<ExportFormat | null>(null);
  const [errorFormat, setErrorFormat] = useState<ExportFormat | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const exportEnabled = canUseFeature("exportEnabled");
  const allowedFormats = features.exportFormats;

  const triggerHaptic = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics can fail silently on some devices
    }
  }, []);

  const handleClose = useCallback(() => {
    if (loadingFormat) return;
    setErrorFormat(null);
    setErrorMessage(null);
    onClose();
  }, [loadingFormat, onClose]);

  const performExport = useCallback(
    async (option: ExportOptionConfig) => {
      await triggerHaptic();

      // Plan gating : si la feature n'est pas autorisée, on ne tente pas l'export
      const formatAllowed = allowedFormats.includes(option.id);
      const requiresGating =
        option.requiresPro && (!exportEnabled || !formatAllowed);
      if (requiresGating) {
        setErrorFormat(option.id);
        setErrorMessage(
          "Ce format nécessite un forfait Pro. Passez au plan Pro depuis l'app web pour l'activer.",
        );
        return;
      }

      if (!(await Sharing.isAvailableAsync())) {
        setErrorFormat(option.id);
        setErrorMessage("Le partage n'est pas disponible sur cet appareil.");
        return;
      }

      setLoadingFormat(option.id);
      setErrorFormat(null);
      setErrorMessage(null);

      const filename = makeSafeFilename(videoTitle, option.extension);
      const file = makeTargetFile(filename);

      try {
        file.create();

        if (option.id === "pdf") {
          const blob = await exportsApi.pdf(summaryId);
          const base64 = await blobToBase64(blob);
          file.write(base64, { encoding: "base64" });
        } else {
          const content =
            option.id === "markdown"
              ? await exportsApi.markdown(summaryId)
              : await exportsApi.text(summaryId);
          if (!content) {
            throw new Error("Réponse d'export vide");
          }
          file.write(content, { encoding: "utf8" });
        }

        await Sharing.shareAsync(file.uri, {
          mimeType: option.mimeType,
          dialogTitle: "Exporter l'analyse",
          UTI:
            option.id === "pdf"
              ? "com.adobe.pdf"
              : option.id === "markdown"
                ? "net.daringfireball.markdown"
                : "public.plain-text",
        });

        setLoadingFormat(null);
        onClose();
      } catch (error) {
        if (__DEV__) {
          console.error("[ExportMenu] Export failed:", error);
        }
        setLoadingFormat(null);
        setErrorFormat(option.id);
        setErrorMessage(
          error instanceof Error && error.message
            ? `Échec de l'export : ${error.message}`
            : "Échec de l'export. Vérifiez votre connexion et réessayez.",
        );
      }
    },
    [
      allowedFormats,
      exportEnabled,
      onClose,
      summaryId,
      triggerHaptic,
      videoTitle,
    ],
  );

  const handleRetry = useCallback(() => {
    if (!errorFormat) return;
    const option = EXPORT_OPTIONS.find((o) => o.id === errorFormat);
    if (option) {
      performExport(option);
    }
  }, [errorFormat, performExport]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        onPress={handleClose}
      >
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bgSecondary,
              borderColor: colors.borderLight,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle}>
            <View
              style={[
                styles.handleBar,
                { backgroundColor: colors.borderLight },
              ]}
            />
          </View>

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Exporter l'analyse
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              disabled={loadingFormat !== null}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text
            style={[styles.subtitle, { color: colors.textTertiary }]}
            numberOfLines={2}
          >
            {videoTitle}
          </Text>

          <View style={styles.options}>
            {EXPORT_OPTIONS.map((option, index) => {
              const isLoading = loadingFormat === option.id;
              const isGated =
                option.requiresPro &&
                (!exportEnabled || !allowedFormats.includes(option.id));
              const isDisabled =
                loadingFormat !== null && loadingFormat !== option.id;

              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.option,
                    {
                      borderTopColor: colors.borderLight,
                      borderTopWidth:
                        index === 0 ? 0 : StyleSheet.hairlineWidth,
                      opacity: isDisabled ? 0.4 : 1,
                    },
                  ]}
                  onPress={() => performExport(option)}
                  disabled={isLoading || isDisabled}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Exporter au format ${option.label}`}
                  accessibilityState={{ disabled: isDisabled || isLoading }}
                >
                  <View
                    style={[
                      styles.iconWrap,
                      {
                        backgroundColor: isGated
                          ? colors.bgTertiary
                          : colors.glassBg,
                        borderColor: isGated
                          ? colors.borderLight
                          : colors.glassBorder,
                      },
                    ]}
                  >
                    <Text style={styles.emoji}>{option.emoji}</Text>
                  </View>
                  <View style={styles.optionText}>
                    <View style={styles.labelRow}>
                      <Text
                        style={[
                          styles.optionLabel,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {option.label}
                      </Text>
                      {isGated ? (
                        <View
                          style={[
                            styles.proBadge,
                            { backgroundColor: colors.accentPrimary },
                          ]}
                        >
                          <Text style={styles.proBadgeText}>PRO</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.optionDescription,
                        { color: colors.textTertiary },
                      ]}
                      numberOfLines={1}
                    >
                      {isGated
                        ? "Disponible avec le plan Pro"
                        : option.description}
                    </Text>
                  </View>
                  {isLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.accentPrimary}
                    />
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={colors.textMuted}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {errorMessage ? (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: colors.glassBg,
                  borderColor: colors.accentError,
                },
              ]}
            >
              <Ionicons
                name="alert-circle"
                size={18}
                color={colors.accentError}
              />
              <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                {errorMessage}
              </Text>
              {errorFormat &&
              EXPORT_OPTIONS.find((o) => o.id === errorFormat)?.requiresPro &&
              !canUseFeature("exportEnabled") ? null : (
                <TouchableOpacity
                  onPress={handleRetry}
                  accessibilityRole="button"
                  accessibilityLabel="Réessayer l'export"
                >
                  <Text
                    style={[styles.retryText, { color: colors.accentPrimary }]}
                  >
                    Réessayer
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          <Text style={[styles.footerHint, { color: colors.textMuted }]}>
            Le fichier sera ouvert dans le menu de partage de{" "}
            {Platform.OS === "ios" ? "iOS" : "Android"}.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  handle: {
    alignItems: "center",
    paddingVertical: 8,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    paddingBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 16,
    marginTop: 2,
  },
  options: {
    borderRadius: 16,
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    height: 64,
    paddingHorizontal: 4,
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 22,
  },
  optionText: {
    flex: 1,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  optionDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  proBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  errorBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  retryText: {
    fontSize: 13,
    fontWeight: "600",
  },
  footerHint: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 16,
  },
});

export default ExportMenu;
export { ExportMenu };
