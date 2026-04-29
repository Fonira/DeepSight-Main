/**
 * ExportMenu — Dropdown menu for exporting analyses
 * Supports PDF, Markdown, Text, and Audio (plan-gated) formats.
 */

import React, { useState, useCallback } from "react";
import {
  FileText,
  FileCode,
  AlignLeft,
  Headphones,
  Download,
  Lock,
} from "lucide-react";
import { Dropdown, DropdownItem } from "../ui/Dropdown";
import { DeepSightSpinnerMicro } from "../ui/DeepSightSpinner";
import { useToast } from "../Toast";
import { videoApi, API_URL } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../contexts/LanguageContext";

interface ExportMenuProps {
  summaryId: number;
  videoTitle: string;
  onAudioReady?: (audioUrl: string) => void;
}

type ExportFormat = "pdf" | "md" | "txt" | "audio";

export const ExportMenu: React.FC<ExportMenuProps> = ({
  summaryId,
  videoTitle,
  onAudioReady,
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { showToast, ToastComponent } = useToast();
  const [loadingFormat, setLoadingFormat] = useState<ExportFormat | null>(null);

  const userPlan = user?.plan || "free";
  const canExportAudio = userPlan !== "free";
  // Free users get a watermark on all exports — show notice + upgrade link
  const isFreePlan = userPlan === "free";

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (format === "audio" && !canExportAudio) {
        showToast(
          "L'export audio est disponible à partir du plan Pro",
          "warning",
        );
        return;
      }

      setLoadingFormat(format);

      try {
        if (format === "audio") {
          const result = await videoApi.exportAudio(summaryId);
          const audioUrl = `${API_URL}${result.audio_url}`;
          if (onAudioReady) {
            onAudioReady(audioUrl);
          }
          showToast("Export audio prêt", "success");
        } else {
          const formatMap: Record<string, "pdf" | "md" | "txt"> = {
            pdf: "pdf",
            md: "md",
            txt: "txt",
          };
          const blob = await videoApi.exportSummary(
            summaryId,
            formatMap[format],
          );
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const extMap: Record<string, string> = {
            pdf: "pdf",
            md: "md",
            txt: "txt",
          };
          a.download = `DeepSight - ${videoTitle || "analyse"}.${extMap[format]}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          const nameMap: Record<string, string> = {
            pdf: "PDF",
            md: "Markdown",
            txt: "Texte",
          };
          showToast(`Export ${nameMap[format]} téléchargé`, "success");
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erreur lors de l'export";
        showToast(message, "error");
      } finally {
        setLoadingFormat(null);
      }
    },
    [summaryId, videoTitle, canExportAudio, onAudioReady, showToast],
  );

  const items: DropdownItem[] = [
    {
      id: "pdf",
      label: "PDF",
      description: "Export professionnel mis en page",
      icon:
        loadingFormat === "pdf" ? (
          <DeepSightSpinnerMicro />
        ) : (
          <FileText className="w-4 h-4" />
        ),
      disabled: loadingFormat !== null,
    },
    {
      id: "md",
      label: "Markdown",
      description: "Format éditable",
      icon:
        loadingFormat === "md" ? (
          <DeepSightSpinnerMicro />
        ) : (
          <FileCode className="w-4 h-4" />
        ),
      disabled: loadingFormat !== null,
    },
    {
      id: "txt",
      label: "Texte brut",
      description: "Copier-coller universel",
      icon:
        loadingFormat === "txt" ? (
          <DeepSightSpinnerMicro />
        ) : (
          <AlignLeft className="w-4 h-4" />
        ),
      disabled: loadingFormat !== null,
    },
    // Watermark notice for free users (clickable -> /upgrade)
    ...(isFreePlan
      ? ([
          { id: "divider-watermark", label: "", divider: true },
          {
            id: "watermark-notice",
            label: t("export.watermark.noticeFree"),
            description: t("export.watermark.upgradeLink"),
            icon: <Lock className="w-4 h-4" />,
            disabled: false,
          },
        ] as DropdownItem[])
      : []),
    { id: "divider-audio", label: "", divider: true },
    {
      id: "audio",
      label: canExportAudio ? "Audio" : "Audio (Pro+)",
      description: canExportAudio
        ? "Écouter l'analyse"
        : "Disponible à partir du plan Pro",
      icon:
        loadingFormat === "audio" ? (
          <DeepSightSpinnerMicro />
        ) : canExportAudio ? (
          <Headphones className="w-4 h-4" />
        ) : (
          <Lock className="w-4 h-4" />
        ),
      disabled: loadingFormat !== null || !canExportAudio,
    },
  ];

  const trigger = (
    <button
      className={`
        flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg
        transition-colors duration-150
        ${
          loadingFormat
            ? "bg-accent-primary/10 text-accent-primary cursor-wait"
            : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
        }
      `}
      disabled={loadingFormat !== null}
    >
      {loadingFormat ? (
        <DeepSightSpinnerMicro />
      ) : (
        <Download className="w-4 h-4" />
      )}
      <span className="hidden sm:inline">Exporter</span>
    </button>
  );

  return (
    <>
      <Dropdown
        trigger={trigger}
        items={items}
        onSelect={(id) => {
          if (id === "watermark-notice") {
            window.location.href = "/upgrade";
            return;
          }
          handleExport(id as ExportFormat);
        }}
        align="right"
        width="w-64"
      />
      {ToastComponent}
    </>
  );
};
