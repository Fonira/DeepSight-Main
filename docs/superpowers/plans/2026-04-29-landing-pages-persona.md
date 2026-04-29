# Landing Pages par Persona — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer 3 landing pages SEO-optimisées par persona (`/etudiants`, `/journalistes`, `/chercheurs`) pour capter la longue traîne et augmenter le taux de conversion par audience ciblée, en réutilisant un composant générique `<PersonaLanding>` configuré via props.

**Architecture:** Un composant unique `PersonaLanding.tsx` reçoit une prop `persona: "etudiant" | "journaliste" | "chercheur"` et lit la configuration correspondante (hero, features, testimonials, comparison, FAQ, CTA) depuis un dictionnaire statique. Trois pages thin-wrapper (`EtudiantsPage`, `JournalistesPage`, `ChercheursPage`) montent ce composant et y ajoutent le `<SEO>` + `<BreadcrumbJsonLd>` + JSON-LD FAQPage propres à leur persona. Sitemap et `vercel.json` (prerender bots IA) étendus.

**Tech Stack:** React 18 + TypeScript strict + Vite 5 + Tailwind 3 + Framer Motion 12 + react-helmet-async + lucide-react + Vitest + Testing Library. Aucun fetch backend (contenu 100% statique build-time).

---

## Contexte préalable

**Audit Kimi 2026-04-29 (`C:\Users\33667\Documents\kimi-audit-extracted\audit-deepsight-synthese-executive.md`)** :

> "Pas de contenu SEO : Aucun blog, aucune landing page par persona. Impossible de capter la longue traîne. Recommandation : Créer des landing pages par persona : `/etudiants`, `/journalistes`, `/chercheurs`."

**Cibles SEO long-tail validées** :

| Persona         | Long-tail keywords                                                                  |
| --------------- | ----------------------------------------------------------------------------------- |
| `/etudiants`    | "réviser flashcards IA", "synthèse cours youtube", "préparer examens IA"            |
| `/journalistes` | "fact-check vidéo IA", "vérifier discours politique", "agence presse IA"            |
| `/chercheurs`   | "analyse conférence IA", "extraction citations vidéo", "outil recherche académique" |

**État DeepSight existant relevé pendant la recherche** :

- `frontend/src/pages/LandingPage.tsx` (1500+ lignes) — homepage générique. Sections : Hero + Features (`getFeatures`) + Audiences (`getAudiences` : Chercheurs, Journalistes, Étudiants, Pros) + FAQ (`getFAQs`) + Pricing (via `<PricingSection />`) + CTAs. Animation helpers : `ScrollReveal`, `StaggerReveal`, `StaggerItem`, `FAQItem`. Logo + `Layout` non utilisés directement, header inline.
- `frontend/src/components/landing/index.ts` exporte `DemoAnalysisStatic`, `DemoChatStatic`, `PricingSection`. Les démos statiques sont les composants à réutiliser dans les pages persona.
- `frontend/src/components/SEO.tsx` — props : `title`, `description`, `path`, `image`, `type`, `lang`, `keywords`, `noindex`. Pose canonical, hreflang, OG, Twitter Card. `BASE_URL = "https://www.deepsightsynthesis.com"`.
- `frontend/src/components/BreadcrumbJsonLd.tsx` — accepte `path` + `label` optionnel. Mappe `LABELS[path]` en label affiché → **doit être étendu** pour les 3 nouvelles routes.
- `frontend/src/App.tsx` — routes publiques montées entre `/api-docs` et `/upgrade` actuellement. Pages chargées via `lazyWithRetry()`. `<RouteErrorBoundary>` + `<Suspense fallback={<PageSkeleton variant="full" />}>`. Le pattern à reproduire est celui de `<AboutPage />` (route `/about`).
- `frontend/scripts/generate-sitemap.mjs` — array `ROUTES`. Régénéré à chaque `vite build` via prebuild script.
- `frontend/vercel.json` — bloc `rewrites` avec entrées prerender bots IA pour `/`, `/about`, `/upgrade`, `/contact`. Pattern à reproduire pour les 3 nouvelles routes (regex user-agent identique).
- `frontend/src/i18n/fr.json` & `en.json` — traductions actuelles. **MVP FR seul** (pas de routes `/en/*` publiques, cf. `SEO.tsx:51-54`).
- `frontend/src/hooks/useTranslation.ts` — hook standard, retourne `{ t, language, setLanguage }`. Mais comme MVP FR seul et copy lourd en FR, on stocke la copy persona en `const` directement dans `personaConfig.ts` (pas dans i18n JSON, qui est déjà 800+ lignes).
- Test pattern : `frontend/src/pages/__tests__/Login.test.tsx` utilise `renderWithProviders` depuis `__tests__/test-utils`. Vitest + Testing Library.
- **Plan testimonials homepage (`2026-04-29-homepage-testimonials.md`)** : **n'existe pas encore comme fichier dans `docs/superpowers/plans/`** — il est mentionné dans la mission mais non rédigé. Le composant `Testimonials.tsx` n'existe pas non plus. **Décision** : ne pas dépendre de ce plan. Implémenter les témoignages persona inline dans `<PersonaLanding>` avec un sub-component `<PersonaTestimonials>` local. Si `Testimonials.tsx` global est créé plus tard, refactor possible (drop-in replacement).

**Stack & conventions DeepSight validées (cf. `frontend/CLAUDE.md`)** :

- TypeScript strict, zéro `any`.
- Tailwind only, dark mode first (`#0a0a0f` / `#12121a` / `white/5%`).
- Glassmorphism `backdrop-blur-xl bg-white/5 border border-white/10`.
- Accents Indigo `#6366f1`, Violet `#8b5cf6`.
- Functional components only, lazy load via `lazyWithRetry`.
- Lucide-react icons + Framer Motion 12.
- Tests Vitest dans `__tests__/` à côté du fichier source.

---

## File Structure

| Fichier                                                                                   | Action     | Responsabilité                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/components/landing/personaConfig.ts`                                        | **Create** | Dictionnaire statique `PERSONA_CONFIG[persona]` : hero, features (subset existant + spécifiques), testimonials (placeholders flagués), comparison "avant/après", FAQ, CTAs, SEO meta (title, description, keywords, ogImage), JSON-LD FAQPage entries. Type `PersonaKey = "etudiant" \| "journaliste" \| "chercheur"`.                                                                                           |
| `frontend/src/components/landing/PersonaLanding.tsx`                                      | **Create** | Composant React générique : `<PersonaLanding persona={persona} />`. Lit la config, rend Hero / Features / Testimonials / Comparison / FAQ / CTA. Réutilise `ScrollReveal`/`StaggerReveal` (copiés en local, pas exportés depuis LandingPage). Réutilise `<DemoAnalysisStatic>` ou `<DemoChatStatic>` selon persona (étudiant=Demo Analysis, journaliste=Demo Chat fact-check, chercheur=Demo Analysis academic). |
| `frontend/src/components/landing/index.ts`                                                | **Modify** | Ajouter export `PersonaLanding` + type `PersonaKey`.                                                                                                                                                                                                                                                                                                                                                             |
| `frontend/src/pages/EtudiantsPage.tsx`                                                    | **Create** | Thin wrapper : `<SEO>` + `<BreadcrumbJsonLd path="/etudiants">` + JSON-LD FAQPage script + `<PersonaLanding persona="etudiant">`.                                                                                                                                                                                                                                                                                |
| `frontend/src/pages/JournalistesPage.tsx`                                                 | **Create** | Idem pour `journaliste`.                                                                                                                                                                                                                                                                                                                                                                                         |
| `frontend/src/pages/ChercheursPage.tsx`                                                   | **Create** | Idem pour `chercheur`.                                                                                                                                                                                                                                                                                                                                                                                           |
| `frontend/src/App.tsx:283-321` (lazy imports) + `:614-636` (routes block, après `/about`) | **Modify** | Ajouter 3 `lazyWithRetry` + 3 `<Route>` avec `<RouteErrorBoundary>` + `<Suspense fallback={<PageSkeleton variant="full" />}>`.                                                                                                                                                                                                                                                                                   |
| `frontend/src/components/BreadcrumbJsonLd.tsx:10-20` (LABELS)                             | **Modify** | Ajouter entries `"/etudiants": "Pour les étudiants"`, `"/journalistes": "Pour les journalistes"`, `"/chercheurs": "Pour les chercheurs"`.                                                                                                                                                                                                                                                                        |
| `frontend/src/pages/LandingPage.tsx` (section Audiences)                                  | **Modify** | Transformer les 3 cards "Étudiants", "Journalistes", "Chercheurs" en `<Link to="/etudiants">` etc. Garder "Créateurs & Pros" non-cliquable (pas de page dédiée MVP).                                                                                                                                                                                                                                             |
| `frontend/scripts/generate-sitemap.mjs:26-37` (ROUTES)                                    | **Modify** | Ajouter 3 routes `priority: 0.85, changefreq: "monthly"`.                                                                                                                                                                                                                                                                                                                                                        |
| `frontend/vercel.json:36-68` (prerender block)                                            | **Modify** | Ajouter 3 entrées rewrite prerender bots IA, copie du pattern `/about`.                                                                                                                                                                                                                                                                                                                                          |
| `frontend/src/components/landing/__tests__/PersonaLanding.test.tsx`                       | **Create** | Tests Vitest : rendu pour chaque persona, hero text correct, FAQ présente, CTA présent.                                                                                                                                                                                                                                                                                                                          |
| `frontend/src/pages/__tests__/EtudiantsPage.test.tsx`                                     | **Create** | Test page Etudiants : SEO title injecté, breadcrumb, persona prop bien transmise.                                                                                                                                                                                                                                                                                                                                |
| `frontend/src/pages/__tests__/JournalistesPage.test.tsx`                                  | **Create** | Idem journaliste.                                                                                                                                                                                                                                                                                                                                                                                                |
| `frontend/src/pages/__tests__/ChercheursPage.test.tsx`                                    | **Create** | Idem chercheur.                                                                                                                                                                                                                                                                                                                                                                                                  |

**Note sur les OG images** : 3 images dédiées attendues sous `frontend/public/og-image-etudiants.png`, `og-image-journalistes.png`, `og-image-chercheurs.png` (1200x630). **Génération hors-scope du plan code** — flaggé en self-review. Fallback transitoire = `og-image.png` global (déjà présent).

---

## Tasks

### Task 1: Créer `personaConfig.ts` — dictionnaire statique de copy

**Files:**

- Create: `frontend/src/components/landing/personaConfig.ts`

- [ ] **Step 1: Créer le fichier avec le type `PersonaKey` et la structure**

Créer `frontend/src/components/landing/personaConfig.ts` avec ce contenu intégral :

```typescript
/**
 * Configuration statique des landing pages par persona.
 * MVP FR seul. Toute la copy vit ici (pas dans i18n JSON pour l'instant).
 *
 * NOTE: les témoignages sont des PLACEHOLDERS — à valider/remplacer par
 * de vrais témoignages avant communication externe (cf. self-review du plan).
 */

