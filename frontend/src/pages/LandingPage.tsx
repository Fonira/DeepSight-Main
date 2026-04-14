/**
 * DEEP SIGHT v9.0 — Premium Landing Page
 * Inspired by Linear/Vercel — gradient mesh hero, scroll animations, glassmorphism
 */

import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Brain,
  Shield,
  MessageSquare,
  FileText,
  ChevronRight,
  GraduationCap,
  Newspaper,
  ListVideo,
  Briefcase,
  AlertTriangle,
  Lightbulb,
  Globe,
  Smartphone,
  Puzzle,
  Clipboard,
  ExternalLink,
  Swords,
  CheckCircle2,
  GitMerge,
  Scale,
} from "lucide-react";
import { DeepSightSpinner } from "../components/ui/DeepSightSpinner";
import { useTranslation } from "../hooks/useTranslation";
import { useAuth } from "../hooks/useAuth";
import { SEO } from "../components/SEO";
import { demoApi } from "../services/api";
import type { DemoAnalyzeResult } from "../services/api";
import {
  DemoResultCard,
  DemoChatMini,
  DemoCTA,
  DemoFeaturesShowcase,
} from "../components/demo";
import {
  DemoAnalysisStatic,
  DemoChatStatic,
  PricingSection,
} from "../components/landing";

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const ease = [0.4, 0, 0.2, 1] as const;

const floatAnimation = {
  y: [0, -6, 0],
  transition: { duration: 3, ease: "easeInOut" as const, repeat: Infinity },
};

const ScrollReveal: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: number;
}> = ({ children, className, delay = 0 }) => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.5, ease, delay }}
    >
      {children}
    </motion.div>
  );
};

const StaggerReveal: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.08, delayChildren: 0.1 },
        },
      }}
    >
      {children}
    </motion.div>
  );
};

