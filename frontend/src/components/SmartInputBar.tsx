/**
 * 🔮 SMART INPUT BAR v4.3 - INLINE TABS
 * Barre d'entrée ultra-intelligente avec détection automatique
 *
 * ✨ FIX v4.3:
 * - Remplacement du dropdown par des tabs inline (plus de chevauchement)
 * - Bordure URL : neutre par défaut, rouge seulement après submit invalide, verte si URL YouTube valide
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  FileText,
  Search,
  BookOpen,
  Image as ImageIcon,
  X,
  Sparkles,
  Info,
  Wand2,
  Play,
  Clipboard,
  ExternalLink,
} from "lucide-react";
import { DeepSightSpinnerMicro } from "./ui";

// ═══════════════════════════════════════════════════════════════════
// 🎬 PLATFORM ICONS — YouTube & TikTok inline SVGs
// ═══════════════════════════════════════════════════════════════════

const YouTubeIcon: React.FC<{ className?: string }> = ({
  className = "w-4 h-4",
}) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z" />
  </svg>
);

const TikTokIcon: React.FC<{ className?: string }> = ({
  className = "w-4 h-4",
}) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.88-2.88 2.89 2.89 0 0 1 2.88-2.88c.28 0 .56.04.82.11v-3.5a6.37 6.37 0 0 0-.82-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.98a8.24 8.24 0 0 0 4.83 1.56V7.09a4.84 4.84 0 0 1-1.07-.4z" />
  </svg>
);

/** Renders the correct icon for a given mode */
const ModeIconRenderer: React.FC<{ mode: InputMode; className?: string }> = ({
  mode,
  className = "w-4 h-4",
}) => {
  switch (mode) {
    case "search":
      return <YouTubeIcon className={className} />;
    case "url":
      return (
        <span className="flex items-center gap-0.5">
          <YouTubeIcon className={className} />
          <TikTokIcon className={className} />
        </span>
      );
    case "text":
      return <FileText className={className} />;
    case "image":
      return <ImageIcon className={className} />;
    case "library":
      return <BookOpen className={className} />;
    default:
      return <Search className={className} />;
  }
};

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type InputMode = "url" | "text" | "search" | "library" | "image";

export interface ImageFile {
  id: string;
  data: string; // base64 sans préfixe
  mimeType: string;
  preview: string; // data URL pour l'aperçu
  filename?: string;
  size: number;
}

export interface SmartInputValue {
  mode: InputMode;
  url?: string;
  rawText?: string;
  textTitle?: string;
  textSource?: string;
  searchQuery?: string;
  searchLanguages?: string[];
  libraryQuery?: string;
  images?: ImageFile[];
  imageTitle?: string;
  imageContext?: string;
}

interface SmartInputBarProps {
  value: SmartInputValue;
  onChange: (value: SmartInputValue) => void;
  onSubmit: () => void;
  loading?: boolean;
  disabled?: boolean;
  userCredits?: number;
  language?: "fr" | "en";
  placeholder?: string;
  showLanguageSelector?: boolean;
  onQuickChat?: (url: string) => void;
  isQuickChatting?: boolean;
  onImageSubmit?: (
    images: ImageFile[],
    title?: string,
    context?: string,
  ) => void;
}

// ═══════════════════════════════════════════════════════════════════
// IMAGE HELPERS
// ═══════════════════════════════════════════════════════════════════

const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE_MB = 10;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const fileToImageFile = (file: File): Promise<ImageFile> => {
  return new Promise((resolve, reject) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      reject(new Error(`Format non supporté: ${file.type}`));
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      reject(
        new Error(
          `Image trop volumineuse: ${(file.size / 1024 / 1024).toFixed(1)} MB (max ${MAX_IMAGE_SIZE_MB} MB)`,
        ),
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve({
        id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        data: base64,
        mimeType: file.type,
        preview: dataUrl,
        filename: file.name,
        size: file.size,
      });
    };
    reader.onerror = () => reject(new Error("Erreur de lecture du fichier"));
    reader.readAsDataURL(file);
  });
};

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