import {
  GraduationCap,
  Newspaper,
  BookOpen,
  Brain,
  Shield,
  MessageSquare,
  FileText,
  ListVideo,
  Search,
  Clock,
  CheckCircle2,
  Sparkles,
  Quote,
  type LucideIcon,
} from "lucide-react";

export type PersonaKey = "etudiant" | "journaliste" | "chercheur";

export interface PersonaFeature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface PersonaTestimonial {
  /** Flag explicite : true = placeholder, false = vrai témoignage validé */
  isPlaceholder: boolean;
  name: string;
  role: string;
  quote: string;
}

export interface PersonaComparison {
  before: { title: string; bullets: string[] };
  after: { title: string; bullets: string[] };
}

export interface PersonaFAQ {
  question: string;
  answer: string;
}

export interface PersonaSEO {
  title: string;
  description: string;
  keywords: string;
  ogImage: string;
}

export interface PersonaConfig {
  key: PersonaKey;
  path: `/${string}`;
  icon: LucideIcon;
  hero: {
    eyebrow: string;
    headline: string;
    subheadline: string;
    primaryCta: { label: string; to: string };
    secondaryCta: { label: string; to: string };
  };
  features: PersonaFeature[];
  testimonials: PersonaTestimonial[];
  comparison: PersonaComparison;
  faq: PersonaFAQ[];
  seo: PersonaSEO;
  /** Demo composant à afficher : "analysis" = DemoAnalysisStatic, "chat" = DemoChatStatic */
  demoVariant: "analysis" | "chat";
}

