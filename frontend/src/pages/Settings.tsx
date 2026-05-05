/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  DEEP SIGHT v6.2 — Settings Page (Simplified)                                 ║
 * ║  Paramètres de l'application: thème, langue, notifications, préférences       ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useCallback } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import { Sidebar } from "../components/layout/Sidebar";
import {
  Settings as SettingsIcon,
  Globe,
  Moon,
  Sun,
  Bell,
  BellOff,
  Keyboard,
  Info,
  Check,
  RotateCcw,
  Sparkles,
  BookOpen,
  Monitor,
  Download,
  ExternalLink,
  Palette,
  SlidersHorizontal,
  Volume2,
} from "lucide-react";
import { useTTSContext } from "../contexts/TTSContext";
import { ThemeToggle } from "../components/ThemeToggle";
import { useToast } from "../components/Toast";
import DoodleBackground from "../components/DoodleBackground";
import { SEO } from "../components/SEO";
import { DeepSightSpinnerSmall } from "../components/ui/DeepSightSpinner";

const VoiceSettingsPanel = React.lazy(
  () => import("../components/voice/VoiceSettings"),
);

// ═══════════════════════════════════════════════════════════════════════════════
// 🎛️ Types
// ═══════════════════════════════════════════════════════════════════════════════

interface Preferences {
  notifications: boolean;
  autoPlay: boolean;
  defaultMode: string;
  compactView: boolean;
  showTournesol: boolean;
  reduceMotion: boolean;
  autoSave: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 Component
// ═══════════════════════════════════════════════════════════════════════════════

export const Settings: React.FC = () => {
  const { language } = useTranslation();
  const { setLanguage } = useLanguage();
  const { isDark } = useTheme();
  const { autoPlayEnabled, setAutoPlayEnabled } = useTTSContext();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Préférences locales (stockées dans localStorage)
  const [preferences, setPreferences] = useState<Preferences>(() => ({
    notifications: localStorage.getItem("deepsight_notifications") !== "false",
    autoPlay: localStorage.getItem("deepsight_autoplay") !== "false",
    defaultMode: localStorage.getItem("deepsight_default_mode") || "standard",
    compactView: localStorage.getItem("deepsight_compact") === "true",
    showTournesol: localStorage.getItem("deepsight_tournesol") !== "false",
    reduceMotion: localStorage.getItem("deepsight_reduce_motion") === "true",
    autoSave: localStorage.getItem("deepsight_autosave") !== "false",
  }));

  // Feedback de sauvegarde
  const [saved, setSaved] = useState<string | null>(null);
  const { showToast, ToastComponent } = useToast();

  // Helper pour les traductions inline
  const tr = useCallback(
    (fr: string, en: string) => (language === "fr" ? fr : en),
    [language],
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 💾 Save Preference
  // ─────────────────────────────────────────────────────────────────────────────

  const savePreference = useCallback(
    (key: keyof Preferences, value: boolean | string) => {
      localStorage.setItem(`deepsight_${key}`, String(value));
      setPreferences((prev) => ({ ...prev, [key]: value }));
      setSaved(key);
      setTimeout(() => setSaved(null), 1500);
      showToast(
        language === "fr" ? "Paramètre sauvegardé" : "Setting saved",
        "success",
      );
    },
    [showToast, language],
  );

  const resetToDefaults = useCallback(() => {
    const defaults: Preferences = {
      notifications: true,
      autoPlay: true,
      defaultMode: "standard",
      compactView: false,
      showTournesol: true,
      reduceMotion: false,
      autoSave: true,
    };

    Object.entries(defaults).forEach(([key, value]) => {
      localStorage.setItem(`deepsight_${key}`, String(value));
    });

    setPreferences(defaults);
    setSaved("all");
    setTimeout(() => setSaved(null), 1500);
    showToast(
      language === "fr" ? "Paramètres réinitialisés" : "Settings reset",
      "success",
    );
  }, [showToast, language]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 🎨 Toggle Component
  // ─────────────────────────────────────────────────────────────────────────────

  const Toggle: React.FC<{
    enabled: boolean;
    onToggle: () => void;
    color?: string;
    saved?: boolean;
  }> = ({ enabled, onToggle, color = "bg-accent-primary", saved: isSaved }) => (
    <div className="relative flex items-center gap-2">
      {isSaved && (
        <span className="text-success text-xs flex items-center gap-1 animate-fade-in">
          <Check className="w-3 h-3" />
        </span>
      )}
      <button
        onClick={onToggle}
        className={`relative w-12 h-7 rounded-full transition-all duration-200 ${
          enabled ? color : "bg-bg-tertiary border border-border-default"
        }`}
        role="switch"
        aria-checked={enabled}
      >
        <span
          className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200 ${
            enabled ? "left-5" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 🎨 Setting Row Component
  // ─────────────────────────────────────────────────────────────────────────────

  const SettingRow: React.FC<{
    icon: React.ElementType;
    iconColor?: string;
    title: string;
    description: string;
    children: React.ReactNode;
  }> = ({
    icon: Icon,
    iconColor = "text-text-tertiary",
    title,
    description,
    children,
  }) => (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Icon className={`w-5 h-5 flex-shrink-0 ${iconColor}`} />
        <div className="min-w-0">
          <p className="font-medium text-text-primary">{title}</p>
          <p className="text-sm text-text-tertiary line-clamp-3">
            {description}
          </p>
        </div>
      </div>
      <div className="flex-shrink-0 ml-4">{children}</div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🖼️ Render
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <SEO title="Paramètres" path="/settings" />
      <DoodleBackground variant="tech" />
      {/* Hamburger mobile */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <main
        id="main-content"
        className={`transition-all duration-200 ease-out relative z-10 lg:${sidebarCollapsed ? "ml-[60px]" : "ml-[240px]"}`}
      >
        <div className="min-h-screen pt-14 lg:pt-0 p-4 sm:p-6 lg:p-8 pb-8">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <header className="mb-8">
              <h1 className="text-xl sm:text-2xl font-semibold mb-2 flex items-center gap-3 text-text-primary">
                <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center">
                  <SettingsIcon className="w-5 h-5 text-accent-primary" />
                </div>
                {tr("Paramètres", "Settings")}
              </h1>
              <p className="text-text-secondary text-sm ml-[52px]">
                {tr(
                  "Personnalisez l'apparence et le comportement de Deep Sight.",
                  "Customize the appearance and behavior of Deep Sight.",
                )}
              </p>
            </header>

            {/* Apparence */}
            <section className="card">
              <div className="panel-header">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <Palette className="w-5 h-5 text-accent-primary" />
                  {tr("Apparence", "Appearance")}
                </h2>
              </div>
              <div className="panel-body divide-y divide-border-subtle">
                {/* Thème */}
                <SettingRow
                  icon={isDark ? Moon : Sun}
                  iconColor={isDark ? "text-indigo-400" : "text-amber-500"}
                  title={tr("Thème", "Theme")}
                  description={
                    isDark
                      ? tr(
                          "Mode sombre — Confort visuel optimal",
                          "Dark mode — Optimal visual comfort",
                        )
                      : tr(
                          "Mode clair — Lumineux et épuré",
                          "Light mode — Bright and clean",
                        )
                  }
                >
                  <ThemeToggle variant="dropdown" showLabel />
                </SettingRow>

                {/* Langue */}
                <SettingRow
                  icon={Globe}
                  title={tr("Langue", "Language")}
                  description={tr(
                    "Interface et résumés générés",
                    "Interface and generated summaries",
                  )}
                >
                  <div className="flex gap-1 p-1 rounded-lg bg-bg-tertiary">
                    <button
                      onClick={() => setLanguage("fr")}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        language === "fr"
                          ? "bg-accent-primary text-gray-900 shadow-sm"
                          : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      🇫🇷 FR
                    </button>
                    <button
                      onClick={() => setLanguage("en")}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        language === "en"
                          ? "bg-accent-primary text-gray-900 shadow-sm"
                          : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      🇬🇧 EN
                    </button>
                  </div>
                </SettingRow>
              </div>
            </section>

            {/* Notifications */}
            <section className="card">
              <div className="panel-header">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <Bell className="w-5 h-5 text-accent-primary" />
                  {tr("Notifications", "Notifications")}
                </h2>
              </div>
              <div className="panel-body divide-y divide-border-subtle">
                {/* Notifications navigateur */}
                <SettingRow
                  icon={preferences.notifications ? Bell : BellOff}
                  title={tr(
                    "Notifications navigateur",
                    "Browser notifications",
                  )}
                  description={tr(
                    "Alertes quand une analyse est prête",
                    "Alerts when analysis is ready",
                  )}
                >
                  <Toggle
                    enabled={preferences.notifications}
                    onToggle={() =>
                      savePreference(
                        "notifications",
                        !preferences.notifications,
                      )
                    }
                    saved={saved === "notifications"}
                  />
                </SettingRow>
              </div>
            </section>

            {/* Lecture vocale */}
            <section className="card">
              <div className="panel-header">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-accent-primary" />
                  {tr("Lecture vocale", "Voice Playback")}
                </h2>
              </div>
              <div className="panel-body divide-y divide-border-subtle">
                <SettingRow
                  icon={Volume2}
                  iconColor="text-cyan-400"
                  title={tr("Lecture automatique", "Auto-play voice")}
                  description={tr(
                    "Les réponses du Chat IA sont lues automatiquement à voix haute",
                    "AI Chat responses are automatically read aloud",
                  )}
                >
                  <Toggle
                    enabled={autoPlayEnabled}
                    onToggle={() => setAutoPlayEnabled(!autoPlayEnabled)}
                    color="bg-cyan-500"
                    saved={saved === "ttsAutoPlay"}
                  />
                </SettingRow>
              </div>
            </section>

            {/* Préférences d'analyse */}
            <section className="card">
              <div className="panel-header">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-accent-primary" />
                  {tr("Préférences d'analyse", "Analysis Preferences")}
                </h2>
              </div>
              <div className="panel-body divide-y divide-border-subtle">
                {/* Mode par défaut */}
                <SettingRow
                  icon={BookOpen}
                  title={tr("Mode par défaut", "Default mode")}
                  description={tr(
                    "Mode de résumé préféré",
                    "Preferred summary mode",
                  )}
                >
                  <select
                    value={preferences.defaultMode}
                    onChange={(e) =>
                      savePreference("defaultMode", e.target.value)
                    }
                    className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary text-sm cursor-pointer hover:border-accent-primary/50 transition-colors"
                  >
                    <option value="accessible">
                      {tr("Express (30s)", "Express (30s)")}
                    </option>
                    <option value="standard">
                      {tr("Standard (2-4 min)", "Standard (2-4 min)")}
                    </option>
                    <option value="expert">
                      {tr("Approfondi (5-10 min)", "Deep (5-10 min)")}
                    </option>
                  </select>
                </SettingRow>

                {/* Lecture automatique */}
                <SettingRow
                  icon={Monitor}
                  title={tr("Lecture automatique", "Auto-play")}
                  description={tr(
                    "Lire les vidéos automatiquement",
                    "Play videos automatically",
                  )}
                >
                  <Toggle
                    enabled={preferences.autoPlay}
                    onToggle={() =>
                      savePreference("autoPlay", !preferences.autoPlay)
                    }
                    saved={saved === "autoPlay"}
                  />
                </SettingRow>

                {/* Score Tournesol */}
                <SettingRow
                  icon={Sparkles}
                  iconColor="text-yellow-500"
                  title={tr("Score Tournesol", "Tournesol Score")}
                  description={tr(
                    "Afficher les scores éthiques",
                    "Show ethical scores",
                  )}
                >
                  <Toggle
                    enabled={preferences.showTournesol}
                    onToggle={() =>
                      savePreference(
                        "showTournesol",
                        !preferences.showTournesol,
                      )
                    }
                    color="bg-yellow-500"
                    saved={saved === "showTournesol"}
                  />
                </SettingRow>

                {/* Sauvegarde auto */}
                <SettingRow
                  icon={Download}
                  title={tr("Sauvegarde automatique", "Auto-save")}
                  description={tr(
                    "Sauvegarder les analyses dans l'historique",
                    "Save analyses to history",
                  )}
                >
                  <Toggle
                    enabled={preferences.autoSave}
                    onToggle={() =>
                      savePreference("autoSave", !preferences.autoSave)
                    }
                    saved={saved === "autoSave"}
                  />
                </SettingRow>
              </div>
            </section>

            {/* Paramètres vocaux */}
            <section className="card">
              <div className="panel-header">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-accent-primary" />
                  {tr("Paramètres vocaux", "Voice Settings")}
                </h2>
              </div>
              <div className="panel-body">
                <React.Suspense
                  fallback={
                    <div className="flex items-center justify-center p-8">
                      <DeepSightSpinnerSmall />
                    </div>
                  }
                >
                  <VoiceSettingsPanel />
                </React.Suspense>
              </div>
            </section>

            {/* Raccourcis clavier */}
            <section className="card">
              <div className="panel-header">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <Keyboard className="w-5 h-5 text-accent-primary" />
                  {tr("Raccourcis clavier", "Keyboard Shortcuts")}
                </h2>
              </div>
              <div className="panel-body">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    {
                      key: "Ctrl+N",
                      label: tr("Nouvelle analyse", "New analysis"),
                    },
                    { key: "Ctrl+K", label: tr("Recherche", "Search") },
                    {
                      key: "Ctrl+C",
                      label: tr("Copier résumé", "Copy summary"),
                    },
                    { key: "Ctrl+E", label: tr("Exporter", "Export") },
                    { key: "Ctrl+/", label: tr("Aide", "Help") },
                    { key: "Esc", label: tr("Fermer modal", "Close modal") },
                  ].map(({ key, label }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-bg-tertiary"
                    >
                      <span className="text-sm text-text-secondary">
                        {label}
                      </span>
                      <kbd className="px-2 py-1 rounded bg-bg-primary border border-border-default text-xs font-mono text-text-tertiary">
                        {key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Réinitialiser */}
            <section className="card border-border-subtle">
              <div className="panel-body">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <RotateCcw className="w-5 h-5 text-text-tertiary" />
                    <div>
                      <p className="font-medium text-text-primary">
                        {tr("Réinitialiser les paramètres", "Reset settings")}
                      </p>
                      <p className="text-sm text-text-tertiary">
                        {tr(
                          "Restaurer les valeurs par défaut",
                          "Restore default values",
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={resetToDefaults}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-tertiary border border-border-default hover:bg-bg-hover transition-colors text-sm"
                  >
                    {saved === "all" ? (
                      <>
                        <Check className="w-4 h-4 text-success" />
                        {tr("Réinitialisé !", "Reset!")}
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        {tr("Réinitialiser", "Reset")}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>

            {/* À propos */}
            <section className="card bg-bg-tertiary/50">
              <div className="panel-body">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center">
                      <Info className="w-5 h-5 text-accent-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">
                        Deep Sight
                      </p>
                      <p className="text-sm text-text-tertiary">
                        v6.2.0 •{" "}
                        {tr(
                          "Analyse YouTube & TikTok par IA",
                          "AI-powered YouTube & TikTok analysis",
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <a
                      href="https://deepsightsynthesis.com/changelog"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-text-tertiary hover:text-accent-primary transition-colors"
                    >
                      {tr("Nouveautés", "Changelog")}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href="https://deepsightsynthesis.com/help"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-text-tertiary hover:text-accent-primary transition-colors"
                    >
                      {tr("Aide", "Help")}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Animation styles */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
      {ToastComponent}
    </div>
  );
};

export default Settings;