// 🔧 FIX: Ajout des patterns de playlists YouTube + 🎵 TikTok
const YOUTUBE_PATTERNS = [
  /youtube\.com\/watch\?v=/i,
  /youtu\.be\//i,
  /youtube\.com\/embed\//i,
  /youtube\.com\/shorts\//i,
  /youtube\.com\/live\//i,
  // 🆕 PATTERNS PLAYLISTS
  /youtube\.com\/playlist\?list=/i,
  /youtube\.com\/watch\?.*list=/i, // vidéo avec playlist
  /[?&]list=[A-Za-z0-9_-]+/i, // paramètre list= dans l'URL
];

// 🎵 Patterns TikTok
const TIKTOK_PATTERNS = [
  /tiktok\.com\/@[\w.-]+\/video\/\d+/i,
  /vm\.tiktok\.com\/[\w-]+/i,
  /m\.tiktok\.com\/v\/\d+/i,
  /tiktok\.com\/t\/[\w-]+/i,
  /tiktok\.com\/video\/\d+/i,
];

// Tous les patterns vidéo supportés (YouTube + TikTok)
const ALL_VIDEO_PATTERNS = [...YOUTUBE_PATTERNS, ...TIKTOK_PATTERNS];

const SEARCH_LANGUAGES = [
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "pt", name: "Português", flag: "🇵🇹" },
];

// Ordre des modes dans le dropdown (search en premier)
const MODE_ORDER: InputMode[] = ["search", "url", "image", "text", "library"];

const MODE_CONFIG = {
  search: {
    icon: null, // Custom YouTube icon rendered inline
    label: { fr: "Recherche YouTube", en: "YouTube Search" },
    bgColor: "bg-red-500/10",
    textColor: "text-red-400",
    borderColor: "border-violet-500/30",
    hoverBorder: "hover:border-violet-500/50",
    focusBorder: "focus-within:border-violet-500/60",
    gradient: "from-red-600 to-red-500",
    placeholder: {
      fr: 'Recherchez un sujet: "IA", "climat", "économie"...',
      en: 'Search a topic: "AI", "climate", "economy"...',
    },
  },
  url: {
    icon: null, // Custom YouTube+TikTok icons rendered inline
    label: { fr: "URL Vidéo", en: "Video URL" },
    bgColor: "bg-emerald-500/10",
    textColor: "text-emerald-400",
    // Bordure dynamique gérée via getDynamicBorderClasses()
    borderColor: "border-border-default",
    hoverBorder: "hover:border-border-hover",
    focusBorder: "focus-within:border-accent-primary/60",
    gradient: "from-emerald-500 to-green-600",
    placeholder: {
      fr: "YouTube, TikTok... collez votre lien ici",
      en: "YouTube, TikTok... paste your link here",
    },
  },
  text: {
    icon: FileText,
    label: { fr: "Texte", en: "Text" },
    bgColor: "bg-blue-500/10",
    textColor: "text-blue-400",
    borderColor: "border-blue-500/30",
    hoverBorder: "hover:border-blue-500/50",
    focusBorder: "focus-within:border-blue-500/60",
    gradient: "from-blue-500 to-cyan-600",
    placeholder: {
      fr: "Collez votre texte ici (min. 100 caractères)",
      en: "Paste your text here (min. 100 characters)",
    },
  },
  image: {
    icon: ImageIcon,
    label: { fr: "Images", en: "Images" },
    bgColor: "bg-amber-500/10",
    textColor: "text-amber-400",
    borderColor: "border-amber-500/30",
    hoverBorder: "hover:border-amber-500/50",
    focusBorder: "focus-within:border-amber-500/60",
    gradient: "from-amber-500 to-orange-600",
    placeholder: {
      fr: "Collez des images (Ctrl+V) ou glissez-les ici...",
      en: "Paste images (Ctrl+V) or drag & drop here...",
    },
  },
  library: {
    icon: BookOpen,
    label: { fr: "Bibliothèque", en: "Library" },
    bgColor: "bg-violet-500/10",
    textColor: "text-violet-400",
    borderColor: "border-violet-500/30",
    hoverBorder: "hover:border-violet-500/50",
    focusBorder: "focus-within:border-violet-500/60",
    gradient: "from-violet-500 to-purple-600",
    placeholder: {
      fr: "Rechercher dans les analyses DeepSight...",
      en: "Search across DeepSight analyses...",
    },
  },
};

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