const StaggerItem: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <motion.div
    className={className}
    variants={{
      hidden: { opacity: 0, y: 16 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
    }}
  >
    {children}
  </motion.div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// FAQ COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const FAQItem: React.FC<{ question: string; answer: string }> = ({
  question,
  answer,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <motion.div className="border-b border-border-subtle">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left py-4 flex items-center justify-between"
      >
        <span className="text-text-primary font-medium text-sm sm:text-base">
          {question}
        </span>
        <ChevronRight
          className={`w-4 h-4 text-text-tertiary transition-transform duration-200 flex-shrink-0 ml-4 ${isOpen ? "rotate-90" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease }}
            className="overflow-hidden"
          >
            <p className="text-text-secondary text-sm pb-4 leading-relaxed">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOGO COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const Logo: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative w-10 h-10 rounded-full overflow-hidden flex items-center justify-center">
        <img
          src="/deepsight-logo-cosmic.png"
          alt="Deep Sight"
          className="w-full h-full object-cover"
        />
      </div>
      <span className="font-semibold text-sm tracking-tight text-text-primary">
        Deep Sight
      </span>
    </div>
  );
};

// Plans configuration is now in components/landing/PricingSection.tsx

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURES
// ═══════════════════════════════════════════════════════════════════════════════

const getFeatures = (language: string) => [
  {
    icon: Brain,
    title: language === "fr" ? "Synthèse méthodique" : "Methodical Synthesis",
    description:
      language === "fr"
        ? "Chaque affirmation est évaluée selon son degré de certitude : SOLIDE, PLAUSIBLE, INCERTAIN ou À VÉRIFIER. Un raisonnement structuré pour savoir exactement ce qui est fiable."
        : "Every claim is rated by certainty level: SOLID, PLAUSIBLE, UNCERTAIN or NEEDS VERIFICATION. Structured reasoning to know exactly what is reliable.",
  },
  {
    icon: Shield,
    title:
      language === "fr"
        ? "Fact-checking automatique"
        : "Automated Fact-checking",
    description:
      language === "fr"
        ? "Les affirmations sont croisées avec des sources web en temps réel. Chaque vérification cite ses références."
        : "Claims are cross-referenced with real-time web sources. Each verification cites its references.",
  },
  {
    icon: MessageSquare,
    title: language === "fr" ? "Chat contextuel" : "Contextual Chat",
    description:
      language === "fr"
        ? "Interrogez n'importe quel passage de la vidéo. L'IA répond avec des timecodes précis et le contexte de la transcription."
        : "Query any part of the video. The AI responds with precise timestamps and transcript context.",
  },
  {
    icon: FileText,
    title: language === "fr" ? "Export professionnel" : "Professional Export",
    description:
      language === "fr"
        ? "PDF structuré, Markdown pour vos notes, texte brut pour vos publications. Partagez vos analyses avec vos collaborateurs."
        : "Structured PDF, Markdown for your notes, plain text for publications. Share analyses with your collaborators.",
  },
  {
    icon: ListVideo,
    title: language === "fr" ? "Analyse de playlists" : "Playlist Analysis",
    description:
      language === "fr"
        ? "Analysez des playlists entières en une seule opération. Comparez les thèses entre vidéos et construisez une vision de corpus."
        : "Analyze entire playlists in a single operation. Compare theses across videos and build a corpus-level view.",
  },
  {
    icon: Swords,
    title: language === "fr" ? "Débat IA" : "AI Debate",
    description:
      language === "fr"
        ? "Confrontez automatiquement deux points de vue sur un même sujet avec fact-checking croisé."
        : "Automatically confront two viewpoints on the same topic with cross-referenced fact-checking.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIENCES
// ═══════════════════════════════════════════════════════════════════════════════

const getAudiences = (language: string) => [
  {
    icon: GraduationCap,
    title:
      language === "fr"
        ? "Chercheurs & Académiques"
        : "Researchers & Academics",
    description:
      language === "fr"
        ? "Analysez conférences, séminaires doctoraux et cours magistraux. Extrayez les thèses, les références et les arguments en quelques minutes."
        : "Analyze lectures, doctoral seminars and academic courses. Extract theses, references and arguments in minutes.",
  },
  {
    icon: Newspaper,
    title:
      language === "fr"
        ? "Journalistes & Fact-checkers"
        : "Journalists & Fact-checkers",
    description:
      language === "fr"
        ? "Vérifiez les affirmations, extrayez les citations avec timecodes, croisez les sources. Un assistant d'investigation rigoureux."
        : "Verify claims, extract timestamped quotes, cross-reference sources. A rigorous investigative assistant.",
  },
  {
    icon: GraduationCap,
    title: language === "fr" ? "Étudiants" : "Students",
    description:
      language === "fr"
        ? "Flashcards générées automatiquement, cartes mentales, synthèses structurées. Révisez vos cours vidéo deux fois plus vite."
        : "Auto-generated flashcards, mind maps, structured summaries. Review your video courses twice as fast.",
  },
  {
    icon: Briefcase,
    title:
      language === "fr"
        ? "Créateurs & Professionnels"
        : "Creators & Professionals",
    description:
      language === "fr"
        ? "Veille concurrentielle, recherche de contenu, synthèse de webinaires. Transformez des heures de vidéo en insights exploitables."
        : "Competitive intelligence, content research, webinar summaries. Turn hours of video into actionable insights.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// FAQ DATA
// ═══════════════════════════════════════════════════════════════════════════════

const getFAQs = (language: string) => [
  {
    question:
      language === "fr"
        ? "Comment fonctionne Deep Sight ?"
        : "How does Deep Sight work?",
    answer:
      language === "fr"
        ? "Deep Sight extrait la transcription de votre vidéo YouTube ou TikTok, puis l'analyse avec une IA française avancée. Le contenu est structuré en synthèse, points clés, arguments et contre-arguments, avec des marqueurs de certitude et une vérification méthodique des faits."
        : "Deep Sight extracts the transcript from your YouTube or TikTok video, then analyzes it with an advanced French AI. The content is structured into summaries, key points, arguments and counter-arguments, with certainty markers and methodical fact-checking.",
  },
  {
    question:
      language === "fr"
        ? "Quels types de vidéos sont supportés ?"
        : "What types of videos are supported?",
    answer:
      language === "fr"
        ? "Toute vidéo YouTube ou TikTok disposant de sous-titres (automatiques ou manuels) dans la plupart des langues. Les vidéos de conférences, cours, documentaires, interviews et podcasts donnent les meilleurs résultats. TikTok jusqu'à 10 min est supporté. La durée maximale dépend de votre plan (15 min en gratuit, jusqu'à 4h en Pro)."
        : "Any YouTube or TikTok video with subtitles (automatic or manual) in most languages. Lectures, courses, documentaries, interviews and podcasts yield the best results. TikTok up to 10 min is supported. Maximum duration depends on your plan (15 min free, up to 4h on Pro).",
  },
  {
    question:
      language === "fr"
        ? "Les analyses sont-elles fiables ?"
        : "Are the analyses reliable?",
    answer:
      language === "fr"
        ? "Deep Sight utilise des marqueurs épistémiques explicites (SOLIDE, PLAUSIBLE, INCERTAIN, A VERIFIER) pour que vous sachiez toujours le degré de certitude de chaque affirmation. Le fact-checking croise les informations avec des sources web. L'IA reste un outil d'aide : nous encourageons toujours la vérification critique par l'utilisateur."
        : "Deep Sight uses explicit epistemic markers (SOLID, PLAUSIBLE, UNCERTAIN, NEEDS VERIFICATION) so you always know the certainty level of each claim. Fact-checking cross-references information with web sources. AI remains an assistive tool: we always encourage critical verification by the user.",
  },
  {
    question:
      language === "fr"
        ? "Mes données sont-elles sécurisées ?"
        : "Is my data secure?",
    answer:
      language === "fr"
        ? "Vos données sont chiffrées en transit et au repos. Les analyses sont associées à votre compte et ne sont jamais partagées avec des tiers. Les paiements sont traités par Stripe, certifié PCI DSS. Vous pouvez supprimer vos données à tout moment depuis votre profil."
        : "Your data is encrypted in transit and at rest. Analyses are linked to your account and never shared with third parties. Payments are processed by Stripe, PCI DSS certified. You can delete your data at any time from your profile.",
  },
  {
    question:
      language === "fr"
        ? "Puis-je annuler mon abonnement ?"
        : "Can I cancel my subscription?",
    answer:
      language === "fr"
        ? "Oui, à tout moment depuis votre espace de facturation. L'annulation est immédiate et sans frais. Vous conservez l'accès à votre plan jusqu'à la fin de la période en cours."
        : "Yes, at any time from your billing dashboard. Cancellation is immediate and free of charge. You retain access to your plan until the end of the current billing period.",
  },
  {
    question:
      language === "fr"
        ? "Les TikToks sont-ils supportés ?"
        : "Are TikToks supported?",
    answer:
      language === "fr"
        ? "Oui ! Deep Sight analyse les vidéos TikTok en plus de YouTube. Collez simplement un lien TikTok et l'analyse démarre automatiquement. Les TikToks jusqu'à 10 minutes sont supportés, et consomment 50% moins de crédits que les vidéos YouTube (vidéos plus courtes = coût réduit)."
        : "Yes! Deep Sight analyzes TikTok videos in addition to YouTube. Simply paste a TikTok link and the analysis starts automatically. TikToks up to 10 minutes are supported, and use 50% fewer credits than YouTube videos (shorter videos = reduced cost).",
  },
  {
    question:
      language === "fr"
        ? "Deep Sight fonctionne-t-il sur mobile ?"
        : "Does Deep Sight work on mobile?",
    answer:
      language === "fr"
        ? "Oui. Deep Sight est disponible en application native sur iOS et Android, ainsi qu'en extension Chrome pour le navigateur. Votre compte et vos analyses sont synchronisés sur tous vos appareils."
        : "Yes. Deep Sight is available as a native app on iOS and Android, as well as a Chrome extension for your browser. Your account and analyses are synchronized across all your devices.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════════════════

const platforms = [
  { icon: Globe, label: { fr: "Deep Sight Web", en: "Deep Sight Web" } },
  { icon: Smartphone, label: { fr: "App Mobile", en: "Mobile App" } },
  {
    icon: Puzzle,
    label: {
      fr: "Extension navigateur intégrée (YouTube & TikTok)",
      en: "Browser extension (YouTube & TikTok)",
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useTranslation();
  const { user, isLoading } = useAuth();
  const lang = language as "fr" | "en";

  const features = getFeatures(language);
  const audiences = getAudiences(language);
  const faqs = getFAQs(language);

  // Guest demo state
  const MAX_GUEST_ANALYSES = 3;
  const [guestUrl, setGuestUrl] = useState("");
  const [guestLoading, setGuestLoading] = useState(false);
  const [_guestResult, setGuestResult] = useState<{
    video_title: string;
    video_channel: string;
    video_duration: number;
    thumbnail_url: string;
    summary_content: string;
    category: string;
    word_count: number;
  } | null>(null);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState(() => {
    try {
      return parseInt(localStorage.getItem("ds_guest_count") || "0", 10);
    } catch {
      return 0;
    }
  });
  const [guestRemaining, setGuestRemaining] = useState(
    () =>
      MAX_GUEST_ANALYSES -
      (parseInt(localStorage.getItem("ds_guest_count") || "0", 10) || 0),
  );
  const guestExhausted = guestRemaining <= 0;
  const guestInputRef = useRef<HTMLInputElement>(null);

  // Enhanced demo state (new ultra-short + chat)
  const [demoResult, setDemoResult] = useState<DemoAnalyzeResult | null>(null);
  const [demoChatExhausted, setDemoChatExhausted] = useState(false);
  const demoResultRef = useRef<HTMLDivElement>(null);

  const scrollToDemoResult = () => {
    setTimeout(() => {
      demoResultRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 400);
  };

  // Extract URL from clipboard text (YouTube mobile sometimes includes title + URL)
  const extractUrlFromText = (text: string): string => {
    const urlMatch = text.match(/https?:\/\/[^\s<>"']+/);
    return urlMatch ? urlMatch[0] : text.trim();
  };

  const getUrlValidationError = (url: string): string | null => {
    // Detect homepage-only URLs (user copied the page URL, not a video link)
    if (
      /^https?:\/\/(www\.)?(youtube\.com|m\.youtube\.com)\/?(\?.*)?$/.test(
        url,
      ) ||
      /^https?:\/\/(www\.)?(youtube\.com|m\.youtube\.com)\/shorts\/?(\?.*)?$/.test(
        url,
      ) ||
      /^https?:\/\/(www\.)?tiktok\.com\/?(\?.*)?$/.test(url)
    ) {
      return language === "fr"
        ? 'C\'est l\'URL de la page YouTube, pas d\'une vidéo. Ouvrez un Short, appuyez sur "Partager" puis "Copier le lien".'
        : 'This is the YouTube page URL, not a video. Open a Short, tap "Share" then "Copy link".';
    }
    // Check it's at least a YouTube/TikTok domain with a path
    if (!/(?:youtube\.com\/.+|youtu\.be\/.+|tiktok\.com\/.+)/.test(url)) {
      return language === "fr"
        ? "Collez un lien YouTube ou TikTok valide (ex: https://youtu.be/xxx)"
        : "Paste a valid YouTube or TikTok link (e.g., https://youtu.be/xxx)";
    }
    return null;
  };

  const handleGuestPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const url = extractUrlFromText(text);
        setGuestUrl(url);
        setGuestError(null);
      }
    } catch {
      // Clipboard API denied on mobile — focus input so user can paste manually
      guestInputRef.current?.focus();
    }
  };

  // Handle native paste event (long-press paste on mobile)
  const handleInputPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (text) {
      e.preventDefault();
      const url = extractUrlFromText(text);
      setGuestUrl(url);
      setGuestError(null);
    }
  };

  const handleGuestAnalyze = async () => {
    const url = guestUrl.trim();
    if (!url || guestLoading) return;
    setGuestError(null);

    // Validate URL format before calling API
    const validationError = getUrlValidationError(url);
    if (validationError) {
      setGuestError(validationError);
      return;
    }

    setGuestLoading(true);
    setDemoResult(null);
    setDemoChatExhausted(false);

    try {
      // Use new demo API (ultra-short summary + session for chat)
      const result = await demoApi.analyze(url);
      setDemoResult(result);
      scrollToDemoResult();

      // Also set legacy guestResult for backward compat
      setGuestResult({
        video_title: result.video_title,
        video_channel: result.video_channel,
        video_duration: result.video_duration,
        thumbnail_url: result.thumbnail_url,
        summary_content: result.key_points.join("\n"),
        category: result.category,
        word_count: result.key_points.join(" ").split(" ").length,
      });

      const newCount = guestCount + 1;
      setGuestCount(newCount);
      const remaining =
        result.remaining_analyses ?? MAX_GUEST_ANALYSES - newCount;
      setGuestRemaining(remaining);
      try {
        localStorage.setItem("ds_guest_count", String(newCount));
      } catch {}
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      // Rate limit
      if (
        errorMsg.includes("429") ||
        errorMsg.includes("RATE_LIMITED") ||
        errorMsg.includes("analyses gratuites")
      ) {
        setGuestRemaining(0);
        try {
          localStorage.setItem("ds_guest_count", String(MAX_GUEST_ANALYSES));
        } catch {}
      }
      // Transcript unavailable
      else if (
        errorMsg.includes("transcription") ||
        errorMsg.includes("transcript")
      ) {
        setGuestError(
          language === "fr"
            ? "Cette video n'a pas de sous-titres disponibles. Essayez une autre video."
            : "This video has no available subtitles. Try another video.",
        );
      }
      // Video too long
      else if (errorMsg.includes("5 min") || errorMsg.includes("duree")) {
        setGuestError(
          language === "fr"
            ? "La video depasse 5 minutes. L'essai gratuit est limite aux videos courtes."
            : "Video exceeds 5 minutes. Free trial is limited to short videos.",
        );
      }
      // Network / other error
      else {
        setGuestError(
          language === "fr"
            ? "Impossible d'analyser cette video. Verifiez le lien et reessayez."
            : "Unable to analyze this video. Check the link and try again.",
        );
      }
    } finally {
      setGuestLoading(false);
    }
  };

  // Redirect if logged in
  useEffect(() => {
    if (!isLoading && user) {
      navigate("/dashboard");
    }
  }, [user, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-bg-primary relative overflow-hidden">
      <SEO
        title="Analyse YouTube & TikTok par IA"
        description="Analysez et synthétisez vos vidéos YouTube et TikTok avec l'IA française. Résumés intelligents, fact-checking méthodique, points clés, timestamps, et chat interactif."
        path="/"
        keywords="DeepSight, analyse vidéo YouTube, IA, résumé YouTube, fact-checking, synthèse vidéo, TikTok analyse, Mistral AI, flashcards, quiz"
      />
      {/* FAQ Schema JSON-LD — Rich snippets Google */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: getFAQs("fr").map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer,
              },
            })),
          }),
        }}
      />
      {/* Gradient mesh background */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-accent-primary/[0.07] rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-violet-500/[0.05] rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-cyan-500/[0.04] rounded-full blur-[100px]" />
      </div>

      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-bg-primary/70 border-b border-border-subtle/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Logo />

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate("/login")}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              {language === "fr" ? "Se connecter" : "Sign in"}
            </button>
            <motion.button
              onClick={() => navigate("/login?tab=register")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-primary text-white text-sm font-medium hover:bg-accent-primary-hover transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {language === "fr" ? "Créer un compte" : "Sign up"}
            </motion.button>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative py-20 sm:py-32 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease }}
            className="mb-6"
          >
            <img
              src="/deepsight-logo-cosmic.png"
              alt="Deep Sight"
              className="h-24 w-24 sm:h-32 sm:w-32 rounded-full mx-auto object-cover"
              style={{
                filter: "drop-shadow(0 0 20px rgba(139, 92, 246, 0.4))",
              }}
            />
          </motion.div>

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-primary/10 border border-accent-primary/20 mb-8"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent-primary" />
            <span className="text-xs text-accent-primary font-medium">
              {language === "fr"
                ? "IA française & raisonnement méthodique"
                : "French AI & methodical reasoning"}
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.2 }}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-[-0.02em] leading-[1.08] mb-6"
          >
            <span className="text-text-primary">
              {language === "fr"
                ? "Ne subissez plus vos vidéos"
                : "Stop enduring your videos"}
            </span>
            <br />
            <span className="bg-gradient-to-r from-accent-primary via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              {language === "fr" ? "— interrogez-les." : "— question them."}
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.3 }}
            className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            {language === "fr"
              ? "DeepSight analyse YouTube et TikTok, vérifie chaque affirmation sur le web et répond à vos questions. Du short au cours de 3 heures, allez plus loin — ouvrez vos horizons."
              : "DeepSight analyzes YouTube and TikTok, verifies every claim on the web and answers your questions. From shorts to 3-hour lectures, go further — broaden your horizons."}
          </motion.p>

          {/* Guest Demo Input / CTA */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.4 }}
            className="mb-16 max-w-xl mx-auto"
          >
            {/* Input inline — always visible, backend enforces rate limit */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGuestPaste}
                  className="flex-shrink-0 p-3 rounded-lg bg-surface-secondary/60 border border-border-subtle hover:bg-surface-secondary transition-colors"
                  title={language === "fr" ? "Coller" : "Paste"}
                >
                  <Clipboard className="w-4 h-4 text-text-tertiary" />
                </button>
                <input
                  ref={guestInputRef}
                  type="url"
                  value={guestUrl}
                  onChange={(e) => setGuestUrl(e.target.value)}
                  onPaste={handleInputPaste}
                  onKeyDown={(e) => e.key === "Enter" && handleGuestAnalyze()}
                  placeholder={
                    language === "fr"
                      ? "Collez un lien YouTube Short ou TikTok"
                      : "Paste a YouTube Short or TikTok link"
                  }
                  className="flex-1 min-w-0 px-4 py-3 rounded-lg bg-surface-secondary/60 border border-border-subtle text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/40 focus:border-accent-primary/40 transition-all"
                  disabled={guestLoading}
                />
                {guestLoading ? (
                  <div
                    className="flex-shrink-0 flex items-center justify-center"
                    style={{ width: 48, height: 48 }}
                  >
                    <DeepSightSpinner size="sm" speed="fast" />
                  </div>
                ) : (
                  <motion.button
                    onClick={handleGuestAnalyze}
                    disabled={!guestUrl.trim()}
                    className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-accent-primary text-white text-sm font-medium hover:bg-accent-primary-hover transition-colors shadow-lg shadow-accent-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
                    animate={!guestUrl.trim() ? floatAnimation : {}}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {language === "fr" ? "Analyser" : "Analyze"}
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                )}
              </div>

              {/* Helper text + remaining + Shorts/TikTok guidance */}
              <div className="flex flex-col items-center gap-2 px-1">
                <p className="text-xs text-text-muted text-center">
                  {language === "fr"
                    ? `Essai gratuit \u2014 ${guestRemaining} analyse${guestRemaining > 1 ? "s" : ""} restante${guestRemaining > 1 ? "s" : ""}, vid\u00e9os de 5 min max`
                    : `Free trial \u2014 ${guestRemaining} analysis${guestRemaining > 1 ? "es" : ""} remaining, 5 min max videos`}
                </p>
                <div className="flex items-center gap-3">
                  <a
                    href="https://youtube.com/shorts"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors text-xs font-medium"
                  >
                    <span>▶</span> YouTube Shorts{" "}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href="https://tiktok.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors text-xs font-medium"
                  >
                    <span>♪</span> TikTok <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {guestError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-sm text-red-400 text-center"
                  >
                    {guestError}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Demo Result — Enhanced (ultra-short card + chat) */}
            <AnimatePresence>
              {demoResult && (
                <motion.div
                  ref={demoResultRef}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease }}
                  className="mt-6"
                >
                  {/* Ultra-short summary card */}
                  <DemoResultCard result={demoResult} />

                  {/* Features showcase — conversation IA vocale, flashcards, etc. */}
                  <DemoFeaturesShowcase
                    language={language}
                    onSignup={() => navigate("/login?tab=register")}
                  />

                  {/* Mini chat AI */}
                  {!demoChatExhausted && (
                    <DemoChatMini
                      demoSessionId={demoResult.demo_session_id}
                      videoTitle={demoResult.video_title}
                      onExhausted={() => setDemoChatExhausted(true)}
                    />
                  )}

                  {/* Actions: try another or CTA */}
                  {guestExhausted ? (
                    <DemoCTA type={demoChatExhausted ? "both" : "analyses"} />
                  ) : (
                    <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-surface-secondary/40 border border-border-subtle max-w-2xl mx-auto">
                      <p className="text-xs text-text-tertiary">
                        {language === "fr"
                          ? `${guestRemaining} analyse${guestRemaining > 1 ? "s" : ""} gratuite${guestRemaining > 1 ? "s" : ""} restante${guestRemaining > 1 ? "s" : ""}`
                          : `${guestRemaining} free analysis${guestRemaining > 1 ? "es" : ""} remaining`}
                      </p>
                      <div className="flex gap-2">
                        <motion.button
                          onClick={() => {
                            setGuestResult(null);
                            setDemoResult(null);
                            setGuestUrl("");
                            setGuestError(null);
                            setDemoChatExhausted(false);
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-secondary border border-border-subtle text-text-secondary text-xs font-medium hover:bg-surface-tertiary transition-colors"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {language === "fr"
                            ? "Analyser une autre video"
                            : "Analyze another video"}
                        </motion.button>
                        <motion.button
                          onClick={() => navigate("/login?tab=register")}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-xs font-medium hover:bg-accent-primary/20 transition-colors"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {language === "fr" ? "Creer un compte" : "Sign up"}
                          <ArrowRight className="w-3 h-3" />
                        </motion.button>
                      </div>
                    </div>
                  )}

                  {/* CTA after chat exhausted */}
                  {demoChatExhausted && !guestExhausted && (
                    <DemoCTA type="chat" />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Platforms */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease, delay: 0.6 }}
            className="flex items-center justify-center gap-8 sm:gap-14"
          >
            {platforms.map((platform, index) => {
              const Icon = platform.icon;
              return (
                <div
                  key={index}
                  className="text-center flex flex-col items-center gap-2 max-w-[140px]"
                >
                  <div className="w-10 h-10 rounded-xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-accent-primary" />
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-text-secondary leading-tight">
                    {platform.label[lang]}
                  </div>
                </div>
              );
            })}
          </motion.div>

          {/* Badge IA Française & Européenne */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease, delay: 0.8 }}
            className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-600/15 via-white/5 to-red-500/15 border border-blue-500/25"
          >
            <span className="text-base">🇫🇷</span>
            <span className="text-xs sm:text-sm font-medium text-text-secondary">
              {language === "fr"
                ? "IA 100% Française & Européenne — Vos données restent en Europe"
                : "100% French & European AI — Your data stays in Europe"}
            </span>
            <span className="text-base">🇪🇺</span>
          </motion.div>
        </div>
      </section>

      {/* ─── PROPULSÉ PAR MISTRAL AI + TOURNESOL ─── */}
      <section className="py-10 sm:py-16 px-4 sm:px-6">
        <ScrollReveal className="max-w-3xl mx-auto text-center">
          <p className="text-xs sm:text-sm text-text-tertiary uppercase tracking-widest mb-6">
            {language === "fr"
              ? "Plateformes & technologie"
              : "Platforms & technology"}
          </p>
          {/* Logos row: YouTube + TikTok + Tournesol + Mistral */}
          <div className="flex items-center justify-center gap-6 sm:gap-10 mb-6">
            <div className="flex flex-col items-center gap-2">
              <img
                src="/platforms/youtube-icon-red.svg"
                alt="YouTube"
                className="h-10 sm:h-14 w-auto object-contain"
                style={{ filter: "drop-shadow(0 0 12px rgba(255, 0, 0, 0.3))" }}
              />
              <span className="text-[10px] text-text-muted">YouTube</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <img
                src="/platforms/tiktok-note-color.svg"
                alt="TikTok"
                className="h-10 sm:h-14 w-auto object-contain"
                style={{
                  filter: "drop-shadow(0 0 12px rgba(37, 244, 238, 0.3))",
                }}
              />
              <span className="text-[10px] text-text-muted">TikTok</span>
            </div>
            <a
              href="https://tournesol.app"
              target="_blank"
              rel="noreferrer"
              className="flex flex-col items-center gap-2 hover:scale-105 transition-transform"
            >
              <img
                src="/platforms/tournesol-logo.png"
                alt="Tournesol"
                className="h-10 sm:h-14 w-auto object-contain"
                style={{
                  filter: "drop-shadow(0 0 12px rgba(255, 200, 0, 0.4))",
                }}
              />
              <span className="text-[10px] text-text-muted">Tournesol</span>
            </a>
            <div className="flex flex-col items-center gap-2">
              <img
                src="/mistral-logo.svg"
                alt="Mistral AI"
                className="h-10 sm:h-14 w-auto object-contain"
                style={{
                  filter: "drop-shadow(0 0 20px rgba(139, 92, 246, 0.3))",
                }}
              />
              <span className="text-[10px] text-text-muted">Mistral AI</span>
            </div>
          </div>
          <p className="text-base sm:text-lg font-semibold bg-gradient-to-r from-accent-primary via-violet-400 to-cyan-400 bg-clip-text text-transparent">
            {language === "fr"
              ? "YouTube & TikTok — Propulsé par Mistral AI & Tournesol"
              : "YouTube & TikTok — Powered by Mistral AI & Tournesol"}
          </p>
          <p className="text-xs text-text-tertiary mt-2 max-w-md mx-auto">
            {language === "fr"
              ? "IA 100% fran\u00e7aise (Mistral AI) et recommandations \u00e9thiques (Tournesol) pour des analyses souveraines et fiables."
              : "French AI (Mistral AI) and ethical recommendations (Tournesol) for sovereign and reliable analyses."}
          </p>
        </ScrollReveal>
      </section>

      {/* ─── PROBLEM / SOLUTION ─── */}
      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {/* Problem */}
              <div className="p-5 sm:p-8 rounded-2xl border border-red-500/20 bg-red-500/[0.04]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">
                    {language === "fr" ? "Le problème" : "The Problem"}
                  </h3>
                </div>
                <div className="space-y-3">
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {language === "fr"
                      ? "Des heures de contenu vidéo, pas le temps de tout regarder. Des affirmations impossibles à vérifier en temps réel. Des connaissances qui se perdent faute de prise de notes structurée."
                      : "Hours of video content, no time to watch everything. Claims impossible to verify in real time. Knowledge lost due to lack of structured note-taking."}
                  </p>
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {language === "fr"
                      ? "YouTube et TikTok sont les plus grandes bibliothèques vidéo du monde, mais sans index, sans vérification et sans synthèse."
                      : "YouTube and TikTok are the world's largest video libraries, but with no index, no verification and no synthesis."}
                  </p>
                </div>
              </div>

              {/* Solution */}
              <div className="p-5 sm:p-8 rounded-2xl border border-accent-primary/20 bg-accent-primary/[0.04]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-accent-primary/10 flex items-center justify-center">
                    <Lightbulb className="w-5 h-5 text-accent-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">
                    {language === "fr" ? "La solution" : "The Solution"}
                  </h3>
                </div>
                <div className="space-y-3">
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {language === "fr"
                      ? "Deep Sight lit, analyse et structure le contenu pour vous. Chaque affirmation est évaluée, chaque source est vérifiable, chaque synthèse est exportable."
                      : "Deep Sight reads, analyzes and structures the content for you. Every claim is evaluated, every source is verifiable, every summary is exportable."}
                  </p>
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {language === "fr"
                      ? "Concentrez-vous sur la compréhension. L'extraction, c'est notre travail."
                      : "Focus on understanding. Extraction is our job."}
                  </p>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── DEMO INTERACTIVE ─── */}
      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <DemoAnalysisStatic language={language} />
          <DemoChatStatic language={language} />
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary mb-3">
              {language === "fr"
                ? "Une analyse qui va au fond des choses"
                : "Analysis that goes beyond the surface"}
            </h2>
            <p className="text-text-secondary text-sm sm:text-base max-w-xl mx-auto">
              {language === "fr"
                ? "Pas de résumé superficiel. Deep Sight évalue la fiabilité, identifie les biais et structure l'argumentation de chaque vidéo."
                : "No superficial summaries. Deep Sight evaluates reliability, identifies biases and structures the argumentation of each video."}
            </p>
          </ScrollReveal>

          <StaggerReveal className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature) => (
              <StaggerItem key={feature.title}>
                <div className="group p-5 rounded-xl border border-border-subtle bg-bg-secondary/40 backdrop-blur-sm hover:border-accent-primary/30 hover:bg-bg-secondary/70 transition-all duration-200 h-full">
                  <div className="w-10 h-10 rounded-lg bg-accent-primary/10 flex items-center justify-center mb-4 group-hover:bg-accent-primary/15 transition-colors">
                    <feature.icon className="w-5 h-5 text-accent-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary mb-1.5">
                    {feature.title}
                  </h3>
                  <p className="text-text-tertiary text-xs leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerReveal>
        </div>
      </section>

      {/* ─── AUDIENCES ─── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary mb-3">
              {language === "fr"
                ? "Pour ceux qui exigent la rigueur"
                : "For those who demand rigor"}
            </h2>
            <p className="text-text-secondary text-sm sm:text-base max-w-lg mx-auto">
              {language === "fr"
                ? "Chercheurs, journalistes, étudiants ou professionnels : Deep Sight s'adapte à votre niveau d'exigence."
                : "Researchers, journalists, students or professionals: Deep Sight adapts to your level of demand."}
            </p>
          </ScrollReveal>

          <StaggerReveal className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {audiences.map((audience) => (
              <StaggerItem key={audience.title} className="text-center">
                <div className="w-14 h-14 rounded-xl bg-bg-tertiary border border-border-subtle flex items-center justify-center mx-auto mb-5">
                  <audience.icon className="w-6 h-6 text-accent-primary" />
                </div>
                <h3 className="text-base font-semibold text-text-primary mb-2">
                  {audience.title}
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed max-w-xs mx-auto">
                  {audience.description}
                </p>
              </StaggerItem>
            ))}
          </StaggerReveal>
        </div>
      </section>

      {/* ─── DÉBAT IA ─── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 relative">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal className="text-center mb-12 sm:mb-16 relative">
            {/* Badge "Nouveau" */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 mb-6"
            >
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span className="text-xs font-semibold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                {language === "fr" ? "Nouveau" : "New"}
              </span>
            </motion.div>

            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary mb-3">
              {language === "fr"
                ? "Débat IA — Confrontez les perspectives"
                : "AI Debate — Confront perspectives"}
            </h2>
            <p className="text-text-secondary text-sm sm:text-base max-w-2xl mx-auto">
              {language === "fr"
                ? "Collez une URL, notre IA trouve automatiquement une vidéo avec un point de vue opposé et génère une analyse comparative sourcée."
                : "Paste a URL, our AI automatically finds a video with an opposing viewpoint and generates a sourced comparative analysis."}
            </p>
          </ScrollReveal>

          {/* Mock debate layout */}
          <ScrollReveal>
            <div className="rounded-2xl border border-border-subtle bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8 overflow-hidden relative">
              {/* Gradient glow behind */}
              <div
                className="absolute inset-0 pointer-events-none"
                aria-hidden="true"
              >
                <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-48 h-48 bg-indigo-500/10 rounded-full blur-[80px]" />
                <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-48 h-48 bg-violet-500/10 rounded-full blur-[80px]" />
              </div>

              {/* VS Layout */}
              <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 lg:gap-4 items-start">
                {/* Video A */}
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                  className="rounded-xl bg-white/5 border border-indigo-500/20 p-5 space-y-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-indigo-400">
                        A
                      </span>
                    </div>
                    <span className="text-xs text-indigo-400 font-medium">
                      {language === "fr" ? "Vidéo A" : "Video A"}
                    </span>
                  </div>
                  <div className="w-full aspect-video rounded-lg bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border border-white/5 flex items-center justify-center">
                    <div className="text-center px-4">
                      <p className="text-xs text-white/40 mb-1">
                        TechVision — 24 min
                      </p>
                      <p className="text-sm font-medium text-white/80">
                        {language === "fr"
                          ? "L'IA va augmenter les développeurs"
                          : "AI will augment developers"}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-indigo-500/5 border border-indigo-500/15 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-indigo-400/70 mb-1">
                      {language === "fr" ? "Thèse" : "Thesis"}
                    </p>
                    <p className="text-xs text-white/70 leading-relaxed">
                      {language === "fr"
                        ? "« L'IA est un outil de productivité qui augmente les capacités des développeurs sans les remplacer. »"
                        : '"AI is a productivity tool that augments developer capabilities without replacing them."'}
                    </p>
                  </div>
                </motion.div>

                {/* VS Circle */}
                <div className="flex items-center justify-center lg:pt-16">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    whileInView={{ scale: 1, rotate: 0 }}
                    viewport={{ once: true }}
                    transition={{
                      delay: 0.3,
                      duration: 0.5,
                      type: "spring",
                      stiffness: 200,
                    }}
                    className="relative"
                  >
                    <motion.div
                      className="absolute inset-0 rounded-full bg-white/10"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                    <div className="relative w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 border border-white/10">
                      <span className="text-white font-bold text-lg lg:text-xl tracking-tight">
                        VS
                      </span>
                    </div>
                  </motion.div>
                </div>

                {/* Video B */}
                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                  className="rounded-xl bg-white/5 border border-violet-500/20 p-5 space-y-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-violet-400">
                        B
                      </span>
                    </div>
                    <span className="text-xs text-violet-400 font-medium">
                      {language === "fr" ? "Vidéo B" : "Video B"}
                    </span>
                  </div>
                  <div className="w-full aspect-video rounded-lg bg-gradient-to-br from-violet-500/10 to-violet-500/5 border border-white/5 flex items-center justify-center">
                    <div className="text-center px-4">
                      <p className="text-xs text-white/40 mb-1">
                        FutureTech — 18 min
                      </p>
                      <p className="text-sm font-medium text-white/80">
                        {language === "fr"
                          ? "L'IA va remplacer les développeurs"
                          : "AI will replace developers"}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-violet-500/5 border border-violet-500/15 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-violet-400/70 mb-1">
                      {language === "fr" ? "Thèse" : "Thesis"}
                    </p>
                    <p className="text-xs text-white/70 leading-relaxed">
                      {language === "fr"
                        ? "« Les agents IA autonomes rendront la majorité des postes de développeurs obsolètes d'ici 5 ans. »"
                        : '"Autonomous AI agents will make most developer jobs obsolete within 5 years."'}
                    </p>
                  </div>
                </motion.div>
              </div>

              {/* Mini badges */}
              <div className="relative flex flex-wrap items-center justify-center gap-3 mt-8">
                {[
                  {
                    icon: CheckCircle2,
                    label:
                      language === "fr"
                        ? "Fact-check croisé"
                        : "Cross fact-check",
                    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
                  },
                  {
                    icon: GitMerge,
                    label:
                      language === "fr"
                        ? "Points de convergence"
                        : "Convergence points",
                    color:
                      "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                  },
                  {
                    icon: Scale,
                    label:
                      language === "fr"
                        ? "Synthèse nuancée"
                        : "Nuanced synthesis",
                    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
                  },
                ].map((badge) => (
                  <motion.div
                    key={badge.label}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4, duration: 0.4 }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${badge.color}`}
                  >
                    <badge.icon className="w-3.5 h-3.5" />
                    {badge.label}
                  </motion.div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* CTA */}
          <ScrollReveal delay={0.2} className="text-center mt-8">
            <motion.button
              onClick={() => navigate("/debate")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-medium hover:opacity-90 transition-opacity shadow-lg shadow-indigo-500/25"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Swords className="w-4 h-4" />
              {language === "fr" ? "Essayer le Débat IA" : "Try AI Debate"}
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <PricingSection language={language} onNavigate={navigate} />

      {/* ─── FAQ ─── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary mb-3">
              {language === "fr"
                ? "Questions fréquentes"
                : "Frequently Asked Questions"}
            </h2>
            <p className="text-text-secondary text-sm sm:text-base max-w-lg mx-auto">
              {language === "fr"
                ? "Tout ce que vous devez savoir avant de commencer."
                : "Everything you need to know before getting started."}
            </p>
          </ScrollReveal>

          <ScrollReveal>
            <div className="rounded-xl border border-border-subtle bg-bg-secondary/40 backdrop-blur-sm p-4 sm:p-6">
              {faqs.map((faq, index) => (
                <FAQItem
                  key={index}
                  question={faq.question}
                  answer={faq.answer}
                />
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <ScrollReveal className="max-w-3xl mx-auto">
          <div className="relative p-8 sm:p-14 rounded-2xl border border-border-subtle bg-bg-secondary/50 backdrop-blur-sm text-center overflow-hidden">
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/[0.06] via-transparent to-violet-500/[0.06]" />

            <div className="relative z-10">
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-primary mb-3">
                {language === "fr"
                  ? "Votre prochaine vidéo mérite mieux qu'un simple visionnage"
                  : "Your next video deserves more than just watching"}
              </h2>
              <p className="text-text-secondary text-sm sm:text-base mb-8 max-w-md mx-auto">
                {language === "fr"
                  ? "Rejoignez les chercheurs, journalistes et professionnels qui extraient le savoir de chaque vidéo avec Deep Sight. 5 analyses gratuites pour commencer."
                  : "Join the researchers, journalists and professionals who extract knowledge from every video with Deep Sight. 5 free analyses to get started."}
              </p>
              <motion.button
                onClick={() => navigate("/login")}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-lg bg-accent-primary text-white font-medium hover:bg-accent-primary-hover transition-colors shadow-lg shadow-accent-primary/25"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {language === "fr"
                  ? "Créer un compte gratuit"
                  : "Create free account"}
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="py-10 px-4 sm:px-6 border-t border-border-subtle/50">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center gap-5 md:flex-row md:justify-between">
            <Logo />

            <div className="flex items-center gap-6">
              <a
                href="/legal"
                className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
              >
                {language === "fr" ? "Mentions légales" : "Legal"}
              </a>
              <a
                href="/legal/cgu"
                className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
              >
                {language === "fr" ? "CGU" : "Terms of Use"}
              </a>
              <a
                href="/legal/cgv"
                className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
              >
                {language === "fr" ? "CGV" : "Terms of Sale"}
              </a>
              <a
                href="mailto:contact@deepsightsynthesis.com"
                className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
              >
                Contact
              </a>
            </div>

            <p className="text-xs text-text-muted">
              © 2025-2026 Deep Sight — RCS Lyon 994 558 898
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