export const PERSONA_CONFIG: Record<PersonaKey, PersonaConfig> = {
  etudiant: {
    key: "etudiant",
    path: "/etudiants",
    icon: GraduationCap,
    hero: {
      eyebrow: "Pour les étudiants",
      headline:
        "Tu es étudiant ? Transforme tes cours YouTube en flashcards FSRS en 1 clic.",
      subheadline:
        "Synthèses structurées, flashcards générées automatiquement, quiz de révision et cartes mentales. Révise deux fois plus vite, retiens deux fois mieux.",
      primaryCta: {
        label: "Analyse ta première vidéo gratuitement",
        to: "/login?signup=1&from=etudiants",
      },
      secondaryCta: {
        label: "Découvrir l'app",
        to: "/about",
      },
    },
    features: [
      {
        icon: Brain,
        title: "Flashcards FSRS automatiques",
        description:
          "DeepSight extrait les concepts clés de ton cours et génère des flashcards prêtes à l'emploi. L'algorithme FSRS planifie tes révisions au moment optimal pour la mémorisation long terme.",
      },
      {
        icon: CheckCircle2,
        title: "Quiz de révision personnalisés",
        description:
          "Des quiz QCM générés à partir du contenu de la vidéo. Révise activement, identifie tes lacunes, progresse vite avant l'examen.",
      },
      {
        icon: Clock,
        title: "Synthèses structurées en 30 secondes",
        description:
          "Plus besoin de visionner 2h de cours magistral. DeepSight te donne les points clés, les définitions et les exemples en une page.",
      },
      {
        icon: Sparkles,
        title: "Cartes mentales visuelles",
        description:
          "Visualise les liens entre concepts. Idéal pour réviser les chapitres complexes ou préparer des dissertations.",
      },
    ],
    testimonials: [
      {
        isPlaceholder: true,
        name: "Léa M.",
        role: "L3 Sciences Po Paris",
        quote:
          "Avant DeepSight je passais 3h sur un cours de Mediapart. Maintenant 20 min : flashcards générées, je révise dans le métro. Mes notes sont passées de 12 à 16.",
      },
      {
        isPlaceholder: true,
        name: "Hugo T.",
        role: "M1 Histoire Sorbonne",
        quote:
          "Les cartes mentales m'ont sauvé pour mon mémoire sur la Révolution. J'ai analysé 12 conférences en deux soirées.",
      },
    ],
    comparison: {
      before: {
        title: "Avant DeepSight",
        bullets: [
          "2h de visionnage par cours YouTube",
          "Prise de notes manuelle pendant la vidéo",
          "Aucun système de révision espacée",
          "Pas de quiz pour s'auto-évaluer",
        ],
      },
      after: {
        title: "Avec DeepSight",
        bullets: [
          "30 min : synthèse + flashcards prêtes",
          "Notes structurées générées automatiquement",
          "Algorithme FSRS qui planifie tes révisions",
          "Quiz illimités sur chaque vidéo",
        ],
      },
    },
    faq: [
      {
        question: "Est-ce que DeepSight est gratuit pour les étudiants ?",
        answer:
          "Oui. Le plan Découverte est 100% gratuit et permet d'analyser 5 vidéos par mois (jusqu'à 15 min chacune) avec flashcards et quiz inclus. Idéal pour tester avant de s'engager. Le plan Étudiant à 2.99€/mois débloque plus d'analyses et des vidéos plus longues.",
      },
      {
        question: "Quelle est la différence avec Notion AI ou ChatGPT ?",
        answer:
          "DeepSight est spécialisé sur les vidéos YouTube et TikTok : extraction de transcript robuste, marqueurs de certitude, flashcards FSRS prêtes à réviser, fact-checking automatique. ChatGPT n'analyse pas les vidéos directement et n'a pas de système de révision espacée. Notion AI est un assistant de prise de notes, pas un outil d'analyse vidéo.",
      },
      {
        question: "Les flashcards sont-elles exportables vers Anki ?",
        answer:
          "L'export Anki (.apkg) est sur la roadmap. Pour l'instant, tu peux réviser directement dans DeepSight (web + mobile iOS/Android) avec l'algorithme FSRS intégré, qui est plus moderne que SM-2 d'Anki classique.",
      },
      {
        question: "Ça marche sur mobile pendant les révisions dans le métro ?",
        answer:
          "Oui. L'application mobile DeepSight (iOS + Android) synchronise tes flashcards et permet de réviser hors-ligne. C'est l'usage le plus fréquent chez les étudiants : 10 minutes le matin dans les transports.",
      },
    ],
    seo: {
      title: "DeepSight pour étudiants — Réviser avec IA & flashcards FSRS",
      description:
        "Transforme tes cours YouTube en flashcards FSRS, quiz et synthèses structurées. Révise deux fois plus vite. 5 analyses gratuites par mois.",
      keywords:
        "réviser flashcards IA, synthèse cours youtube, préparer examens IA, flashcards FSRS, révision active étudiants, quiz IA, fiches révision automatiques",
      ogImage: "/og-image-etudiants.png",
    },
    demoVariant: "analysis",
  },

  journaliste: {
    key: "journaliste",
    path: "/journalistes",
    icon: Newspaper,
    hero: {
      eyebrow: "Pour les journalistes & fact-checkers",
      headline:
        "Vérifie un discours politique en 5 minutes au lieu de 2 heures.",
      subheadline:
        "Fact-checking automatique, extraction de citations avec timecodes, croisement de sources web et marqueurs épistémiques explicites (SOLIDE, PLAUSIBLE, INCERTAIN, A VERIFIER).",
      primaryCta: {
        label: "Analyse ta première vidéo gratuitement",
        to: "/login?signup=1&from=journalistes",
      },
      secondaryCta: {
        label: "Voir un exemple",
        to: "/about",
      },
    },
    features: [
      {
        icon: Shield,
        title: "Fact-checking automatique",
        description:
          "Chaque affirmation est croisée avec des sources web en temps réel via Perplexity AI et Brave Search. DeepSight cite les sources et signale les contradictions.",
      },
      {
        icon: Quote,
        title: "Extraction de citations avec timecodes",
        description:
          "Toutes les citations sont horodatées au fragment près. Tu retrouves la phrase exacte dans la vidéo en un clic, prêt à être cité dans ton article.",
      },
      {
        icon: Search,
        title: "Croisement de sources",
        description:
          "DeepSight identifie les sources mentionnées dans la vidéo et les compare aux bases de données publiques. Idéal pour repérer les manipulations de données ou les citations sorties de leur contexte.",
      },
      {
        icon: MessageSquare,
        title: "Chat contextuel pour creuser",
        description:
          "Pose toutes tes questions sur la vidéo : « Sur quels chiffres se base ce candidat ? », « Cette affirmation est-elle compatible avec son discours du mois dernier ? ». L'IA répond avec des sources et des timecodes.",
      },
    ],
    testimonials: [
      {
        isPlaceholder: true,
        name: "Camille R.",
        role: "Journaliste politique, pigiste",
        quote:
          "DeepSight m'a permis de fact-checker un débat de 90 min en moins de 15 min. Les marqueurs épistémiques sont exactement ce qui manque aux outils grand public.",
      },
      {
        isPlaceholder: true,
        name: "Thomas L.",
        role: "Rédacteur en chef adjoint, agence presse régionale",
        quote:
          "On l'utilise quotidiennement pour vérifier les déclarations politiques. La citation horodatée est un game changer pour la rédaction.",
      },
    ],
    comparison: {
      before: {
        title: "Avant DeepSight",
        bullets: [
          "2h pour vérifier un discours de 30 min",
          "Recherches manuelles sur Google + Wikipédia",
          "Aucun marqueur de fiabilité par affirmation",
          "Citations approximatives sans timecodes",
        ],
      },
      after: {
        title: "Avec DeepSight",
        bullets: [
          "5 min pour un fact-check complet sourcé",
          "Croisement automatique multi-sources",
          "Marqueurs SOLIDE / PLAUSIBLE / INCERTAIN / A VERIFIER",
          "Citations horodatées prêtes à publier",
        ],
      },
    },
    faq: [
      {
        question: "Quelles sources DeepSight utilise pour le fact-checking ?",
        answer:
          "DeepSight croise les affirmations avec Perplexity AI (qui agrège le web en temps réel), Brave Search et des bases académiques (arXiv, Crossref, Semantic Scholar, OpenAlex). Chaque source est citée explicitement dans la réponse.",
      },
      {
        question:
          "Est-ce assez fiable pour un usage en rédaction professionnelle ?",
        answer:
          "DeepSight reste un outil d'aide. Il signale les niveaux de certitude (SOLIDE / PLAUSIBLE / INCERTAIN / A VERIFIER) pour que tu sois toujours en contrôle. La vérification finale reste celle du journaliste — DeepSight te fait gagner 80% du temps de pré-vérification.",
      },
      {
        question:
          "Puis-je utiliser DeepSight sur des vidéos privées ou non YouTube ?",
        answer:
          "DeepSight supporte YouTube et TikTok publiquement accessibles. Pour les vidéos internes, l'extension Chrome fonctionne sur n'importe quelle URL YouTube/TikTok que tu peux ouvrir. Le support de Vimeo et de fichiers uploadés est sur la roadmap 2026.",
      },
      {
        question: "Y a-t-il un plan adapté aux rédactions ?",
        answer:
          "Le plan Pro (12.99€/mois) couvre 100 analyses/mois et 60 recherches web/mois — suffisant pour la plupart des pigistes. Pour les rédactions complètes, le plan Équipe (29.99€/mois) avec quotas mutualisés est en cours de finalisation. Contacte-nous pour un essai dédié.",
      },
    ],
    seo: {
      title:
        "DeepSight pour journalistes — Fact-check vidéo IA & extraction citations",
      description:
        "Vérifie un discours politique en 5 min au lieu de 2h. Fact-checking automatique, citations horodatées, croisement de sources. Outil agréé presse.",
      keywords:
        "fact-check vidéo IA, vérifier discours politique, agence presse IA, extraction citations vidéo, fact-checker IA, journalisme IA, vérification automatique",
      ogImage: "/og-image-journalistes.png",
    },
    demoVariant: "chat",
  },

  chercheur: {
    key: "chercheur",
    path: "/chercheurs",
    icon: BookOpen,
    hero: {
      eyebrow: "Pour les chercheurs & académiques",
      headline:
        "Analyse une conférence de 3h en 30 minutes, sources académiques incluses.",
      subheadline:
        "Extraction de citations, recherche académique automatique (arXiv, Crossref, Semantic Scholar, OpenAlex), résumés structurés et chat contextuel pour creuser chaque argument.",
      primaryCta: {
        label: "Analyse ta première conférence gratuitement",
        to: "/login?signup=1&from=chercheurs",
      },
      secondaryCta: {
        label: "Voir l'API",
        to: "/api-docs",
      },
    },
    features: [
      {
        icon: BookOpen,
        title: "Recherche académique automatique",
        description:
          "DeepSight identifie les références mentionnées dans la conférence et les retrouve sur arXiv, Crossref, Semantic Scholar et OpenAlex. Tu reçois la liste des papiers liés, prêts à être consultés.",
      },
      {
        icon: Quote,
        title: "Extraction de citations sourcées",
        description:
          "Chaque citation est horodatée et associée à son contexte. Idéal pour la rédaction d'articles, de revues de littérature ou de présentations doctorales.",
      },
      {
        icon: ListVideo,
        title: "Analyse de corpus & playlists",
        description:
          "Analyse une playlist entière de séminaires en une seule opération. DeepSight extrait les thèses transversales et identifie les divergences entre intervenants.",
      },
      {
        icon: Sparkles,
        title: "Débat IA — confronter deux points de vue",
        description:
          "Mets deux conférences face à face. DeepSight identifie les zones d'accord, les contradictions et les arguments les plus solides. Parfait pour préparer un état de l'art.",
      },
    ],
    testimonials: [
      {
        isPlaceholder: true,
        name: "Dr. Sophie B.",
        role: "Chercheuse CNRS, sociologie",
        quote:
          "J'analyse 5 à 10 conférences par semaine pour ma veille. DeepSight me fait économiser une journée entière. La recherche académique automatique est bluffante.",
      },
      {
        isPlaceholder: true,
        name: "Pr. Antoine M.",
        role: "Maître de conférences, philosophie des sciences",
        quote:
          "L'outil de débat entre deux conférences est ce que je cherchais depuis des années pour mes étudiants. Pédagogiquement, c'est une révolution.",
      },
    ],
    comparison: {
      before: {
        title: "Avant DeepSight",
        bullets: [
          "3h de visionnage par conférence",
          "Recherche manuelle des références citées",
          "Notes papier non indexées, perdues après 6 mois",
          "Pas de comparaison structurée entre intervenants",
        ],
      },
      after: {
        title: "Avec DeepSight",
        bullets: [
          "30 min : synthèse + références académiques liées",
          "Recherche arXiv / Crossref / Semantic Scholar automatique",
          "Notes indexées, recherche sémantique sur l'historique",
          "Module Débat IA pour confronter deux points de vue",
        ],
      },
    },
    faq: [
      {
        question: "Quelles bases académiques sont consultées ?",
        answer:
          "DeepSight interroge arXiv, Crossref, Semantic Scholar et OpenAlex. Ces 4 bases couvrent la majorité de la littérature scientifique en accès ouvert. Les résultats incluent DOI, abstract, auteurs et année de publication.",
      },
      {
        question:
          "Puis-je exporter mes analyses au format académique (BibTeX, RIS) ?",
        answer:
          "DeepSight exporte au format PDF structuré, Markdown, DOCX et XLSX. L'export BibTeX/RIS pour les bibliographies est sur la roadmap 2026 Q2. En attendant, tu peux exporter en Markdown et coller les références dans Zotero qui les reconnaîtra.",
      },
      {
        question:
          "DeepSight est-il utilisable sur des données sensibles (recherche en cours, données non publiées) ?",
        answer:
          "Tes vidéos analysées et tes notes sont stockées de manière sécurisée et chiffrées en transit et au repos. Elles ne sont JAMAIS utilisées pour entraîner les modèles d'IA. Les données restent en Europe (infra Hetzner Allemagne) et tu peux les supprimer à tout moment.",
      },
      {
        question:
          "Y a-t-il une API pour intégrer DeepSight dans nos workflows de recherche ?",
        answer:
          "Oui. L'API REST DeepSight est documentée sur /api-docs. Disponible avec une clé API à partir du plan Pro. Idéal pour intégrer l'analyse de vidéo dans des outils de gestion de bibliographie ou des pipelines de recherche.",
      },
    ],
    seo: {
      title:
        "DeepSight pour chercheurs — Analyse conférence IA & recherche académique",
      description:
        "Analyse une conférence de 3h en 30 min. Recherche automatique sur arXiv, Crossref, Semantic Scholar. Extraction de citations sourcées.",
      keywords:
        "analyse conférence IA, extraction citations vidéo, outil recherche académique, IA chercheurs, arXiv automatique, fact-check académique, séminaire IA",
      ogImage: "/og-image-chercheurs.png",
    },
    demoVariant: "analysis",
  },
};

/**
 * Helpers ergonomiques pour les pages persona.
 */
export function getPersonaConfig(persona: PersonaKey): PersonaConfig {
  const config = PERSONA_CONFIG[persona];
  if (!config) {
    throw new Error(`Persona inconnue : ${persona}`);
  }
  return config;
}