const detectInputMode = (input: string): InputMode => {
  if (!input || input.trim().length === 0) return "search";

  const trimmed = input.trim();

  // 🔧 FIX: Check YouTube/TikTok URL first (inclut playlists)
  for (const pattern of ALL_VIDEO_PATTERNS) {
    if (pattern.test(trimmed)) {
      return "url";
    }
  }

  // Non-video URLs → treat as search query
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return "search";
  }

  // Long text (>200 chars) → text mode
  if (trimmed.length > 200) {
    return "text";
  }

  // Short text → search mode
  return "search";
};

const getInputValue = (value: SmartInputValue): string => {
  switch (value.mode) {
    case "url":
      return value.url || "";
    case "text":
      return value.rawText || "";
    case "search":
      return value.searchQuery || "";
    case "library":
      return value.libraryQuery || "";
    case "image":
      return value.imageTitle || "";
    default:
      return "";
  }
};

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════

// Helper : teste si une URL est une URL vidéo valide (YouTube ou TikTok)
const isValidVideoUrl = (url: string): boolean => {
  if (!url || url.trim().length === 0) return false;
  return ALL_VIDEO_PATTERNS.some((pattern) => pattern.test(url.trim()));
};

// 🎵 Helper : détecte si c'est TikTok
const isTikTokUrl = (url: string): boolean => {
  if (!url || url.trim().length === 0) return false;
  return TIKTOK_PATTERNS.some((pattern) => pattern.test(url.trim()));
};

// Backward compat
const isValidYouTubeUrl = isValidVideoUrl;