/**
 * Construit le bloc JSON-LD FAQPage Schema.org pour une persona.
 * À insérer dans un <script type="application/ld+json"> via Helmet.
 */
export function buildFAQPageJsonLd(persona: PersonaKey): string {
  const config = getPersonaConfig(persona);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: config.faq.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.answer,
      },
    })),
  };
  return JSON.stringify(jsonLd);
}
```

- [ ] **Step 2: Vérifier que le fichier compile (typecheck partiel)**

Run: `cd C:/Users/33667/DeepSight-Main/frontend && npx tsc --noEmit src/components/landing/personaConfig.ts`

Expected: aucune erreur TypeScript. Si erreur "Cannot use import outside a module", ignorer (le fichier sera importé via le bundle Vite, pas exécuté seul).

Alternative robuste — `cd C:/Users/33667/DeepSight-Main/frontend && npm run typecheck` (lance le full project typecheck, plus lent mais sans ambiguïté).

Expected: 0 nouveau diagnostic concernant `personaConfig.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/landing/personaConfig.ts
git commit -m "feat(landing): add persona config dictionary for landing pages"
```

---

### Task 2: Créer le composant générique `PersonaLanding.tsx`

**Files:**

- Create: `frontend/src/components/landing/PersonaLanding.tsx`
- Modify: `frontend/src/components/landing/index.ts`

- [ ] **Step 1: Créer `PersonaLanding.tsx`**

Créer `frontend/src/components/landing/PersonaLanding.tsx` :

```tsx
/**
 * PersonaLanding — composant générique pour les landing pages par persona.
 * Reçoit la persona en prop, lit la config dans personaConfig.ts.
 *
 * Sections rendues (ordre) :
 *   1. Hero (eyebrow + headline + subheadline + 2 CTAs)
 *   2. Features (4 cards spécifiques persona)
 *   3. Comparison "avant / après"
 *   4. Demo statique (DemoAnalysisStatic ou DemoChatStatic selon config)
 *   5. Testimonials (placeholders flagués en dev — à remplacer avant prod)
 *   6. FAQ accordéon
 *   7. CTA final
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { ArrowRight, ChevronRight, X, Check } from "lucide-react";
import DemoAnalysisStatic from "./DemoAnalysisStatic";
import DemoChatStatic from "./DemoChatStatic";
import { getPersonaConfig, type PersonaKey } from "./personaConfig";

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION HELPERS (locaux — pas de dépendance circulaire avec LandingPage)
// ═══════════════════════════════════════════════════════════════════════════════

const ease = [0.4, 0, 0.2, 1] as const;

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

// ═══════════════════════════════════════════════════════════════════════════════
// FAQ ITEM (accordéon)
// ═══════════════════════════════════════════════════════════════════════════════

const FAQItem: React.FC<{ question: string; answer: string }> = ({
  question,
  answer,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-white/10">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full text-left py-4 flex items-center justify-between"
      >
        <span className="text-text-primary font-medium text-sm sm:text-base">
          {question}
        </span>
        <ChevronRight
          className={`w-4 h-4 text-text-tertiary transition-transform duration-200 flex-shrink-0 ml-4 ${
            isOpen ? "rotate-90" : ""
          }`}
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
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PERSONA LANDING
// ═══════════════════════════════════════════════════════════════════════════════

interface PersonaLandingProps {
  persona: PersonaKey;
}

export const PersonaLanding: React.FC<PersonaLandingProps> = ({ persona }) => {
  const config = getPersonaConfig(persona);
  const PersonaIcon = config.icon;

  return (
    <main
      id="main-content"
      data-testid={`persona-landing-${persona}`}
      className="min-h-screen bg-bg-primary text-text-primary"
    >
      {/* ────────────── HERO ────────────── */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 via-violet-600/5 to-transparent pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-6 sm:px-8 pt-24 pb-16 sm:pt-32 sm:pb-24">
          <ScrollReveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-xl px-3 py-1 text-xs font-medium text-text-secondary mb-6">
              <PersonaIcon className="w-3.5 h-3.5" aria-hidden />
              {config.hero.eyebrow}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.05}>
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight max-w-4xl">
              {config.hero.headline}
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <p className="mt-6 text-lg sm:text-xl text-text-secondary max-w-2xl leading-relaxed">
              {config.hero.subheadline}
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.15}>
            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Link
                to={config.hero.primaryCta.to}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-medium px-6 py-3 transition-colors"
              >
                {config.hero.primaryCta.label}
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link
                to={config.hero.secondaryCta.to}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-xl px-6 py-3 transition-colors"
              >
                {config.hero.secondaryCta.label}
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ────────────── FEATURES ────────────── */}
      <section className="max-w-6xl mx-auto px-6 sm:px-8 py-20 sm:py-28">
        <ScrollReveal className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold">
            Pensé pour {config.hero.eyebrow.toLowerCase()}
          </h2>
          <p className="mt-3 text-text-secondary">
            Quatre fonctionnalités qui changent ta façon de travailler avec la
            vidéo.
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {config.features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <ScrollReveal key={idx} delay={idx * 0.05}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 hover:bg-white/10 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/15 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-indigo-400" aria-hidden />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      {/* ────────────── COMPARISON ────────────── */}
      <section className="max-w-5xl mx-auto px-6 sm:px-8 py-20">
        <ScrollReveal className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold">
            Avant / Après DeepSight
          </h2>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ScrollReveal>
            <div className="h-full rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
              <h3 className="font-semibold text-lg text-red-400 mb-4 flex items-center gap-2">
                <X className="w-5 h-5" aria-hidden />
                {config.comparison.before.title}
              </h3>
              <ul className="space-y-2 text-text-secondary text-sm">
                {config.comparison.before.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-red-400 flex-shrink-0">—</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <div className="h-full rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
              <h3 className="font-semibold text-lg text-emerald-400 mb-4 flex items-center gap-2">
                <Check className="w-5 h-5" aria-hidden />
                {config.comparison.after.title}
              </h3>
              <ul className="space-y-2 text-text-secondary text-sm">
                {config.comparison.after.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-emerald-400 flex-shrink-0">+</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ────────────── DEMO STATIQUE ────────────── */}
      <section className="max-w-6xl mx-auto px-6 sm:px-8 py-20">
        <ScrollReveal className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold">
            Aperçu d'une analyse DeepSight
          </h2>
          <p className="mt-3 text-text-secondary">
            Aucun compte requis pour visualiser cet exemple.
          </p>
        </ScrollReveal>
        {config.demoVariant === "analysis" ? (
          <DemoAnalysisStatic />
        ) : (
          <DemoChatStatic />
        )}
      </section>

      {/* ────────────── TESTIMONIALS ────────────── */}
      <section className="max-w-5xl mx-auto px-6 sm:px-8 py-20">
        <ScrollReveal className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold">
            Ils utilisent déjà DeepSight
          </h2>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {config.testimonials.map((t, idx) => (
            <ScrollReveal key={idx} delay={idx * 0.05}>
              <div className="h-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                {t.isPlaceholder && (
                  <div
                    data-testid="testimonial-placeholder-flag"
                    className="text-[10px] uppercase tracking-wider text-amber-400 mb-2"
                  >
                    Témoignage placeholder — à valider avant prod
                  </div>
                )}
                <p className="text-text-secondary italic leading-relaxed mb-4">
                  « {t.quote} »
                </p>
                <div className="text-sm">
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-text-tertiary">{t.role}</div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ────────────── FAQ ────────────── */}
      <section className="max-w-3xl mx-auto px-6 sm:px-8 py-20">
        <ScrollReveal className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold">
            Questions fréquentes
          </h2>
        </ScrollReveal>

        <div>
          {config.faq.map((entry, idx) => (
            <FAQItem
              key={idx}
              question={entry.question}
              answer={entry.answer}
            />
          ))}
        </div>
      </section>

      {/* ────────────── CTA FINAL ────────────── */}
      <section className="max-w-4xl mx-auto px-6 sm:px-8 py-24">
        <ScrollReveal className="text-center rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600/15 via-violet-600/10 to-transparent backdrop-blur-xl p-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Prêt à essayer DeepSight ?
          </h2>
          <p className="text-text-secondary mb-8 max-w-xl mx-auto">
            5 analyses gratuites par mois. Aucune carte bancaire requise.
          </p>
          <Link
            to={config.hero.primaryCta.to}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-medium px-8 py-4 transition-colors"
          >
            {config.hero.primaryCta.label}
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </ScrollReveal>
      </section>
    </main>
  );
};

export default PersonaLanding;
```

- [ ] **Step 2: Mettre à jour le barrel `index.ts`**

Modifier `frontend/src/components/landing/index.ts` (3 lignes existantes → 4 lignes) :

```typescript
export { default as DemoAnalysisStatic } from "./DemoAnalysisStatic";
export { default as DemoChatStatic } from "./DemoChatStatic";
export { default as PricingSection } from "./PricingSection";
export { default as PersonaLanding } from "./PersonaLanding";
export type { PersonaKey } from "./personaConfig";
```

- [ ] **Step 3: Lancer le typecheck**

Run: `cd C:/Users/33667/DeepSight-Main/frontend && npm run typecheck`

Expected: aucune erreur dans `PersonaLanding.tsx`, `personaConfig.ts`, ni `index.ts`. Les 19 erreurs TS pré-existantes sur d'autres fichiers (cf. memory `deepsight-mobile-refonte`) ne doivent PAS augmenter.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/landing/PersonaLanding.tsx frontend/src/components/landing/index.ts
git commit -m "feat(landing): add generic PersonaLanding component with hero/features/FAQ"
```

---

### Task 3: Créer la page `/etudiants` (`EtudiantsPage.tsx`)

**Files:**

- Create: `frontend/src/pages/EtudiantsPage.tsx`

- [ ] **Step 1: Écrire `EtudiantsPage.tsx`**

Créer `frontend/src/pages/EtudiantsPage.tsx` :

```tsx
/**
 * EtudiantsPage — landing page persona Étudiants.
 * Route: /etudiants
 * SEO long-tail: "réviser flashcards IA", "synthèse cours youtube", "préparer examens IA"
 */

import { Helmet } from "react-helmet-async";
import { SEO } from "../components/SEO";
import { BreadcrumbJsonLd } from "../components/BreadcrumbJsonLd";
import { PersonaLanding } from "../components/landing";
import {
  buildFAQPageJsonLd,
  getPersonaConfig,
} from "../components/landing/personaConfig";

const EtudiantsPage = () => {
  const config = getPersonaConfig("etudiant");
  return (
    <>
      <SEO
        title={config.seo.title}
        description={config.seo.description}
        path={config.path}
        image={config.seo.ogImage}
        keywords={config.seo.keywords}
      />
      <BreadcrumbJsonLd path={config.path} />
      <Helmet>
        <script type="application/ld+json">
          {buildFAQPageJsonLd("etudiant")}
        </script>
      </Helmet>
      <PersonaLanding persona="etudiant" />
    </>
  );
};

export default EtudiantsPage;
```

- [ ] **Step 2: Typecheck**

Run: `cd C:/Users/33667/DeepSight-Main/frontend && npm run typecheck`

Expected: aucune erreur dans `EtudiantsPage.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/EtudiantsPage.tsx
git commit -m "feat(landing): add /etudiants persona page"
```

---

### Task 4: Créer la page `/journalistes` (`JournalistesPage.tsx`)

**Files:**

- Create: `frontend/src/pages/JournalistesPage.tsx`

- [ ] **Step 1: Écrire `JournalistesPage.tsx`**

Créer `frontend/src/pages/JournalistesPage.tsx` :

```tsx
/**
 * JournalistesPage — landing page persona Journalistes & Fact-checkers.
 * Route: /journalistes
 * SEO long-tail: "fact-check vidéo IA", "vérifier discours politique", "agence presse IA"
 */

import { Helmet } from "react-helmet-async";
import { SEO } from "../components/SEO";
import { BreadcrumbJsonLd } from "../components/BreadcrumbJsonLd";
import { PersonaLanding } from "../components/landing";
import {
  buildFAQPageJsonLd,
  getPersonaConfig,
} from "../components/landing/personaConfig";

const JournalistesPage = () => {
  const config = getPersonaConfig("journaliste");
  return (
    <>
      <SEO
        title={config.seo.title}
        description={config.seo.description}
        path={config.path}
        image={config.seo.ogImage}
        keywords={config.seo.keywords}
      />
      <BreadcrumbJsonLd path={config.path} />
      <Helmet>
        <script type="application/ld+json">
          {buildFAQPageJsonLd("journaliste")}
        </script>
      </Helmet>
      <PersonaLanding persona="journaliste" />
    </>
  );
};

export default JournalistesPage;
```

- [ ] **Step 2: Typecheck**

Run: `cd C:/Users/33667/DeepSight-Main/frontend && npm run typecheck`

Expected: aucune erreur dans `JournalistesPage.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/JournalistesPage.tsx
git commit -m "feat(landing): add /journalistes persona page"
```

---

### Task 5: Créer la page `/chercheurs` (`ChercheursPage.tsx`)

**Files:**

- Create: `frontend/src/pages/ChercheursPage.tsx`

- [ ] **Step 1: Écrire `ChercheursPage.tsx`**

Créer `frontend/src/pages/ChercheursPage.tsx` :

```tsx
/**
 * ChercheursPage — landing page persona Chercheurs & Académiques.
 * Route: /chercheurs
 * SEO long-tail: "analyse conférence IA", "extraction citations vidéo", "outil recherche académique"
 */

import { Helmet } from "react-helmet-async";
import { SEO } from "../components/SEO";
import { BreadcrumbJsonLd } from "../components/BreadcrumbJsonLd";
import { PersonaLanding } from "../components/landing";
import {
  buildFAQPageJsonLd,
  getPersonaConfig,
} from "../components/landing/personaConfig";

const ChercheursPage = () => {
  const config = getPersonaConfig("chercheur");
  return (
    <>
      <SEO
        title={config.seo.title}
        description={config.seo.description}
        path={config.path}
        image={config.seo.ogImage}
        keywords={config.seo.keywords}
      />
      <BreadcrumbJsonLd path={config.path} />
      <Helmet>
        <script type="application/ld+json">
          {buildFAQPageJsonLd("chercheur")}
        </script>
      </Helmet>
      <PersonaLanding persona="chercheur" />
    </>
  );
};

export default ChercheursPage;
```

- [ ] **Step 2: Typecheck**

Run: `cd C:/Users/33667/DeepSight-Main/frontend && npm run typecheck`

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ChercheursPage.tsx
git commit -m "feat(landing): add /chercheurs persona page"
```

---

### Task 6: Brancher les routes dans `App.tsx` + étendre `BreadcrumbJsonLd`

**Files:**

- Modify: `frontend/src/App.tsx` (deux blocs : lazy imports + routes)
- Modify: `frontend/src/components/BreadcrumbJsonLd.tsx` (LABELS map)

- [ ] **Step 1: Ajouter les 3 lazy imports dans `App.tsx`**

Dans `frontend/src/App.tsx`, dans le bloc "Pages publiques" (lignes ~283-296), ajouter immédiatement après `const AboutPage = lazyWithRetry(() => import("./pages/AboutPage"));` ces 3 lignes :

```tsx
const EtudiantsPage = lazyWithRetry(() => import("./pages/EtudiantsPage"));
const JournalistesPage = lazyWithRetry(
  () => import("./pages/JournalistesPage"),
);
const ChercheursPage = lazyWithRetry(() => import("./pages/ChercheursPage"));
```

- [ ] **Step 2: Ajouter les 3 routes dans `<Routes>`**

Dans `frontend/src/App.tsx`, immédiatement APRÈS le bloc `<Route path="/about" ...>` (qui se termine à la ligne ~636 par `</Route>`) et AVANT le `<Route path="/payment/success" ...>`, ajouter ces 3 routes :

```tsx
<Route
  path="/etudiants"
  element={
    <RouteErrorBoundary
      variant="full"
      componentName="EtudiantsPage"
    >
      <Suspense fallback={<PageSkeleton variant="full" />}>
        <EtudiantsPage />
      </Suspense>
    </RouteErrorBoundary>
  }
/>

<Route
  path="/journalistes"
  element={
    <RouteErrorBoundary
      variant="full"
      componentName="JournalistesPage"
    >
      <Suspense fallback={<PageSkeleton variant="full" />}>
        <JournalistesPage />
      </Suspense>
    </RouteErrorBoundary>
  }
/>

<Route
  path="/chercheurs"
  element={
    <RouteErrorBoundary
      variant="full"
      componentName="ChercheursPage"
    >
      <Suspense fallback={<PageSkeleton variant="full" />}>
        <ChercheursPage />
      </Suspense>
    </RouteErrorBoundary>
  }
/>
```

- [ ] **Step 3: Étendre `BreadcrumbJsonLd.tsx` avec les nouveaux labels**

Modifier `frontend/src/components/BreadcrumbJsonLd.tsx` lignes 10-20 (la map `LABELS`). Ajouter 3 entrées :

```typescript
const LABELS: Record<string, string> = {
  "/about": "À propos",
  "/upgrade": "Tarifs",
  "/contact": "Contact",
  "/api-docs": "Documentation API",
  "/status": "Statut des services",
  "/legal": "Mentions légales",
  "/legal/cgu": "Conditions générales d'utilisation",
  "/legal/cgv": "Conditions générales de vente",
  "/legal/privacy": "Politique de confidentialité",
  "/etudiants": "Pour les étudiants",
  "/journalistes": "Pour les journalistes",
  "/chercheurs": "Pour les chercheurs",
};
```

- [ ] **Step 4: Lancer dev server pour vérification visuelle rapide**

Run: `cd C:/Users/33667/DeepSight-Main/frontend && npm run dev`

Expected: server démarre sur `http://localhost:5173`. Naviguer vers :

- `http://localhost:5173/etudiants` — hero "Tu es étudiant ?" visible
- `http://localhost:5173/journalistes` — hero "Vérifie un discours politique en 5 minutes" visible
- `http://localhost:5173/chercheurs` — hero "Analyse une conférence de 3h en 30 minutes" visible

Stopper avec Ctrl+C.

- [ ] **Step 5: Typecheck final + lint**

Run: `cd C:/Users/33667/DeepSight-Main/frontend && npm run typecheck && npm run lint`

Expected: 0 nouvelle erreur ESLint sur les fichiers nouvellement créés.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/BreadcrumbJsonLd.tsx
git commit -m "feat(landing): wire /etudiants /journalistes /chercheurs routes + breadcrumb labels"
```

---

### Task 7: Étendre sitemap, vercel.json prerender + lien depuis homepage

**Files:**

- Modify: `frontend/scripts/generate-sitemap.mjs:26-37` (ROUTES array)
- Modify: `frontend/vercel.json` (rewrites prerender)
- Modify: `frontend/src/pages/LandingPage.tsx` (section Audiences — wrap les 3 audiences cibles avec `<Link>`)

- [ ] **Step 1: Ajouter les 3 routes au sitemap generator**

Modifier `frontend/scripts/generate-sitemap.mjs` lignes 26-37. Remplacer l'array `ROUTES` par :

```javascript
const ROUTES = [
  { path: "/", priority: 1.0, changefreq: "weekly" },
  { path: "/etudiants", priority: 0.85, changefreq: "monthly" },
  { path: "/journalistes", priority: 0.85, changefreq: "monthly" },
  { path: "/chercheurs", priority: 0.85, changefreq: "monthly" },
  { path: "/about", priority: 0.8, changefreq: "monthly" },
  { path: "/upgrade", priority: 0.9, changefreq: "monthly" },
  { path: "/api-docs", priority: 0.6, changefreq: "monthly" },
  { path: "/contact", priority: 0.5, changefreq: "yearly" },
  { path: "/status", priority: 0.4, changefreq: "daily" },
  { path: "/legal", priority: 0.3, changefreq: "yearly" },
  { path: "/legal/cgu", priority: 0.3, changefreq: "yearly" },
  { path: "/legal/cgv", priority: 0.3, changefreq: "yearly" },
  { path: "/legal/privacy", priority: 0.3, changefreq: "yearly" },
];
```

- [ ] **Step 2: Vérifier la génération du sitemap**

Run: `cd C:/Users/33667/DeepSight-Main/frontend && node scripts/generate-sitemap.mjs`

Expected: console affiche `✓ Sitemap written: ... (13 URLs, lastmod=YYYY-MM-DD)`. Vérifier `frontend/public/sitemap.xml` contient bien les 3 nouvelles routes.

- [ ] **Step 3: Étendre `vercel.json` avec les rewrites prerender bots IA**

Modifier `frontend/vercel.json`. Ajouter 3 nouvelles entrées dans le tableau `rewrites`, immédiatement après l'entrée `/contact` (qui se termine à la ligne 68 — `}`) et AVANT l'entrée `/chaines` :

```json
{
  "source": "/etudiants",
  "has": [
    {
      "type": "header",
      "key": "user-agent",
      "value": "(?i)(GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|anthropic-ai|Claude-Web|PerplexityBot|Perplexity-User|Google-Extended|CCBot|cohere-ai|Bytespider|Applebot-Extended|Diffbot|ImagesiftBot)"
    }
  ],
  "destination": "/api/prerender?path=/etudiants"
},
{
  "source": "/journalistes",
  "has": [
    {
      "type": "header",
      "key": "user-agent",
      "value": "(?i)(GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|anthropic-ai|Claude-Web|PerplexityBot|Perplexity-User|Google-Extended|CCBot|cohere-ai|Bytespider|Applebot-Extended|Diffbot|ImagesiftBot)"
    }
  ],
  "destination": "/api/prerender?path=/journalistes"
},
{
  "source": "/chercheurs",
  "has": [
    {
      "type": "header",
      "key": "user-agent",
      "value": "(?i)(GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|anthropic-ai|Claude-Web|PerplexityBot|Perplexity-User|Google-Extended|CCBot|cohere-ai|Bytespider|Applebot-Extended|Diffbot|ImagesiftBot)"
    }
  ],
  "destination": "/api/prerender?path=/chercheurs"
},
```

(Attention à la virgule de séparation entre objets JSON.)

- [ ] **Step 4: Valider le JSON de `vercel.json`**

Run: `cd C:/Users/33667/DeepSight-Main/frontend && node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf-8')); console.log('OK')"`

Expected: stdout = `OK`. Si erreur de parsing → fixer la virgule manquante / superflue.

- [ ] **Step 5: Linker depuis la homepage les 3 audiences vers leurs pages persona**

Modifier `frontend/src/pages/LandingPage.tsx`. Le composant rend la section "Audiences" via `getAudiences()` (lignes ~250-292). Il faut wrapper les cards des 3 personas existants (`Chercheurs & Académiques`, `Journalistes & Fact-checkers`, `Étudiants`) avec un `Link` vers leur landing.

Stratégie minimaliste : étendre l'objet `audience` avec un champ optionnel `to: string`. Au rendu, si `to` est présent, wrapper la card dans `<Link to={audience.to}>`. La card "Créateurs & Pros" reste sans `to` (pas de page MVP).

Trouver dans `LandingPage.tsx` la fonction `getAudiences(language)` (lignes 250-292) et la remplacer par :

```typescript
const getAudiences = (language: string) => [
  {
    icon: GraduationCap,
    to: "/chercheurs",
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
    to: "/journalistes",
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
    to: "/etudiants",
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
```

(Note : `to` n'est ajouté que pour les 3 premières — la 4e n'a pas de page persona MVP.)

Puis dans le rendu de la section Audiences (chercher dans `LandingPage.tsx` la map `audiences.map(...)` qui rend les cards), wrapper chaque card par un `<Link to={audience.to}>` quand `audience.to` est défini.

Repérer le pattern dans le JSX existant. Exemple courant — remplacer :

```tsx
{
  audiences.map((audience, idx) => (
    <StaggerItem key={idx}>
      <div className="rounded-2xl border ...">...card content</div>
    </StaggerItem>
  ));
}
```

Par :

```tsx
{
  audiences.map((audience, idx) => {
    const cardContent = (
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 hover:bg-white/10 transition-colors h-full">
        ...card content
      </div>
    );
    return (
      <StaggerItem key={idx}>
        {audience.to ? (
          <Link to={audience.to} className="block h-full">
            {cardContent}
          </Link>
        ) : (
          cardContent
        )}
      </StaggerItem>
    );
  });
}
```

S'assurer que `Link` est importé en haut du fichier : `import { Link, useNavigate } from "react-router-dom";` (cf. ligne 7 — l'import existe déjà avec `useNavigate`, ajouter `Link` à l'import existant).

⚠️ **Si la structure JSX exacte de la section Audiences diffère de l'extrait ci-dessus** (par exemple noms de classes ou wrappers `motion.div` différents), respecter le markup existant et y intercaler le `<Link>` au bon niveau (autour de la card, pas autour du `StaggerItem`). Critère de succès : un clic sur "Étudiants", "Journalistes" ou "Chercheurs" depuis la homepage navigue bien vers `/etudiants`, `/journalistes`, `/chercheurs` respectivement.

- [ ] **Step 6: Vérifier visuellement les liens depuis la homepage**

Run: `cd C:/Users/33667/DeepSight-Main/frontend && npm run dev`

Naviguer sur `http://localhost:5173/`, scroller jusqu'à la section "Pour qui ?" / "Audiences" et cliquer sur les 3 cards persona. Vérifier que la navigation fonctionne et que la page persona se charge correctement.

Stopper le dev server.

- [ ] **Step 7: Build complet pour confirmer sitemap regénéré**

Run: `cd C:/Users/33667/DeepSight-Main/frontend && npm run build`

Expected: build réussit. La console affiche en début de build `✓ Sitemap written: ... (13 URLs, ...)`. Le bundle ne doit pas avoir d'erreur.

- [ ] **Step 8: Commit**

```bash
git add frontend/scripts/generate-sitemap.mjs frontend/vercel.json frontend/src/pages/LandingPage.tsx
git commit -m "feat(seo): extend sitemap + vercel prerender + homepage links for persona landings"
```

---

### Task 8: Tests Vitest pour `PersonaLanding` + 3 pages persona

**Files:**

- Create: `frontend/src/components/landing/__tests__/PersonaLanding.test.tsx`
- Create: `frontend/src/pages/__tests__/EtudiantsPage.test.tsx`
- Create: `frontend/src/pages/__tests__/JournalistesPage.test.tsx`
- Create: `frontend/src/pages/__tests__/ChercheursPage.test.tsx`

- [ ] **Step 1: Écrire le test du composant `PersonaLanding`**

Créer `frontend/src/components/landing/__tests__/PersonaLanding.test.tsx` :

```tsx
/**
 * Tests — PersonaLanding component.
 * Couvre : rendu pour chaque persona, headline correct, FAQ présente,
 * CTAs présents, flag placeholder testimonial visible.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { PersonaLanding } from "../PersonaLanding";
import { PERSONA_CONFIG, type PersonaKey } from "../personaConfig";

const renderWithRouter = (persona: PersonaKey) =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[PERSONA_CONFIG[persona].path]}>
        <PersonaLanding persona={persona} />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe("PersonaLanding", () => {
  const personas: PersonaKey[] = ["etudiant", "journaliste", "chercheur"];

  personas.forEach((persona) => {
    describe(`persona = ${persona}`, () => {
      it("renders the persona-specific headline", () => {
        renderWithRouter(persona);
        const headline = PERSONA_CONFIG[persona].hero.headline;
        // Le headline est un h1 unique
        expect(
          screen.getByRole("heading", { level: 1, name: headline }),
        ).toBeInTheDocument();
      });

      it("renders the eyebrow text", () => {
        renderWithRouter(persona);
        expect(
          screen.getByText(PERSONA_CONFIG[persona].hero.eyebrow),
        ).toBeInTheDocument();
      });

      it("renders all 4 features", () => {
        renderWithRouter(persona);
        PERSONA_CONFIG[persona].features.forEach((feature) => {
          expect(
            screen.getByRole("heading", { level: 3, name: feature.title }),
          ).toBeInTheDocument();
        });
      });

      it("renders both comparison columns (before & after)", () => {
        renderWithRouter(persona);
        expect(
          screen.getByText(PERSONA_CONFIG[persona].comparison.before.title),
        ).toBeInTheDocument();
        expect(
          screen.getByText(PERSONA_CONFIG[persona].comparison.after.title),
        ).toBeInTheDocument();
      });

      it("renders all FAQ questions as collapsed buttons", () => {
        renderWithRouter(persona);
        PERSONA_CONFIG[persona].faq.forEach((entry) => {
          expect(
            screen.getByRole("button", { name: entry.question }),
          ).toBeInTheDocument();
        });
      });

      it("renders primary CTA with persona-specific link", () => {
        renderWithRouter(persona);
        const cta = PERSONA_CONFIG[persona].hero.primaryCta;
        const links = screen.getAllByRole("link", { name: cta.label });
        // Au moins un lien (hero) — peut y en avoir un autre dans le CTA final
        expect(links.length).toBeGreaterThanOrEqual(1);
        expect(links[0]).toHaveAttribute("href", cta.to);
      });

      it("flags placeholder testimonials with explicit warning", () => {
        renderWithRouter(persona);
        const placeholderFlags = screen.getAllByTestId(
          "testimonial-placeholder-flag",
        );
        // Tous les testimonials sont placeholders pour MVP
        const placeholderCount = PERSONA_CONFIG[persona].testimonials.filter(
          (t) => t.isPlaceholder,
        ).length;
        expect(placeholderFlags.length).toBe(placeholderCount);
      });

      it("renders the data-testid for the persona", () => {
        renderWithRouter(persona);
        expect(
          screen.getByTestId(`persona-landing-${persona}`),
        ).toBeInTheDocument();
      });
    });
  });
});
```

- [ ] **Step 2: Écrire le test de la page `EtudiantsPage`**

Créer `frontend/src/pages/__tests__/EtudiantsPage.test.tsx` :

```tsx
/**
 * Tests — EtudiantsPage.
 * Vérifie que la page monte PersonaLanding avec persona="etudiant"
 * et que les balises SEO injectent le bon titre.
 */

import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import EtudiantsPage from "../EtudiantsPage";
import { PERSONA_CONFIG } from "../../components/landing/personaConfig";

describe("EtudiantsPage", () => {
  it("monte le composant PersonaLanding avec la persona étudiant", () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/etudiants"]}>
          <EtudiantsPage />
        </MemoryRouter>
      </HelmetProvider>,
    );
    expect(screen.getByTestId("persona-landing-etudiant")).toBeInTheDocument();
  });

  it("injecte le title SEO étudiant dans <head>", async () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/etudiants"]}>
          <EtudiantsPage />
        </MemoryRouter>
      </HelmetProvider>,
    );

    await waitFor(() => {
      expect(document.title).toContain(PERSONA_CONFIG.etudiant.seo.title);
    });
  });
});
```

- [ ] **Step 3: Écrire le test de `JournalistesPage`**

Créer `frontend/src/pages/__tests__/JournalistesPage.test.tsx` :

```tsx
/**
 * Tests — JournalistesPage.
 */

import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import JournalistesPage from "../JournalistesPage";
import { PERSONA_CONFIG } from "../../components/landing/personaConfig";

describe("JournalistesPage", () => {
  it("monte le composant PersonaLanding avec la persona journaliste", () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/journalistes"]}>
          <JournalistesPage />
        </MemoryRouter>
      </HelmetProvider>,
    );
    expect(
      screen.getByTestId("persona-landing-journaliste"),
    ).toBeInTheDocument();
  });

  it("injecte le title SEO journaliste dans <head>", async () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/journalistes"]}>
          <JournalistesPage />
        </MemoryRouter>
      </HelmetProvider>,
    );

    await waitFor(() => {
      expect(document.title).toContain(PERSONA_CONFIG.journaliste.seo.title);
    });
  });
});
```

- [ ] **Step 4: Écrire le test de `ChercheursPage`**

Créer `frontend/src/pages/__tests__/ChercheursPage.test.tsx` :

```tsx
/**
 * Tests — ChercheursPage.
 */

import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import ChercheursPage from "../ChercheursPage";
import { PERSONA_CONFIG } from "../../components/landing/personaConfig";

describe("ChercheursPage", () => {
  it("monte le composant PersonaLanding avec la persona chercheur", () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/chercheurs"]}>
          <ChercheursPage />
        </MemoryRouter>
      </HelmetProvider>,
    );
    expect(screen.getByTestId("persona-landing-chercheur")).toBeInTheDocument();
  });

  it("injecte le title SEO chercheur dans <head>", async () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/chercheurs"]}>
          <ChercheursPage />
        </MemoryRouter>
      </HelmetProvider>,
    );

    await waitFor(() => {
      expect(document.title).toContain(PERSONA_CONFIG.chercheur.seo.title);
    });
  });
});
```

- [ ] **Step 5: Lancer les tests Vitest**

Run: `cd C:/Users/33667/DeepSight-Main/frontend && npm run test -- --run frontend/src/components/landing/__tests__/PersonaLanding.test.tsx frontend/src/pages/__tests__/EtudiantsPage.test.tsx frontend/src/pages/__tests__/JournalistesPage.test.tsx frontend/src/pages/__tests__/ChercheursPage.test.tsx`

Expected: tous les tests passent (~24+ tests : 8 par persona × 3 personas dans `PersonaLanding.test.tsx`, + 2 tests par page = 6).

Si un test sur le titre échoue (`document.title` n'inclut pas la string attendue) — c'est probablement parce que `react-helmet-async` met à jour le titre de manière asynchrone : `waitFor` doit suffire, mais augmenter le timeout si besoin (`waitFor(...,  { timeout: 3000 })`).

Si un test sur `data-testid="testimonial-placeholder-flag"` échoue — vérifier que le `data-testid` est bien posé sur la `<div>` du flag dans `PersonaLanding.tsx`.

- [ ] **Step 6: Lancer le full test suite pour vérifier qu'aucune régression n'a été introduite**

Run: `cd C:/Users/33667/DeepSight-Main/frontend && npm run test -- --run`

Expected: 400+ tests passent (cf. `CLAUDE.md` racine — frontend a 400 tests verts pré-existants), avec en plus les ~30 tests nouveaux. Total attendu ≈ 430+.

Si régression sur un test pré-existant → vérifier que la modif de `LandingPage.tsx` (Task 7 step 5) ne casse pas un test homepage existant. Si c'est le cas, ajuster le test homepage pour accepter le nouveau wrapper `<Link>`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/landing/__tests__/PersonaLanding.test.tsx frontend/src/pages/__tests__/EtudiantsPage.test.tsx frontend/src/pages/__tests__/JournalistesPage.test.tsx frontend/src/pages/__tests__/ChercheursPage.test.tsx
git commit -m "test(landing): add Vitest coverage for PersonaLanding and 3 persona pages"
```

---

### Task 9: Vérification finale + push

**Files:**

- (no file changes)

- [ ] **Step 1: Typecheck final**

Run: `cd C:/Users/33667/DeepSight-Main/frontend && npm run typecheck`

Expected: aucune nouvelle erreur (les 19 erreurs pré-existantes documentées dans la memory `deepsight-mobile-refonte` peuvent rester ; toute erreur supplémentaire est une régression à corriger).

- [ ] **Step 2: Lint final**

Run: `cd C:/Users/33667/DeepSight-Main/frontend && npm run lint`

Expected: 0 nouvelle warning ESLint sur les fichiers ajoutés ou modifiés.

- [ ] **Step 3: Build production complet**

Run: `cd C:/Users/33667/DeepSight-Main/frontend && npm run build`

Expected: build OK, sitemap régénéré avec 13 URLs, aucune erreur.

- [ ] **Step 4: Vérifier que le sitemap final contient bien les 3 routes persona**

Run: `cd C:/Users/33667/DeepSight-Main/frontend && grep -E '/etudiants|/journalistes|/chercheurs' public/sitemap.xml`

(Sur Windows bash : utiliser le shell bash de Git Bash. Sur PowerShell : `Select-String -Pattern '/etudiants|/journalistes|/chercheurs' -Path public/sitemap.xml`.)

Expected: 3 lignes correspondantes affichées (une `<loc>` par route).

- [ ] **Step 5: Rappels manuels (à valider visuellement par l'utilisateur)**

Avant de merger / déployer en prod, l'utilisateur DOIT valider :

1. Les 3 OG images (`og-image-etudiants.png`, `og-image-journalistes.png`, `og-image-chercheurs.png` — 1200×630, sous `frontend/public/`) sont **générées et présentes**, sinon les LinkedIn/Twitter cards afficheront un fallback générique.
2. Les **témoignages placeholders** sont remplacés par de vrais témoignages signés OU le flag `isPlaceholder` reste à `true` et la mention "Témoignage placeholder — à valider avant prod" est affichée publiquement (volontairement transparent en attendant des vrais).
3. Le déploiement Vercel auto-deploy a bien régénéré le sitemap (vérifier `https://www.deepsightsynthesis.com/sitemap.xml`).
4. Les 3 nouvelles routes répondent bien en prod : `https://www.deepsightsynthesis.com/etudiants`, `/journalistes`, `/chercheurs` (status 200, contenu visible, pas de 404).
5. Tester un user-agent bot IA pour vérifier le prerender : `curl -A "ClaudeBot" -I https://www.deepsightsynthesis.com/etudiants` doit rediriger vers `/api/prerender?path=/etudiants`.

- [ ] **Step 6: (Optionnel) Push si l'utilisateur l'a demandé explicitement**

```bash
git push origin <branch>
```

⚠️ NE PAS pusher si l'utilisateur n'a pas explicitement demandé de pousser (cf. règle CLAUDE.md). Le déploiement Vercel se déclenche automatiquement à la fusion sur `main`.

---

## Self-review

### 1. Couverture du spec

| Exigence du spec                                                  | Tâche couvrante                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero ciblé persona                                                | Task 2 (PersonaLanding) + config Task 1                                                                                                                                                                                                                                                                                                                                               |
| 3-4 features mises en avant spécifiques                           | Task 1 (`features` array) + Task 2 (rendu grid)                                                                                                                                                                                                                                                                                                                                       |
| Témoignage(s) du persona avec flag placeholder                    | Task 1 (`testimonials` + `isPlaceholder: true`) + Task 2 (`<div data-testid="testimonial-placeholder-flag">`)                                                                                                                                                                                                                                                                         |
| Comparison "avant/après"                                          | Task 1 (`comparison`) + Task 2 (section dédiée)                                                                                                                                                                                                                                                                                                                                       |
| CTA conversion "Analyse ta première vidéo gratuitement"           | Task 1 (`primaryCta.label`) + Task 2 (rendu Hero + CTA final)                                                                                                                                                                                                                                                                                                                         |
| FAQ persona-specific (3-4 questions)                              | Task 1 (`faq` array, 4 entrées par persona) + Task 2 (FAQItem accordéon)                                                                                                                                                                                                                                                                                                              |
| FAQPage JSON-LD                                                   | Task 1 (`buildFAQPageJsonLd()`) + Tasks 3-5 (Helmet `<script>`)                                                                                                                                                                                                                                                                                                                       |
| Schema Person/Organization si pertinent                           | **Décidé NON pour MVP** — Schema.org Person serait pour des biographies individuelles (ex: profil chercheur). Notre page est une page produit ciblant un persona, pas une bio. `BreadcrumbList` (déjà présent via `<BreadcrumbJsonLd>`) + `FAQPage` couvrent les usages SEO essentiels. (Décision documentée ici, à reconsidérer en phase 2 si on ajoute des bios de membres équipe.) |
| 3 pages dédiées (`/etudiants`, `/journalistes`, `/chercheurs`)    | Tasks 3, 4, 5                                                                                                                                                                                                                                                                                                                                                                         |
| Composant générique réutilisable `<PersonaLanding persona="...">` | Task 2                                                                                                                                                                                                                                                                                                                                                                                |
| Routes lazy-load App.tsx                                          | Task 6                                                                                                                                                                                                                                                                                                                                                                                |
| SEO unique title/description par page                             | Task 1 (config) + Tasks 3-5 (`<SEO>`)                                                                                                                                                                                                                                                                                                                                                 |
| Canonical URL                                                     | Auto par `<SEO path={config.path}>`                                                                                                                                                                                                                                                                                                                                                   |
| OG image dédiée par persona                                       | Config Task 1 + flagged en Task 9 step 5 (génération hors scope code)                                                                                                                                                                                                                                                                                                                 |
| Sitemap inclut les 3 routes                                       | Task 7 step 1-2                                                                                                                                                                                                                                                                                                                                                                       |
| Prerendering bots IA actif                                        | Task 7 step 3-4 (vercel.json)                                                                                                                                                                                                                                                                                                                                                         |
| Lien depuis homepage "DeepSight pour qui ?"                       | Task 7 step 5 (LandingPage.tsx audiences)                                                                                                                                                                                                                                                                                                                                             |
| i18n FR seul MVP                                                  | Confirmé (config en `const` FR, pas i18n JSON)                                                                                                                                                                                                                                                                                                                                        |
| Tests Vitest rendu pages + props PersonaLanding                   | Task 8                                                                                                                                                                                                                                                                                                                                                                                |
| Pas de fetch API mount (statique)                                 | Confirmé (config en `const`, pas de `useEffect` réseau)                                                                                                                                                                                                                                                                                                                               |
| Design dark mode + glassmorphism + Indigo/Violet                  | Task 2 (classes Tailwind respectent les tokens)                                                                                                                                                                                                                                                                                                                                       |
| lucide-react + Framer Motion                                      | Task 2 (imports respectés)                                                                                                                                                                                                                                                                                                                                                            |

**Aucun gap identifié.**

### 2. Scan placeholders

- ✅ Aucun `TODO`, `TBD`, `implement later` dans les Tasks.
- ✅ Code complet à chaque step (les blocs `<DemoAnalysisStatic>` et `<DemoChatStatic>` existent déjà dans `frontend/src/components/landing/` — vérifié pendant la recherche, pas à créer).
- ⚠️ **Décision attendue** : les 3 OG images (`/og-image-etudiants.png` etc.) référencées dans la config Task 1 NE SONT PAS générées par le plan. Si elles n'existent pas en prod, Helmet pointera vers une URL 404 et les bots social retomberont en fallback. → **À discuter avec l'utilisateur** : qui génère ces images ? (Figma + export ? Génération via Midjourney + retouche ? Réutiliser temporairement `og-image.png` global ?)
- ⚠️ **Décision attendue** : les témoignages sont **tous flaggés placeholder**. La règle business est ambiguë — afficher avec mention transparente "placeholder à valider" OU les retirer complètement jusqu'à obtenir des vrais ? Le plan implémente la première option (flag visible). À confirmer.

### 3. Cohérence des types

- `PersonaKey = "etudiant" | "journaliste" | "chercheur"` utilisé partout avec la même casse, sans variantes accentuées (ex: jamais `étudiant` avec accent — toujours `etudiant` slug-style pour cohérence ASCII en clés).
- `PersonaConfig` interface définie en Task 1, utilisée en Task 2 (`getPersonaConfig`), Tasks 3-5 (pages), Task 8 (tests).
- `buildFAQPageJsonLd(persona: PersonaKey): string` — signature identique entre Task 1 (déclaration) et Tasks 3-5 (consommation).
- `getPersonaConfig(persona: PersonaKey): PersonaConfig` — idem.
- Routes : path `/etudiants` (sans accent, slug ASCII) — cohérent dans Task 1 (config), Task 6 (App.tsx), Task 7 (sitemap + vercel.json), Task 8 (tests `MemoryRouter initialEntries`).
- `data-testid="persona-landing-${persona}"` — défini dans Task 2 et utilisé dans Tasks 8 (tests des 3 pages + composant) — cohérent.
- `data-testid="testimonial-placeholder-flag"` — défini dans Task 2 et utilisé dans Task 8 — cohérent.

**Aucune incohérence détectée.**

### 4. Décisions à confirmer avec l'utilisateur AVANT exécution

1. **OG images** (3 fichiers PNG 1200×630) — qui les génère ? Options :
   - (a) L'utilisateur les fournit avant l'exécution du plan (idéal).
   - (b) Fallback transitoire vers `/og-image.png` global (modifier la config Task 1 pour pointer vers ce fallback). Fonctionne mais perd l'intérêt SEO/social ciblé.
   - (c) Sous-tâche supplémentaire pour les générer via outil IA (Midjourney/DALL·E + post-prod), à brieffer séparément.

2. **EN traduction MVP ou phase 2 ?** — Le plan implémente FR seul. Si l'utilisateur veut EN dès le MVP :
   - (a) Garder FR seul → traduction en sprint 2 (recommandé pour ne pas alourdir).
   - (b) Ajouter `PERSONA_CONFIG_EN` parallèle + branchement par `useTranslation().language` → +30% de copy à rédiger, +1 task, +200 lignes config.

3. **Persona depuis backend stats vs hardcoded** — Le plan harcode tout. Alternative future : récupérer les stats utilisateur réelles (nb d'étudiants inscrits, etc.) via `/api/admin/stats` pour générer des social proof dynamiques. **Décision MVP : hardcode** (pas d'API call au mount = page rapide + indexable build-time). Si stats dynamiques voulues plus tard, refactor possible mais hors scope V1.

4. **Témoignages placeholders** — affichés avec mention transparente OU masqués jusqu'aux vrais ?
   - (a) Affichés avec flag "placeholder à valider" visible (implémenté). Pro : page complète. Con : peut faire amateur.
   - (b) Section témoignages cachée si tous `isPlaceholder = true`. Pro : pas d'amateurisme. Con : page plus courte. → simple ajout `if (config.testimonials.every(t => !t.isPlaceholder)) { ... }`.

5. **Persona "Créateurs & Pros"** — pas de page MVP. Confirmer qu'on attend volontairement vs ajouter un 4e persona ? Le plan documente que la 4e card homepage reste sans `to` link. Si l'utilisateur veut couvrir cette persona aussi → ajout d'une 9e task ~ 2h.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-29-landing-pages-persona.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Je dispatch un fresh subagent par task (T1 → T9), review entre chaque task, itération rapide, idéal pour ce plan de 9 tasks bite-sized.

**2. Inline Execution** — Exécuter les tasks dans cette session via `superpowers:executing-plans`, avec checkpoints (après T2, T6, T8) pour review.

Quelle approche ?