const SmartInputBar: React.FC<SmartInputBarProps> = ({
  value,
  onChange,
  onSubmit,
  onQuickChat,
  onImageSubmit,
  isQuickChatting = false,
  loading = false,
  disabled = false,
  userCredits = 0,
  language = "fr",
  showLanguageSelector = true,
}) => {
  const [autoDetected, setAutoDetected] = useState(true);
  // État de soumission : la bordure rouge n'apparaît qu'après une tentative invalide
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const config = MODE_CONFIG[value.mode];
  const currentImages = value.images || [];
  const isImageMode = value.mode === "image";

  // ═══ IMAGE HANDLERS ═══
  const addImages = useCallback(
    async (files: File[]) => {
      setImageError(null);
      const remaining = MAX_IMAGES - currentImages.length;
      if (remaining <= 0) {
        setImageError(
          language === "fr"
            ? `Maximum ${MAX_IMAGES} images atteint`
            : `Maximum ${MAX_IMAGES} images reached`,
        );
        return;
      }
      const toProcess = files.slice(0, remaining);
      const newImages: ImageFile[] = [];
      for (const file of toProcess) {
        try {
          const img = await fileToImageFile(file);
          newImages.push(img);
        } catch (err: unknown) {
          setImageError(err instanceof Error ? err.message : "Erreur inconnue");
        }
      }
      if (newImages.length > 0) {
        onChange({
          ...value,
          mode: "image",
          images: [...currentImages, ...newImages],
        });
      }
    },
    [currentImages, value, onChange, language],
  );

  const removeImage = useCallback(
    (id: string) => {
      const updated = currentImages.filter((img) => img.id !== id);
      onChange({
        ...value,
        images: updated,
        mode: updated.length === 0 ? "search" : "image",
      });
    },
    [currentImages, value, onChange],
  );

  // Paste handler (capture images from clipboard)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        addImages(imageFiles);
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [addImages]);

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length > 0) addImages(files);
    },
    [addImages],
  );

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(
        Math.max(56, textareaRef.current.scrollHeight),
        200,
      );
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [value]);

  // Handle input change with auto-detection
  const handleInputChange = useCallback(
    (text: string) => {
      if (autoDetected) {
        const detectedMode = detectInputMode(text);
        const newValue: SmartInputValue = {
          ...value,
          mode: detectedMode,
          searchLanguages: value.searchLanguages || ["fr", "en"],
        };

        switch (detectedMode) {
          case "url":
            newValue.url = text;
            newValue.rawText = undefined;
            newValue.searchQuery = undefined;
            break;
          case "text":
            newValue.rawText = text;
            newValue.url = undefined;
            newValue.searchQuery = undefined;
            break;
          case "search":
            newValue.searchQuery = text;
            newValue.url = undefined;
            newValue.rawText = undefined;
            break;
        }

        onChange(newValue);
      } else {
        // Manual mode - keep current mode
        const newValue = { ...value };
        switch (value.mode) {
          case "url":
            newValue.url = text;
            break;
          case "text":
            newValue.rawText = text;
            break;
          case "search":
            newValue.searchQuery = text;
            break;
          case "library":
            newValue.libraryQuery = text;
            break;
        }
        onChange(newValue);
      }
    },
    [value, onChange, autoDetected],
  );

  // Manual mode selection — preserve each tab's input independently
  const selectMode = useCallback(
    (mode: InputMode) => {
      setAutoDetected(false);
      onChange({ ...value, mode });
    },
    [value, onChange],
  );

  // Toggle language selection
  const toggleLanguage = useCallback(
    (code: string) => {
      const current = value.searchLanguages || ["fr", "en"];
      const updated = current.includes(code)
        ? current.filter((c) => c !== code)
        : [...current, code];

      if (updated.length === 0) return; // At least one language required

      onChange({ ...value, searchLanguages: updated });
    },
    [value, onChange],
  );

  // Handle submit
  const handleSubmit = useCallback(() => {
    setHasAttemptedSubmit(true);
    if (loading || disabled) return;

    // Image mode: submit images
    if (value.mode === "image") {
      if (!currentImages.length) return;
      if (onImageSubmit) {
        onImageSubmit(currentImages, value.imageTitle, value.imageContext);
      }
      return;
    }

    const inputVal = getInputValue(value);
    if (!inputVal.trim()) return;
    onSubmit();
  }, [value, loading, disabled, onSubmit, onImageSubmit, currentImages]);

  // Keyboard handling
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  // Computed values
  const inputVal = getInputValue(value);
  const isTextMode = value.mode === "text";
  const isSearchMode = value.mode === "search";
  const isUrlMode = value.mode === "url";
  const charCount = inputVal.length;
  const imageCount = currentImages.length;

  // Bordure dynamique pour le mode URL : neutre → vert/cyan (URL valide) → rouge (soumis + invalide)
  const getDynamicBorderClasses = (): string => {
    if (!isUrlMode) {
      return `${config.borderColor} ${config.hoverBorder} ${config.focusBorder}`;
    }
    const urlValid = isValidVideoUrl(inputVal);
    if (urlValid) {
      // 🎵 Cyan pour TikTok, vert pour YouTube
      if (isTikTokUrl(inputVal)) {
        return "border-cyan-500/40 hover:border-cyan-500/60 focus-within:border-cyan-500/70";
      }
      return "border-green-500/40 hover:border-green-500/60 focus-within:border-green-500/70";
    }
    if (hasAttemptedSubmit && inputVal.trim().length > 0) {
      return "border-red-500/40 hover:border-red-500/60 focus-within:border-red-500/70";
    }
    return "border-border-default hover:border-border-hover focus-within:border-accent-primary/60";
  };
  const TEXT_MIN_CHARS = 100;
  const textTooShort =
    isTextMode && charCount > 0 && charCount < TEXT_MIN_CHARS;
  const canSubmit = isImageMode
    ? imageCount > 0 && !loading && !disabled
    : inputVal.trim().length > 0 && !loading && !disabled && !textTooShort;

  // Credit info
  const creditCost = value.mode === "search" ? 0 : 1;
  const hasEnoughCredits = creditCost === 0 || userCredits >= creditCost;

  return (
    <div className="space-y-3">
      {/* ═══ Mode Tabs — Inline, pas de dropdown ═══ */}
      <div className="flex items-center gap-2 flex-wrap">
        {MODE_ORDER.map((m) => {
          const modeConf = MODE_CONFIG[m];
          const isActive = value.mode === m;

          return (
            <button
              key={m}
              type="button"
              onClick={() => selectMode(m)}
              disabled={disabled}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? `${modeConf.bgColor} ${modeConf.textColor} ring-1 ring-current/20`
                  : "bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <ModeIconRenderer mode={m} className="w-4 h-4" />
              <span className="hidden sm:inline">
                {modeConf.label[language]}
              </span>
              <span className="sm:hidden">
                {m === "search" && "Recherche"}
                {m === "url" && "URL"}
                {m === "image" && "Images"}
                {m === "text" && "Texte"}
              </span>
            </button>
          );
        })}

        {/* Auto-detect toggle */}
        <label className="flex items-center gap-1.5 ml-auto cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoDetected}
            onChange={(e) => setAutoDetected(e.target.checked)}
            className="rounded border-border-default text-accent-primary focus:ring-accent-primary w-3.5 h-3.5"
          />
          <span className="text-xs text-text-muted hidden sm:inline">
            {language === "fr" ? "Détection auto" : "Auto-detect"}
          </span>
          <Wand2 className="w-3 h-3 text-text-muted" />
        </label>
      </div>

      {/* Main Input Area */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-xl border-2 transition-all duration-300 bg-bg-secondary ${getDynamicBorderClasses()} ${isDragOver ? "border-amber-500/60 bg-amber-500/5" : ""}`}
      >
        {/* ═══ IMAGE MODE ═══ */}
        {isImageMode ? (
          <div className="p-3 sm:p-4 space-y-3">
            {/* Drop zone / empty state */}
            {imageCount === 0 ? (
              <div
                className={`flex flex-col items-center justify-center gap-3 py-8 px-4 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                  isDragOver
                    ? "border-amber-400 bg-amber-500/10 text-amber-300"
                    : "border-border-subtle text-text-muted hover:border-amber-500/40 hover:text-amber-400"
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="w-10 h-10" />
                <div className="text-center">
                  <p className="text-sm font-medium">
                    {language === "fr"
                      ? "Collez des images (Ctrl+V), glissez-les ici, ou cliquez pour parcourir"
                      : "Paste images (Ctrl+V), drag & drop, or click to browse"}
                  </p>
                  <p className="text-xs mt-1 text-text-muted">
                    {language === "fr"
                      ? `Max ${MAX_IMAGES} images · JPEG, PNG, WebP · ${MAX_IMAGE_SIZE_MB} MB max/image`
                      : `Max ${MAX_IMAGES} images · JPEG, PNG, WebP · ${MAX_IMAGE_SIZE_MB} MB max/image`}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Image thumbnails grid */}
                <div className="flex flex-wrap gap-2">
                  {currentImages.map((img, idx) => (
                    <div
                      key={img.id}
                      className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border-subtle"
                    >
                      <img
                        src={img.preview}
                        alt={img.filename || `Image ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(img.id)}
                        className="absolute top-0.5 right-0.5 p-0.5 bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <span className="absolute bottom-0.5 left-0.5 text-[10px] bg-black/60 text-white px-1 rounded">
                        {idx + 1}
                      </span>
                    </div>
                  ))}
                  {/* Add more button */}
                  {imageCount < MAX_IMAGES && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-20 h-20 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border-subtle text-text-muted hover:border-amber-500/40 hover:text-amber-400 transition-colors"
                    >
                      <span className="text-xl">+</span>
                      <span className="text-[10px]">
                        {imageCount}/{MAX_IMAGES}
                      </span>
                    </button>
                  )}
                </div>

                {/* Title + context inputs */}
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={value.imageTitle || ""}
                    onChange={(e) =>
                      onChange({ ...value, imageTitle: e.target.value })
                    }
                    placeholder={
                      language === "fr"
                        ? "Titre (optionnel)"
                        : "Title (optional)"
                    }
                    className="flex-1 min-w-0 sm:min-w-[150px] px-3 py-2 bg-bg-tertiary border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:border-amber-500/50 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={value.imageContext || ""}
                    onChange={(e) =>
                      onChange({ ...value, imageContext: e.target.value })
                    }
                    placeholder={
                      language === "fr"
                        ? "Contexte (optionnel)"
                        : "Context (optional)"
                    }
                    className="flex-1 min-w-0 sm:min-w-[150px] px-3 py-2 bg-bg-tertiary border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:border-amber-500/50 focus:outline-none"
                  />
                </div>
              </>
            )}

            {/* Error message */}
            {imageError && <p className="text-xs text-red-400">{imageError}</p>}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) addImages(files);
                e.target.value = "";
              }}
            />

            {/* Submit row */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">
                {imageCount > 0 && (
                  <>
                    {imageCount} image{imageCount > 1 ? "s" : ""} · {creditCost}{" "}
                    {language === "fr" ? "crédit" : "credit"}
                    {imageCount > 1 && (
                      <span className="ml-1 text-amber-400/70">
                        {language === "fr"
                          ? "(liens entre images activés)"
                          : "(cross-image linking enabled)"}
                      </span>
                    )}
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || !hasEnoughCredits}
                className={`flex items-center justify-center gap-2 px-5 h-10 rounded-xl transition-all duration-200 font-semibold text-sm whitespace-nowrap ${
                  canSubmit && hasEnoughCredits
                    ? `bg-gradient-to-r ${config.gradient} text-white shadow-lg shadow-accent-primary/20 hover:shadow-xl hover:scale-[1.03] active:scale-[0.97]`
                    : "bg-bg-tertiary text-text-muted cursor-not-allowed"
                }`}
              >
                {loading ? (
                  <DeepSightSpinnerMicro />
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>
                      {language === "fr"
                        ? `Analyser · ${creditCost} crédit`
                        : `Analyze · ${creditCost} credit`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* ═══ STANDARD MODES (URL, Text, Search, Library) ═══ */
          <>
            {/* Input */}
            <div className="flex items-start gap-3 p-3 sm:p-4">
              {/* Active mode badge (compact) */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shrink-0 ${config.bgColor} ${config.textColor}`}
              >
                <ModeIconRenderer mode={value.mode} className="w-4 h-4" />
              </div>

              {/* Paste button — visible when input is empty */}
              {!inputVal && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) handleInputChange(text.trim());
                    } catch {
                      /* clipboard denied */
                    }
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-2.5 rounded-lg shrink-0 bg-surface-secondary/60 hover:bg-surface-secondary border border-border-subtle text-text-tertiary hover:text-text-secondary transition-colors text-xs min-h-[44px]"
                  title={language === "fr" ? "Coller" : "Paste"}
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {language === "fr" ? "Coller" : "Paste"}
                  </span>
                </button>
              )}

              {/* Input Area */}
              <div className="flex-1 min-w-0">
                <textarea
                  ref={textareaRef}
                  value={inputVal}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={config.placeholder[language]}
                  disabled={disabled || loading}
                  className="w-full bg-transparent border-none outline-none resize-none text-text-primary placeholder:text-text-muted text-base leading-relaxed"
                  style={{ minHeight: "24px" }}
                  rows={1}
                />
              </div>

              {/* Quick Chat Button - next to Submit */}
              {onQuickChat &&
                value.mode === "url" &&
                inputVal.trim().length > 10 &&
                !loading && (
                  <button
                    type="button"
                    onClick={() => onQuickChat(inputVal.trim())}
                    disabled={isQuickChatting}
                    className="flex items-center justify-center gap-2 px-4 h-12 rounded-xl transition-all duration-200 font-medium text-sm whitespace-nowrap bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 hover:border-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={
                      language === "fr"
                        ? "Chatter avec l'IA sans analyse (gratuit)"
                        : "Chat directly with AI (free)"
                    }
                  >
                    {isQuickChatting ? (
                      <DeepSightSpinnerMicro />
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                    )}
                    <span className="hidden sm:inline">
                      {language === "fr" ? "Chat IA" : "AI Chat"}
                    </span>
                  </button>
                )}

              {/* Submit Button — Visible & Explicit */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || !hasEnoughCredits}
                className={`flex items-center justify-center gap-2 px-5 h-12 rounded-xl transition-all duration-200 font-semibold text-sm whitespace-nowrap ${
                  canSubmit && hasEnoughCredits
                    ? `bg-gradient-to-r ${config.gradient} text-white shadow-lg shadow-accent-primary/20 hover:shadow-xl hover:scale-[1.03] active:scale-[0.97]`
                    : "bg-bg-tertiary text-text-muted cursor-not-allowed"
                }`}
              >
                {loading ? (
                  <DeepSightSpinnerMicro />
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span className="hidden sm:inline">
                      {isSearchMode
                        ? language === "fr"
                          ? "Rechercher"
                          : "Search"
                        : language === "fr"
                          ? `Analyser · ${creditCost} crédit${creditCost > 1 ? "s" : ""}`
                          : `Analyze · ${creditCost} credit${creditCost > 1 ? "s" : ""}`}
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Bottom Bar - Minimal context (credits only) */}
            {(creditCost > 0 || (isTextMode && charCount > 0)) && (
              <div className="flex items-center justify-end px-4 py-1.5 border-t border-border-subtle text-xs">
                <div className="flex items-center gap-3 text-text-muted">
                  {isTextMode && charCount > 0 && (
                    <span className={textTooShort ? "text-amber-400" : ""}>
                      {charCount.toLocaleString()}/{TEXT_MIN_CHARS}{" "}
                      {language === "fr" ? "car. min" : "min chars"}
                      {textTooShort && (
                        <span className="ml-1">
                          (
                          {language === "fr"
                            ? `encore ${TEXT_MIN_CHARS - charCount}`
                            : `${TEXT_MIN_CHARS - charCount} more`}
                          )
                        </span>
                      )}
                    </span>
                  )}
                  {creditCost > 0 && (
                    <span className={hasEnoughCredits ? "" : "text-red-400"}>
                      {creditCost} crédit{creditCost > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Expanded Options */}
      {(isTextMode || (isSearchMode && showLanguageSelector)) && (
        <div className="flex flex-wrap items-center gap-3 px-1">
          {/* Text Mode: Title & Source */}
          {isTextMode && (
            <>
              <input
                type="text"
                value={value.textTitle || ""}
                onChange={(e) =>
                  onChange({ ...value, textTitle: e.target.value })
                }
                placeholder={
                  language === "fr" ? "Titre (optionnel)" : "Title (optional)"
                }
                className="flex-1 min-w-0 sm:min-w-[150px] px-3 py-2.5 bg-bg-secondary border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:border-blue-500/50 focus:outline-none min-h-[44px]"
              />
              <input
                type="text"
                value={value.textSource || ""}
                onChange={(e) =>
                  onChange({ ...value, textSource: e.target.value })
                }
                placeholder={
                  language === "fr" ? "Source (optionnel)" : "Source (optional)"
                }
                className="flex-1 min-w-0 sm:min-w-[150px] px-3 py-2.5 bg-bg-secondary border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:border-blue-500/50 focus:outline-none min-h-[44px]"
              />
            </>
          )}

          {/* Language selector supprimé — langue gérée dans CustomizationPanel v4 */}
        </div>
      )}

      {/* Search Mode Info Banner */}
      {isSearchMode && inputVal.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 border border-violet-500/20 rounded-lg text-sm text-violet-300">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>
            {language === "fr"
              ? "La recherche utilise Invidious (sans clé API). Les meilleures vidéos seront classées par qualité académique."
              : "Search uses Invidious (no API key). Best videos will be ranked by academic quality."}
          </span>
        </div>
      )}

      {/* YouTube / TikTok browse links */}
      <div className="flex items-center gap-3 px-1 text-xs text-text-muted">
        <span>{language === "fr" ? "Parcourir" : "Browse"}</span>
        <a
          href="https://youtube.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-red-400/70 hover:text-red-400 transition-colors"
        >
          <YouTubeIcon className="w-3.5 h-3.5" /> YouTube{" "}
          <ExternalLink className="w-3 h-3" />
        </a>
        <a
          href="https://tiktok.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-text-tertiary hover:text-text-secondary transition-colors"
        >
          <TikTokIcon className="w-3.5 h-3.5" /> TikTok{" "}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};

export default SmartInputBar;
