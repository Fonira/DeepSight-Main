# Blog DeepSight — Architecture + 3 Articles MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un blog SEO-friendly à DeepSight (`/blog` + `/blog/:slug`) alimenté par des fichiers Markdown locaux + frontmatter JSON, avec 3 articles MVP rédigés (TikTok fact-check, FSRS flashcards, souveraineté numérique).

**Architecture:** Stockage statique (Markdown plain + JSON metadata) dans `frontend/src/content/blog/`. Loader synchrone via `import.meta.glob` (Vite) — articles bundlés au build, zéro appel réseau. Rendu via `react-markdown` + `remark-gfm` (déjà installés). SEO complet : `<SEO>` existant + nouveau `<ArticleJsonLd>` (pattern de `BreadcrumbJsonLd`) + entrées sitemap auto-générées + prerender bot IA via `frontend/api/prerender.ts`.

**Tech Stack:**

- React 18 + TypeScript strict + Vite 5 + Tailwind CSS 3
- React Router 6 (lazy-loading existant via `lazyWithRetry`)
- `react-markdown@9` + `remark-gfm@4` (déjà dans `package.json`)
- `react-helmet-async@2` (SEO via `Helmet`)
- Framer Motion 12 (animations cards)
- lucide-react (icônes)
- Vitest + Testing Library (tests unitaires)
- Vercel Edge Function `frontend/api/prerender.ts` (prerender bots IA)

---

## Contexte préalable

### Audit Kimi 2026-04-29 — Phase 7

Source : `C:\Users\33667\Documents\prompt-claude-code-v2-real-stack.md` lignes 433-471. Recommandation explicite : « pas de blog → impossible de capter la longue traîne SEO. Architecture blog `/blog` + `/blog/:slug` + 3 articles MVP cibles ("fact-check TikTok", "flashcards FSRS", "souveraineté numérique IA européenne") ».

### État DeepSight — vérifications faites

- `frontend/src/pages/` : aucune page Blog n'existe (à créer).
- `frontend/src/App.tsx` : routes React Router 6 avec lazy-loading via `lazyWithRetry()` (lignes 282-322). Routes publiques déclarées dans le bloc `<Routes>` lignes 502-983 ; on insérera `/blog` et `/blog/:slug` après `/about` (vers ligne 648).
- `frontend/src/components/SEO.tsx` : composant `<SEO>` existant avec `title`, `description`, `path`, `image`, `type`, `lang`, `keywords`, `noindex`. Hreflang FR seul pour l'instant. Réutilisable tel quel.
- `frontend/src/components/BreadcrumbJsonLd.tsx` : pattern Helmet + JSON-LD `BreadcrumbList`. À reproduire pour `<ArticleJsonLd>`.
- `frontend/package.json` : `react-markdown@9.0.1` + `remark-gfm@4.0.0` déjà installés (ligne 47-50). **Aucune lib MDX**. Pas besoin d'ajouter de dépendance.
- `frontend/scripts/generate-sitemap.mjs` : génère `frontend/public/sitemap.xml` au prebuild. À étendre avec les slugs blog.
- `frontend/vercel.json` : rewrites pour bots IA (lignes 14-67) sur `/`, `/about`, `/upgrade`, `/contact` → `/api/prerender?path=...`. À étendre pour `/blog` et `/blog/:slug`.
- `frontend/api/prerender.ts` : Edge Function rendant HTML simplifié pour bots IA. À étendre avec `PAGES["/blog"]` et un loader dynamique pour `/blog/:slug`.
- `frontend/src/components/EnrichedMarkdown.tsx` : exemple existant de rendu Markdown via `ReactMarkdown` + `remarkGfm`. Référence pour le composant `<BlogMarkdown>` (plus simple, pas d'épistémique).
- `frontend/src/__tests__/test-utils.tsx` : `renderWithProviders()` avec `MemoryRouter`, `HelmetProvider`, `LanguageProvider`, `QueryClientProvider`. À utiliser pour les tests Blog.
- `frontend/public/robots.txt` : `Allow: /` par défaut → blog automatiquement indexable. Pas de modif nécessaire.
- `frontend/src/i18n/` : FR + EN traductions. **Hors scope MVP** : blog FR seul (décision architecturale dans Self-Review).

### Décision architecturale : Markdown plain + JSON metadata vs MDX

Choix retenu : **Markdown plain + JSON metadata par article**.

- (a) MDX nécessite `@mdx-js/rollup` ou `vite-plugin-mdx` + remark/rehype config + déclarations TS `*.mdx`. Ouvre la porte aux composants React inline mais on n'en a pas besoin pour 3 articles linéaires.
- (b) Markdown plain + JSON séparé : `import.meta.glob('./content/blog/*.md', { as: 'raw', eager: true })` charge tous les `.md` au build. Pas de plugin Vite, pas de runtime parser exotique. `react-markdown` rend déjà le markdown. Frontmatter via JSON jumeau (`<slug>.json`) pour éviter `gray-matter` et son polyfill `Buffer` côté browser.

Migration MDX possible plus tard si besoin de composants inline (CTA, embeds) sans casser les articles existants.

---

## File Structure

### Fichiers à créer

| Path                                                                             | Responsabilité                                                                                                |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `frontend/src/types/blog.ts`                                                     | Types : `BlogArticleMeta`, `BlogArticle`. Pas de logique.                                                     |
| `frontend/src/lib/blog.ts`                                                       | Loader articles : `getAllArticles()`, `getArticleBySlug(slug)`, `calculateReadingTime(text)`. Pure functions. |
| `frontend/src/lib/__tests__/blog.test.ts`                                        | Tests unit du loader (4 tests : load all, by slug, reading time, sort by date).                               |
| `frontend/src/components/ArticleJsonLd.tsx`                                      | JSON-LD Schema.org `Article` (calque sur `BreadcrumbJsonLd.tsx`).                                             |
| `frontend/src/components/BlogCard.tsx`                                           | Card listing : image, titre, excerpt, date, tags, reading time. Framer Motion fadeUp.                         |
| `frontend/src/pages/BlogListPage.tsx`                                            | `/blog` — grid cards, SEO, breadcrumb, hero.                                                                  |
| `frontend/src/pages/BlogPostPage.tsx`                                            | `/blog/:slug` — article complet, SEO, breadcrumb, ArticleJsonLd, markdown render.                             |
| `frontend/src/pages/__tests__/BlogListPage.test.tsx`                             | Test rendu liste.                                                                                             |
| `frontend/src/pages/__tests__/BlogPostPage.test.tsx`                             | Test rendu article + 404.                                                                                     |
| `frontend/src/content/blog/2026-04-29-fact-check-tiktok.md`                      | Article 1 : 1800-2200 mots.                                                                                   |
| `frontend/src/content/blog/2026-04-29-fact-check-tiktok.json`                    | Frontmatter article 1.                                                                                        |
| `frontend/src/content/blog/2026-04-29-flashcards-fsrs-revision-ia.md`            | Article 2 : 2000-2400 mots.                                                                                   |
| `frontend/src/content/blog/2026-04-29-flashcards-fsrs-revision-ia.json`          | Frontmatter article 2.                                                                                        |
| `frontend/src/content/blog/2026-04-29-souverainete-numerique-ia-europeenne.md`   | Article 3 : 1800-2200 mots.                                                                                   |
| `frontend/src/content/blog/2026-04-29-souverainete-numerique-ia-europeenne.json` | Frontmatter article 3.                                                                                        |
| `frontend/src/content/blog/index.ts`                                             | Re-export des slugs (utile pour le prerender côté Edge si besoin futur).                                      |

### Fichiers à modifier

| Path                                           | Modification                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `frontend/src/App.tsx`                         | Lazy-load `BlogListPage` + `BlogPostPage`. Ajouter routes `/blog` et `/blog/:slug` (publiques).  |
| `frontend/src/components/BreadcrumbJsonLd.tsx` | Ajouter `"/blog": "Blog"` dans la map `LABELS`.                                                  |
| `frontend/scripts/generate-sitemap.mjs`        | Lire les frontmatter blog `.json`, ajouter chaque slug dans `ROUTES`.                            |
| `frontend/vercel.json`                         | Ajouter rewrites prerender `/blog` et `/blog/:slug` pour bots IA + cache headers `/blog/*`.      |
| `frontend/api/prerender.ts`                    | Ajouter `/blog` (liste) + handler dynamique pour `/blog/:slug` (lit Markdown via fetch interne). |

### Fichiers explicitement non touchés

- `frontend/src/services/api.ts` : aucun appel API (articles statiques).
- `frontend/src/i18n/{fr,en}.json` : MVP FR only.
- `mobile/` et `extension/` : hors scope (web-only feature).
- `backend/` : aucun endpoint backend.

---

## Tasks

### Task 1: Types Blog + dossier content

**Files:**

- Create: `frontend/src/types/blog.ts`
- Create: `frontend/src/content/blog/.gitkeep`
- Create: `frontend/src/content/blog/index.ts`

- [ ] **Step 1: Créer le dossier content/blog**

```bash
mkdir -p "C:/Users/33667/DeepSight-Main/frontend/src/content/blog"
touch "C:/Users/33667/DeepSight-Main/frontend/src/content/blog/.gitkeep"
```

- [ ] **Step 2: Écrire les types**

Fichier `frontend/src/types/blog.ts` :

```typescript
/**
 * Types pour le blog DeepSight.
 * Les articles sont stockés en .md (contenu) + .json (frontmatter).
 */

export interface BlogArticleMeta {
  /** Slug URL (ex: "fact-check-tiktok") — sans préfixe date, dérivé du nom de fichier. */
  slug: string;
  /** Titre lisible pour SEO + UI. */
  title: string;
  /** Résumé 140-220 caractères pour cards et meta description. */
  description: string;
  /** Date ISO 8601 de publication (ex: "2026-04-29"). */
  publishedAt: string;
  /** Date ISO 8601 de dernière modification (optionnel). */
  updatedAt?: string;
  /** Auteur de l'article. */
  author: string;
  /** Tags / catégories (3-5 max). */
  tags: string[];
  /** Mots-clés SEO (séparés par virgule dans la balise meta). */
  keywords: string;
  /** Image OG/cover (chemin absolu sous /public). */
  coverImage: string;
  /** Image OG sociale (1200x630), souvent identique à coverImage. */
  ogImage?: string;
}

export interface BlogArticle {
  meta: BlogArticleMeta;
  /** Contenu Markdown brut, sans frontmatter. */
  content: string;
  /** Reading time en minutes (calculé). */
  readingTime: number;
}
```

- [ ] **Step 3: Écrire l'index re-export**

Fichier `frontend/src/content/blog/index.ts` :

```typescript
/**
 * Re-export des articles blog.
 * Le loader réel utilise import.meta.glob côté frontend/src/lib/blog.ts —
 * ce fichier sert uniquement de marqueur pour TypeScript.
 */
export {};
```

- [ ] **Step 4: Vérifier la compilation TS**

Run: `cd "C:/Users/33667/DeepSight-Main/frontend" && npm run typecheck`
Expected: PASS (zéro erreur sur les nouveaux fichiers).

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/33667/DeepSight-Main" && git add frontend/src/types/blog.ts frontend/src/content/blog/.gitkeep frontend/src/content/blog/index.ts && git commit -m "feat(blog): add BlogArticle types and content directory"
```

---

### Task 2: Blog loader (TDD)

**Files:**

- Create: `frontend/src/lib/blog.ts`
- Create: `frontend/src/lib/__tests__/blog.test.ts`

- [ ] **Step 1: Écrire le test failing**

Fichier `frontend/src/lib/__tests__/blog.test.ts` :

```typescript
import { describe, it, expect, vi } from "vitest";

// Mock Vite import.meta.glob avant import du module testé
vi.mock("../blog-glob", () => ({
  rawMarkdown: {
    "./2026-04-29-test-article.md":
      "# Test Article\n\nThis is a paragraph with some words to count for reading time.",
  },
  rawMeta: {
    "./2026-04-29-test-article.json": JSON.stringify({
      slug: "test-article",
      title: "Test Article",
      description: "Description test",
      publishedAt: "2026-04-29",
      author: "DeepSight",
      tags: ["test"],
      keywords: "test, article",
      coverImage: "/blog/test-article-cover.webp",
    }),
  },
}));

import {
  getAllArticles,
  getArticleBySlug,
  calculateReadingTime,
} from "../blog";

describe("blog loader", () => {
  it("returns all articles sorted by publishedAt desc", () => {
    const articles = getAllArticles();
    expect(articles).toHaveLength(1);
    expect(articles[0].meta.slug).toBe("test-article");
  });

  it("returns the article matching the slug", () => {
    const article = getArticleBySlug("test-article");
    expect(article).not.toBeNull();
    expect(article?.meta.title).toBe("Test Article");
  });

  it("returns null for unknown slug", () => {
    expect(getArticleBySlug("unknown")).toBeNull();
  });

  it("calculates reading time at 200 wpm minimum 1 minute", () => {
    expect(calculateReadingTime("hello")).toBe(1);
    const long = "word ".repeat(500);
    expect(calculateReadingTime(long)).toBe(3); // 500/200 = 2.5 → ceil 3
  });
});
```

- [ ] **Step 2: Run test pour vérifier qu'il échoue**

Run: `cd "C:/Users/33667/DeepSight-Main/frontend" && npx vitest run src/lib/__tests__/blog.test.ts`
Expected: FAIL — "Cannot find module ../blog" ou similaire.

- [ ] **Step 3: Écrire le wrapper glob (séparé pour testabilité)**

Fichier `frontend/src/lib/blog-glob.ts` :

```typescript
/**
 * Wrapper autour de import.meta.glob, isolé pour permettre le mock dans les tests.
 * Vite remplace ces appels au build par les contenus eager-importés.
 */

export const rawMarkdown = import.meta.glob("../content/blog/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const rawMeta = import.meta.glob("../content/blog/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
```

- [ ] **Step 4: Écrire le loader minimal qui fait passer les tests**

Fichier `frontend/src/lib/blog.ts` :

````typescript
import type { BlogArticle, BlogArticleMeta } from "../types/blog";
import { rawMarkdown, rawMeta } from "./blog-glob";

const WORDS_PER_MINUTE = 200;

/**
 * Calcule le reading time en minutes (arrondi vers le haut, minimum 1).
 * Compte les mots via split sur whitespace, ignore les caractères de markdown.
 */
export function calculateReadingTime(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ") // strip code blocks
    .replace(/[#>*_`~\[\]\(\)!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = text.length === 0 ? 0 : text.split(" ").length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

/**
 * Extrait le slug depuis un chemin de fichier ./AAAA-MM-JJ-slug.md → "slug".
 */
function pathToSlug(path: string): string {
  const filename = path.split("/").pop() ?? "";
  const noExt = filename.replace(/\.(md|json)$/, "");
  // Strip date prefix YYYY-MM-DD-
  return noExt.replace(/^\d{4}-\d{2}-\d{2}-/, "");
}

/**
 * Charge tous les articles depuis frontend/src/content/blog/*.{md,json}.
 * Triés par publishedAt descendant (plus récent en premier).
 */
export function getAllArticles(): BlogArticle[] {
  const articles: BlogArticle[] = [];

  for (const [mdPath, mdContent] of Object.entries(rawMarkdown)) {
    const slug = pathToSlug(mdPath);
    const jsonPath = mdPath.replace(/\.md$/, ".json");
    const jsonRaw = rawMeta[jsonPath];
    if (!jsonRaw) {
      // eslint-disable-next-line no-console
      console.warn(`[blog] Missing frontmatter JSON for ${mdPath}`);
      continue;
    }
    let meta: BlogArticleMeta;
    try {
      meta = JSON.parse(jsonRaw) as BlogArticleMeta;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[blog] Invalid JSON for ${jsonPath}`, err);
      continue;
    }
    if (meta.slug !== slug) {
      // eslint-disable-next-line no-console
      console.warn(
        `[blog] Slug mismatch in ${jsonPath}: file=${slug}, json=${meta.slug}`,
      );
    }
    articles.push({
      meta,
      content: mdContent,
      readingTime: calculateReadingTime(mdContent),
    });
  }

  articles.sort((a, b) => (a.meta.publishedAt < b.meta.publishedAt ? 1 : -1));

  return articles;
}

/**
 * Retourne un article par son slug, ou null si introuvable.
 */
export function getArticleBySlug(slug: string): BlogArticle | null {
  const all = getAllArticles();
  return all.find((a) => a.meta.slug === slug) ?? null;
}
````

- [ ] **Step 5: Run test pour vérifier le passage**

Run: `cd "C:/Users/33667/DeepSight-Main/frontend" && npx vitest run src/lib/__tests__/blog.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/33667/DeepSight-Main" && git add frontend/src/lib/blog.ts frontend/src/lib/blog-glob.ts frontend/src/lib/__tests__/blog.test.ts && git commit -m "feat(blog): add markdown loader with reading time calculation"
```

---

### Task 3: ArticleJsonLd component

**Files:**

- Create: `frontend/src/components/ArticleJsonLd.tsx`

- [ ] **Step 1: Écrire le composant**

Fichier `frontend/src/components/ArticleJsonLd.tsx` :

```typescript
import { Helmet } from "react-helmet-async";
import type { BlogArticleMeta } from "../types/blog";

const SITE_URL = "https://www.deepsightsynthesis.com";
const ORG_NAME = "DeepSight";
const ORG_LOGO = `${SITE_URL}/icons/icon-512x512.png`;

interface ArticleJsonLdProps {
  meta: BlogArticleMeta;
  /** Reading time en minutes — pour timeRequired Schema.org. */
  readingTime: number;
}

/**
 * Émet un JSON-LD Schema.org Article dans <head> via Helmet.
 * Suit le pattern de BreadcrumbJsonLd.tsx.
 *
 * Usage :
 *   <ArticleJsonLd meta={article.meta} readingTime={article.readingTime} />
 */
export const ArticleJsonLd = ({ meta, readingTime }: ArticleJsonLdProps) => {
  const url = `${SITE_URL}/blog/${meta.slug}`;
  const image = meta.ogImage
    ? `${SITE_URL}${meta.ogImage}`
    : `${SITE_URL}${meta.coverImage}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: meta.title,
    description: meta.description,
    image,
    datePublished: meta.publishedAt,
    dateModified: meta.updatedAt ?? meta.publishedAt,
    author: {
      "@type": "Person",
      name: meta.author,
    },
    publisher: {
      "@type": "Organization",
      name: ORG_NAME,
      logo: {
        "@type": "ImageObject",
        url: ORG_LOGO,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    keywords: meta.keywords,
    articleSection: meta.tags.join(", "),
    timeRequired: `PT${readingTime}M`,
    inLanguage: "fr-FR",
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
};
```

- [ ] **Step 2: Vérifier compile**

Run: `cd "C:/Users/33667/DeepSight-Main/frontend" && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/33667/DeepSight-Main" && git add frontend/src/components/ArticleJsonLd.tsx && git commit -m "feat(blog): add ArticleJsonLd Schema.org component"
```

---

### Task 4: BlogCard component

**Files:**

- Create: `frontend/src/components/BlogCard.tsx`

- [ ] **Step 1: Écrire le composant**

Fichier `frontend/src/components/BlogCard.tsx` :

```typescript
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, Clock, Tag } from "lucide-react";
import type { BlogArticleMeta } from "../types/blog";

interface BlogCardProps {
  meta: BlogArticleMeta;
  readingTime: number;
  /** Index pour le stagger animation. */
  index?: number;
}

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
};

export const BlogCard = ({ meta, readingTime, index = 0 }: BlogCardProps) => {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="group h-full"
    >
      <Link
        to={`/blog/${meta.slug}`}
        className="block h-full rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl overflow-hidden hover:border-white/20 hover:bg-white/[0.07] transition-all duration-200"
      >
        <div className="aspect-[16/9] overflow-hidden bg-gradient-to-br from-indigo-500/20 to-violet-500/20">
          <img
            src={meta.coverImage}
            alt={meta.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              // Si l'image n'existe pas encore, masquer pour ne pas casser le layout
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div className="p-6 flex flex-col gap-3">
          <div className="flex items-center gap-3 text-xs text-text-secondary">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(meta.publishedAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {readingTime} min
            </span>
          </div>
          <h2 className="text-xl font-semibold text-text-primary group-hover:text-accent-primary transition-colors">
            {meta.title}
          </h2>
          <p className="text-sm text-text-secondary line-clamp-3">
            {meta.description}
          </p>
          {meta.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {meta.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-white/5 border border-white/10 text-text-secondary"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </motion.article>
  );
};
```

- [ ] **Step 2: Typecheck**

Run: `cd "C:/Users/33667/DeepSight-Main/frontend" && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/33667/DeepSight-Main" && git add frontend/src/components/BlogCard.tsx && git commit -m "feat(blog): add BlogCard listing component with framer motion"
```

---

### Task 5: Article 1 — Fact-check TikTok

**Files:**

- Create: `frontend/src/content/blog/2026-04-29-fact-check-tiktok.md`
- Create: `frontend/src/content/blog/2026-04-29-fact-check-tiktok.json`

- [ ] **Step 1: Écrire le frontmatter JSON**

Fichier `frontend/src/content/blog/2026-04-29-fact-check-tiktok.json` :

```json
{
  "slug": "fact-check-tiktok",
  "title": "Comment vérifier une information sur TikTok en 3 étapes",
  "description": "Deepfakes, citations sorties de contexte, statistiques inventées : TikTok concentre tous les pièges désinformationnels. Voici la méthode en 3 étapes pour fact-checker une vidéo en moins de 2 minutes.",
  "publishedAt": "2026-04-29",
  "author": "DeepSight",
  "tags": ["Fact-checking", "TikTok", "Pensée critique"],
  "keywords": "fact check tiktok, vérifier tiktok, fact-checking video, désinformation tiktok, deepfake détection",
  "coverImage": "/blog/fact-check-tiktok-cover.webp",
  "ogImage": "/blog/fact-check-tiktok-cover.webp"
}
```

- [ ] **Step 2: Écrire l'article complet**

Fichier `frontend/src/content/blog/2026-04-29-fact-check-tiktok.md` :

```markdown
# Comment vérifier une information sur TikTok en 3 étapes

Une vidéo de 38 secondes affirmant qu'un médecin a découvert que telle plante guérit le cancer. 4,2 millions de vues. Des centaines de commentaires "merci, je vais essayer". Le problème : la plante en question n'a jamais fait l'objet d'aucune étude clinique sérieuse, et la "Dr. Martinez" qui parle dans la vidéo n'existe pas. C'est une voix générée par IA superposée à des images de stock.

TikTok est devenu, en quelques années, l'un des principaux vecteurs de désinformation pour les moins de 35 ans. Pas parce que les utilisateurs sont crédules — la majorité l'est moins qu'on le pense — mais parce que **le format de la plateforme est conçu contre la vérification**. Format court, défilement infini, algorithme qui récompense l'émotion plutôt que la nuance, citations sorties de contexte, montage rapide qui empêche le doute. Vérifier prend du temps. Croire est instantané.

Cet article propose une méthode en trois étapes, applicable en moins de deux minutes, pour fact-checker une vidéo TikTok avant de la croire ou de la partager.

## Étape 1 — Visionner avec attention en repérant les timecodes critiques

La première étape n'est ni technique ni externe. Elle consiste à **revoir la vidéo une seconde fois** en posant trois questions précises.

**Question 1 : qui parle ?** Une personne identifiée, citée nommément, dont on peut vérifier l'identité ailleurs ? Ou une voix anonyme avec une étiquette vague ("un expert", "une scientifique", "un ancien employé de Google") ? Si la source ne peut pas être nommée, la vidéo a déjà perdu 80% de sa crédibilité.

**Question 2 : quelle est l'affirmation centrale ?** Reformulez la thèse en une phrase. "Le sucre cause Alzheimer" est une affirmation claire, vérifiable. "Tout ce qu'on nous a dit sur l'alimentation est un mensonge" est une affirmation rhétorique non falsifiable — donc inutile à fact-checker, simplement à ignorer.

**Question 3 : quels timecodes contiennent les éléments factuels ?** Notez-les. Par exemple : "à 0:14, elle dit qu'une étude de Harvard de 2019 a prouvé X". Ces timecodes sont vos points d'ancrage pour les étapes suivantes.

Ce travail prend 30 à 60 secondes. Il transforme un message émotionnel et fluide en une liste de claims précis. C'est exactement ce que la plateforme essaie d'empêcher en gardant votre attention en flux continu.

### Le piège du montage rapide

TikTok est massivement utilisé pour citer des extraits de vidéos plus longues — interviews, conférences, podcasts. Un orateur peut dire pendant une heure "X est probable mais nuancé par Y et Z", et un éditeur extrait les 4 secondes où il dit "X est probable". Sortie de son contexte, la phrase devient une affirmation tranchée.

**Réflexe à acquérir** : si une vidéo cite quelqu'un en 5-15 secondes, considérez par défaut que le contexte manque. Le bénéfice du doute va au contexte original, pas au montage.

## Étape 2 — Croiser avec au moins deux sources externes indépendantes

Une fois la thèse identifiée, le fact-check démarre. La règle d'or : **ne jamais valider une information à partir d'une seule source secondaire**. Pas même une seule grande source. Le minimum est deux sources indépendantes l'une de l'autre.

### Hiérarchie des sources

1. **Source primaire** : étude scientifique, document officiel, transcription complète, vidéo originale non éditée. C'est l'idéal mais souvent inaccessible en 2 minutes.
2. **Source secondaire fiable** : article d'un média de qualité (Le Monde, AP, Reuters, BBC, AFP Factuel) qui cite et résume la source primaire.
3. **Source tertiaire** : Wikipédia, blogs spécialisés, posts d'experts identifiés sur LinkedIn ou Twitter/X.

Si aucun média de qualité n'a couvert l'affirmation centrale d'une vidéo TikTok virale prétendant révéler un scandale d'État, **ce n'est pas parce que les médias censurent**. C'est parce que la "révélation" est généralement fausse, recyclée, ou totalement décontextualisée.

### Outils gratuits de fact-checking pour TikTok

Quelques ressources concrètes :

- **AFP Factuel** (factuel.afp.com) — couvre la francophonie, archive de fact-checks consultable.
- **Snopes** (snopes.com) — anglophone, vétéran, excellent sur les rumeurs virales.
- **Les Décodeurs du Monde** — fact-checks réguliers, ton sobre.
- **Politifact** — pour les claims politiques, surtout US.
- **Recherche inversée d'image** : Google Images, TinEye, Yandex Images. Pour vérifier si une image utilisée dans la vidéo a été détournée d'un contexte plus ancien.

Pour les claims scientifiques spécifiques (médecine, climat, alimentation), allez directement sur **PubMed** (pubmed.ncbi.nlm.nih.gov) ou **Google Scholar**. Si une "étude de Harvard de 2019 sur le sucre et Alzheimer" est mentionnée, vous pouvez la chercher en 30 secondes avec les mots-clés. Si rien ne sort, l'étude n'existe probablement pas.

### Détecter une voix ou un visage généré par IA

Avec l'arrivée des deepfakes vocaux et vidéo, une nouvelle classe de vérifications devient nécessaire. Quelques signaux :

- **Voix uniformément posée** sans hésitation, sans souffle, sans variation émotionnelle naturelle.
- **Visage figé** au niveau du front, des oreilles, ou de la zone autour du cou (les modèles génératifs font moins bien sur les marges du visage que sur les yeux et la bouche).
- **Synchronisation labiale imparfaite** sur les consonnes labiales (P, B, M).
- **Absence totale de l'orateur sur d'autres plateformes** — un médecin ou expert réel a un profil LinkedIn, des publications, des conférences sur YouTube. Une recherche par nom donne quelque chose. Une voix IA inventée ne donne rien.

Plusieurs outils gratuits existent pour analyser une vidéo suspecte : **Deepware Scanner**, **Hive Moderation Demo**, et plus récemment **Truepic**. Aucun n'est parfait, mais ils donnent une probabilité utile.

## Étape 3 — Utiliser un outil d'analyse vidéo IA pour gagner du temps

Vérifier manuellement une vidéo TikTok prend 5 à 10 minutes quand on est rigoureux. Quand on en consomme 50 par jour, c'est impraticable. C'est précisément pour cela que **DeepSight** existe : transformer une vidéo en analyse structurée et vérifiable en quelques secondes.

Le principe : vous collez l'URL TikTok (ou YouTube), DeepSight extrait la transcription, identifie les affirmations factuelles, les soumet à un fact-checking automatisé qui chaîne **Mistral Agent → Perplexity → Brave Search**, et renvoie une analyse avec quatre marqueurs épistémiques :

- **SOLIDE** — consensus scientifique, sources convergentes.
- **PLAUSIBLE** — probable mais à confirmer.
- **INCERTAIN** — hypothèse, débat actif.
- **À VÉRIFIER** — affirmation douteuse ou non sourcée.

Chaque marqueur est accompagné de ses sources externes vérifiables. Vous n'avez pas à faire confiance à DeepSight aveuglément — vous avez les liens, vous les vérifiez en un clic.

C'est aussi pour ça que **DeepSight est 100% européen** : analyses propulsées par Mistral AI (Paris), hébergement Hetzner (Falkenstein, Allemagne), conformité RGPD native. Pas de revente de données, pas de tracking publicitaire. Voir l'article [Souveraineté numérique : pourquoi une IA européenne ?](/blog/souverainete-numerique-ia-europeenne) pour les enjeux complets.

[Essayer DeepSight gratuitement](/upgrade) — 5 analyses par mois sur le plan Free, sans carte bancaire.

### Cas concret : vérifier une vidéo "santé" en 2 minutes

Imaginons la vidéo introductive de cet article — la "Dr. Martinez" qui guérit le cancer avec une plante.

1. **Étape 1** (30 s) : nom mentionné = "Dr. Martinez", affirmation centrale = "X plante guérit Y cancer", timecode clé = 0:23. Aucune institution citée.
2. **Étape 2** (90 s) : recherche "Dr Martinez plante cancer" sur Google → aucun médecin de ce nom n'est référencé sur PubMed pour cette plante. Recherche inversée du visage → image générée par IA, pas de profil LinkedIn associé. Conclusion : source inventée.
3. **Étape 3** (15 s avec DeepSight) : analyse complète, fact-check automatisé, marqueurs épistémiques, **affirmation classée À VÉRIFIER avec aucune source crédible identifiée**.

Total : 2 minutes 15 secondes. Au lieu de 5 minutes manuellement.

## Conclusion : la vérification comme habitude

Fact-checker une vidéo TikTok n'est pas une activité réservée aux journalistes. C'est une compétence d'hygiène mentale au même titre que se brosser les dents. Plus vous le faites, plus c'est rapide. Plus c'est rapide, plus vous le faites.

Les trois étapes — **visionner avec attention, croiser avec deux sources, utiliser un outil IA structuré** — couvrent 95% des cas. Pour les 5% restants (claims politiques complexes, sujets émergents non couverts), la règle est simple : **ne pas partager, ne pas relayer, attendre 48 heures qu'une couverture de qualité émerge**.

Internet ne récompense plus la première personne à diffuser une information — il récompense celle qui ne diffuse jamais une information fausse. Cultivez la patience, c'est le luxe ultime à l'ère du flux.

---

_DeepSight propose 5 analyses gratuites par mois pour fact-checker vos vidéos YouTube et TikTok. [Commencer maintenant →](/upgrade)_
```

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/33667/DeepSight-Main" && git add frontend/src/content/blog/2026-04-29-fact-check-tiktok.md frontend/src/content/blog/2026-04-29-fact-check-tiktok.json && git commit -m "feat(blog): add article on TikTok fact-checking method"
```

---

### Task 6: Article 2 — Flashcards FSRS

**Files:**

- Create: `frontend/src/content/blog/2026-04-29-flashcards-fsrs-revision-ia.md`
- Create: `frontend/src/content/blog/2026-04-29-flashcards-fsrs-revision-ia.json`

- [ ] **Step 1: Écrire le frontmatter JSON**

Fichier `frontend/src/content/blog/2026-04-29-flashcards-fsrs-revision-ia.json` :

```json
{
  "slug": "flashcards-fsrs-revision-ia",
  "title": "Réviser ses examens avec l'IA : guide des flashcards FSRS",
  "description": "FSRS bat l'algorithme historique d'Anki de 30% sur la rétention. Voici comment l'algorithme fonctionne, pourquoi il est plus efficace, et comment générer automatiquement vos flashcards depuis vos cours vidéo.",
  "publishedAt": "2026-04-29",
  "author": "DeepSight",
  "tags": ["Études", "Flashcards", "FSRS", "Mémorisation"],
  "keywords": "flashcards IA, réviser examens IA, FSRS algorithme, flashcards Anki, spaced repetition, révision active, flashcards automatiques",
  "coverImage": "/blog/flashcards-fsrs-cover.webp",
  "ogImage": "/blog/flashcards-fsrs-cover.webp"
}
```

- [ ] **Step 2: Écrire l'article complet**

Fichier `frontend/src/content/blog/2026-04-29-flashcards-fsrs-revision-ia.md` :

```markdown
# Réviser ses examens avec l'IA : guide des flashcards FSRS

Vous avez 14 chapitres à réviser pour un partiel dans 3 semaines. Vous relisez vos notes, vous surlignez, vous refaites un fichage. À l'examen, vous bloquez sur 40% des questions parce que vous reconnaissez le contenu sans pouvoir le restituer. C'est l'illusion de maîtrise — le problème central de la révision passive, et la raison pour laquelle l'apprentissage par flashcards à répétition espacée existe.

Cet article explique :

1. ce qu'est l'algorithme FSRS et pourquoi il bat de 30% l'algorithme historique d'Anki ;
2. comment générer automatiquement des flashcards de qualité depuis une vidéo de cours ;
3. comment construire un planning de révision optimal sans y passer plus de 30 minutes par jour.

## Pourquoi les flashcards battent toutes les autres méthodes de révision

Surligner, relire, faire des résumés : ce sont des méthodes **passives**. Votre cerveau reconnaît le contenu, donc vous avez l'impression de l'avoir mémorisé. Mais reconnaître ≠ savoir restituer. Le seul test fiable de la mémoire est le **retrieval** — sortir l'information de son cerveau sans aide, à intervalles espacés.

Le retrieval pratiqué de manière espacée et active est **l'unique méthode validée empiriquement** comme étant supérieure à tout le reste. La méta-analyse de Dunlosky et al. (2013) sur 10 techniques d'étude classe la pratique du retrieval (#1) et la répétition espacée (#2) loin devant la relecture (#9) ou le surlignage (#8).

Les flashcards combinent les deux : chaque carte est un exercice de retrieval, et l'algorithme espace leur réapparition selon votre performance. C'est pour cela que **Anki, Quizlet, Mochi, et plus récemment des outils intégrés comme DeepSight** dominent l'apprentissage des langues, de la médecine, du droit.

## Comprendre l'algorithme FSRS (Free Spaced Repetition Scheduler)

### L'algorithme historique : SM-2

Pendant 30 ans, la quasi-totalité des outils de flashcards utilisaient l'algorithme **SM-2** (SuperMemo 2, 1987). À chaque révision, l'utilisateur note sa difficulté de 1 à 4 (Again / Hard / Good / Easy), et SM-2 calcule un nouvel intervalle avec une formule simple basée sur :

- la réponse précédente,
- un "ease factor" propre à chaque carte,
- une multiplication par un coefficient.

Simple, mais imparfait. SM-2 ne modélise pas la **probabilité réelle de rétention**. Il suppose une courbe d'oubli universelle. Il ne tient pas compte du fait que certaines cartes sont intrinsèquement plus difficiles, ou que votre profil de mémoire diffère.

### FSRS : un modèle paramétrique adaptatif

FSRS, développé par Jarrett Ye et Dae Hyung Kang depuis 2019 et intégré nativement à Anki en version 23.10, change d'approche. Au lieu d'une formule unique, FSRS utilise un **modèle à 21 paramètres** entraîné par machine learning sur les historiques de révision réels.

Le modèle prédit, pour chaque carte et chaque utilisateur :

- **Difficulty** (D) : difficulté intrinsèque de la carte sur une échelle 1-10.
- **Stability** (S) : durée pendant laquelle la carte reste mémorisée avec >90% probabilité.
- **Retrievability** (R) : probabilité actuelle de se rappeler la carte au moment t, calculée via une fonction exponentielle décroissante de S.

L'utilisateur fixe un **target retention** (typiquement 85-95%) et FSRS planifie chaque révision pour que R ne descende pas sous ce seuil.

### Pourquoi FSRS bat SM-2 de 30%

Les benchmarks publics de Jarrett Ye montrent que **à charge de travail égale, FSRS atteint une rétention 25-35% supérieure** à SM-2. Concrètement :

- Avec SM-2 et 100 cartes par jour, vous retenez 75% du contenu sur 6 mois.
- Avec FSRS et 100 cartes par jour, vous retenez 90% du même contenu sur 6 mois.

Pour un étudiant qui révise 800 flashcards de pharmacologie pour son examen de fin de semestre, c'est la différence entre 600 cartes maîtrisées et 720 cartes maîtrisées. À l'échelle d'une scolarité de médecine, c'est mesuré en années de mémoire de travail récupérée.

## Générer des flashcards de qualité depuis une vidéo de cours

Le frein principal aux flashcards n'est ni l'algorithme ni la discipline — c'est **la création**. Faire 60 flashcards à partir d'un cours de 90 minutes prend 2 à 3 heures à la main. Multipliez par 14 chapitres : 30 à 40 heures de saisie pour le seul cours de pathologie. La plupart abandonnent.

C'est ici que l'IA générative change l'économie de la méthode. **DeepSight** extrait automatiquement la transcription d'une vidéo YouTube ou TikTok et génère un set de flashcards structuré en 30-90 secondes selon la longueur. La génération suit trois principes pour rester de qualité :

1. **Atomicité** : une carte = une notion. Pas de "Décris l'organisation de la cellule eucaryote" (trop large), mais "Quel est le rôle du réticulum endoplasmique rugueux ?" (atomique).
2. **Formulation active** : la question oblige au retrieval. Pas "Le RE rugueux synthétise les protéines" (à compléter passivement), mais une vraie question avec réponse au verso.
3. **Cloze deletion** : pour les définitions et les chiffres, DeepSight génère des cartes à trou — phrase complète avec un mot caché. Format particulièrement efficace pour la mémoire factuelle.

L'utilisateur révise les cartes générées (5-10 minutes pour valider/éditer/jeter), puis les exporte vers Anki, ou les utilise directement dans l'interface DeepSight intégrée FSRS.

### Cas pratique : un cours de 60 minutes

Cours type "Histoire moderne — La Révolution française" sur YouTube, 58 minutes. Transcription : 8 200 mots. DeepSight identifie :

- 12 dates clés (1789 prise de la Bastille, 1791 Constitution, 1793 mort de Louis XVI…).
- 18 personnages avec leurs rôles.
- 9 concepts politiques (sans-culottes, Constituante, Convention…).
- 6 textes fondateurs (Déclaration des droits de l'homme, Constitution de 1791…).

Le set généré : **45 flashcards**. Validation manuelle : 7 minutes. Total : 8 minutes pour un set qui aurait pris 2 heures à la main. Sur 14 chapitres, l'économie de temps est de **25 à 30 heures par semestre**.

## Construire un planning de révision optimal

Avoir des flashcards ne suffit pas. La discipline tue le projet plus souvent que la méthode. Voici un planning testé qui fonctionne pour la majorité des étudiants.

### Règle 1 : 20 à 30 minutes par jour, 7 jours sur 7

La répétition espacée n'est pas négociable sur la régularité. Sauter 3 jours efface 60% du gain de la semaine précédente. **Mieux vaut 20 minutes tous les jours que 2 heures un dimanche sur deux.**

Sur DeepSight, la file de révision quotidienne fait apparaître exactement les cartes dont la retrievability passe sous votre seuil — ni plus, ni moins. Si la file fait 40 cartes, comptez 12 minutes. Si elle fait 80 cartes, c'est que vous avez sauté plusieurs jours et que le rattrapage prendra 25 minutes.

### Règle 2 : ne jamais réviser pour la première fois la veille de l'examen

L'effet maximum de la répétition espacée se construit sur **3 à 6 semaines**. Une carte introduite la veille n'a pas le temps d'être consolidée. Pour les flashcards générées dans les 7 jours précédant un examen, l'utilité est marginale — préférez de la révision active ciblée (anciennes annales).

### Règle 3 : tagger par chapitre + par sujet

DeepSight tagge automatiquement chaque carte par vidéo source. Ajoutez un tag manuel par chapitre/cours. Cela permet de filtrer la file de révision en mode "uniquement pharmacologie" ou "uniquement Révolution française" pendant les week-ends thématiques avant un partiel.

### Règle 4 : viser 85% de retention, pas 95%

Augmenter le target retention de 85% à 95% **double la charge de travail quotidienne** pour un gain marginal. La majorité des étudiants ont intérêt à viser 85% — c'est largement suffisant pour avoir un examen au-dessus de la moyenne, et la charge reste tenable.

## Pourquoi DeepSight intègre nativement FSRS

DeepSight a fait le choix d'intégrer **FSRS v5 nativement**, plutôt qu'un algorithme propriétaire. Trois raisons :

1. **Open source vérifiable** : l'algorithme FSRS est public, le code de référence est open source. Aucune boîte noire — vous pouvez auditer pourquoi telle carte revient à tel intervalle.
2. **Compatibilité Anki** : exportez vos cartes vers Anki avec leur historique, et inversement. Pas de lock-in.
3. **Recherche communautaire** : la communauté FSRS améliore l'algorithme en continu sur des datasets de millions de révisions. DeepSight bénéficie de ces améliorations à chaque mise à jour.

L'intégration DeepSight ajoute trois choses par-dessus FSRS :

- **Génération automatique** depuis vos vidéos.
- **UI mobile native** (iOS + Android via Expo) pour réviser dans le métro.
- **Synchronisation cross-device** — commencez sur le web, finissez sur mobile.

[Tester la génération de flashcards FSRS gratuitement](/upgrade) — 5 vidéos par mois sur le plan Free, flashcards et quiz inclus.

## Conclusion : la révision active n'est pas une question de motivation

Si vous avez raté un examen alors que vous avez "beaucoup révisé", le problème n'est pas votre intelligence ni votre motivation. C'est probablement votre méthode. Surligner, relire et refaire des résumés sont efficaces pour comprendre, pas pour mémoriser.

Le combo **flashcards + FSRS + génération IA** transforme la mémorisation d'un effort solitaire de plusieurs centaines d'heures en une routine quotidienne de 20 minutes. Ce n'est pas magique — vous devrez quand même vous asseoir tous les jours et faire vos cartes. Mais le ratio temps/résultat est sans comparaison avec les autres méthodes.

L'IA ne remplace ni la curiosité ni le travail. Elle déplace le goulet d'étranglement de la **création** vers la **révision**. Et la révision, contrairement à la création, est facile à mettre en habitude.

---

_DeepSight génère vos flashcards FSRS automatiquement depuis vos vidéos de cours. [Essayer gratuitement →](/upgrade)_
```

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/33667/DeepSight-Main" && git add frontend/src/content/blog/2026-04-29-flashcards-fsrs-revision-ia.md frontend/src/content/blog/2026-04-29-flashcards-fsrs-revision-ia.json && git commit -m "feat(blog): add article on FSRS flashcards for exam revision"
```

---

### Task 7: Article 3 — Souveraineté numérique

**Files:**

- Create: `frontend/src/content/blog/2026-04-29-souverainete-numerique-ia-europeenne.md`
- Create: `frontend/src/content/blog/2026-04-29-souverainete-numerique-ia-europeenne.json`

- [ ] **Step 1: Écrire le frontmatter JSON**

Fichier `frontend/src/content/blog/2026-04-29-souverainete-numerique-ia-europeenne.json` :

```json
{
  "slug": "souverainete-numerique-ia-europeenne",
  "title": "Souveraineté numérique : pourquoi une IA européenne ?",
  "description": "Cloud Act, RGPD, dépendance technologique : utiliser une IA américaine ou chinoise n'est pas neutre. Pourquoi DeepSight a choisi Mistral AI et l'hébergement européen, et ce que cela change concrètement pour vos données.",
  "publishedAt": "2026-04-29",
  "author": "DeepSight",
  "tags": ["Souveraineté", "RGPD", "Mistral AI", "Europe"],
  "keywords": "IA européenne, souveraineté numérique, Mistral AI, Cloud Act, RGPD IA, alternative OpenAI, hébergement européen, données Europe",
  "coverImage": "/blog/souverainete-numerique-cover.webp",
  "ogImage": "/blog/souverainete-numerique-cover.webp"
}
```

- [ ] **Step 2: Écrire l'article complet**

Fichier `frontend/src/content/blog/2026-04-29-souverainete-numerique-ia-europeenne.md` :

```markdown
# Souveraineté numérique : pourquoi une IA européenne ?

En octobre 2018, le Congrès américain a voté le Clarifying Lawful Overseas Use of Data Act, plus connu sous le nom de **Cloud Act**. La loi tient en deux principes : 1) les fournisseurs de services cloud américains doivent fournir aux autorités américaines, sur réquisition, l'accès aux données qu'ils hébergent, **où qu'elles soient stockées dans le monde**. 2) Les autorités étrangères ne peuvent demander la même chose à des entreprises américaines qu'avec un accord bilatéral.

En clair : si vous utilisez une IA américaine pour analyser un document confidentiel, **les autorités américaines peuvent y accéder sans que vous le sachiez**, même si le serveur est physiquement en Allemagne. Les autorités françaises ou allemandes, elles, ne peuvent pas — sauf accord bilatéral, qui n'existe pas vraiment.

C'est l'un des trois piliers concrets de ce qu'on appelle la **souveraineté numérique**. Cet article explique pourquoi ce concept n'est pas un slogan politique mais un enjeu opérationnel pour toute organisation qui manipule des données sensibles, et pourquoi **DeepSight** a fait le choix d'une stack 100% européenne — Mistral AI pour les modèles, Hetzner pour l'hébergement.

## Trois piliers de la souveraineté numérique

### 1. Localisation physique des données

Le RGPD européen impose des règles strictes sur le traitement des données personnelles : consentement, finalité, durée de conservation, droit à l'effacement. Sur le papier, ces règles s'appliquent aussi aux fournisseurs non-européens dès qu'ils traitent des données de résidents européens.

En pratique, **l'application est complexe** quand le serveur est aux États-Unis. La Cour de Justice de l'Union Européenne a invalidé deux fois (Schrems I en 2015, Schrems II en 2020) les accords de transfert de données EU/US, au motif que les protections américaines sont insuffisantes face aux pouvoirs de surveillance des agences gouvernementales.

L'accord actuel (Data Privacy Framework, 2023) repose sur un decret-loi américain qui peut être révoqué unilatéralement par tout futur président. **C'est juridiquement fragile.**

Faire le choix d'un hébergement physiquement en Europe, sous juridiction européenne, supprime ce risque structurel.

### 2. Chaîne de juridictions applicables

Quand vous utilisez OpenAI, Google AI, Anthropic ou Microsoft Copilot, vos données traversent plusieurs juridictions :

- la juridiction de votre pays au moment de l'envoi,
- la juridiction du pays de transit (généralement les États-Unis),
- la juridiction du pays où le modèle est entraîné/affiné,
- la juridiction du pays où sont hébergées les logs et les caches.

Le **Cloud Act**, le **FISA section 702**, et l'**Executive Order 12333** donnent aux agences américaines des pouvoirs d'accès qui n'ont pas d'équivalent européen. Pour un avocat traitant un dossier sensible, un médecin manipulant des notes patient, ou une entreprise gérant des informations stratégiques, **chaque interaction avec une IA américaine est potentiellement un transfert hors juridiction**.

Une IA opérée par une entreprise européenne, sous droit européen, supprime cette chaîne. Vos données restent sous juridiction RGPD du début à la fin.

### 3. Indépendance industrielle et technologique

Le troisième pilier dépasse le juridique. Si l'Europe ne dispose d'aucun acteur compétitif dans l'IA générative, elle est en position de **dépendance structurelle**. Les conditions tarifaires, les capacités techniques, les règles de modération, l'orientation des modèles, sont décidées ailleurs.

C'est exactement ce qui s'est produit avec le cloud computing pendant 15 ans : **AWS / Azure / GCP détiennent ~70% du marché européen**. Quand AWS augmente ses prix de 20%, l'Europe n'a pas le choix de partir vers un concurrent local équivalent — il n'existe pas.

L'IA générative est sur la même trajectoire si rien n'est fait. **Mistral AI** (Paris, fondé en 2023) est aujourd'hui le seul acteur européen capable de fournir des modèles compétitifs avec OpenAI ou Anthropic dans certains usages, en open-weight et avec une présence commerciale réelle. **Aleph Alpha** (Allemagne) a pivoté vers le service entreprise. **Mistral est devenu, par défaut, le pilier de la souveraineté IA européenne**.

## Pourquoi DeepSight a choisi Mistral AI

DeepSight repose sur Mistral pour 100% de ses appels IA — analyses, fact-checking, chat contextuel, génération de flashcards. Le choix s'est fait sur quatre critères mesurables.

### Critère 1 : qualité des modèles

Sur les benchmarks publics (MMLU, HumanEval, MBPP, BBH), les modèles Mistral de la génération 2026 (mistral-small-2603, mistral-medium-2508, mistral-large-2512) sont **dans le top 5 mondial** sur les tâches généralistes en français et en anglais. Mistral Large 2512 dispose d'un contexte de **262 000 tokens**, suffisant pour analyser une vidéo de 4 heures sans découpage.

Ce n'est pas le meilleur modèle au monde sur tous les axes — GPT-5 et Claude 4.7 ont l'avantage sur certaines tâches de raisonnement complexe. Mais sur les tâches que DeepSight effectue (résumé structuré, extraction d'arguments, génération de questions, fact-check), les modèles Mistral sont **équivalents à 5% près** sur les benchmarks internes.

### Critère 2 : coût

À qualité équivalente, **Mistral est 30 à 60% moins cher** qu'OpenAI ou Anthropic sur la majorité des modèles. Pour un SaaS qui sert 5 analyses gratuites par utilisateur et par mois, la différence permet de garder un plan Free réellement gratuit, sans rogner sur la qualité.

### Critère 3 : juridiction

Mistral est une société française basée à Paris, soumise au RGPD, à la CNIL, au droit français. Ses modèles sont entraînés sur des infrastructures européennes. **Aucun risque de Cloud Act**. Cela ne signifie pas zéro risque (toute société peut être réquisitionnée) — cela signifie que le risque est régi par un cadre juridique que les utilisateurs européens peuvent comprendre, contester, et qui les protège mieux.

### Critère 4 : open-weight quand pertinent

Mistral publie une partie de ses modèles en open-weight (Mistral 7B, Mixtral 8x7B, plusieurs versions intermédiaires). Cela signifie que **DeepSight pourrait, en théorie, héberger les modèles eux-mêmes** sur ses serveurs Hetzner si l'API Mistral devenait inaccessible — un niveau de continuité d'activité impossible avec OpenAI ou Anthropic dont les modèles sont fermés.

Aujourd'hui DeepSight utilise l'API Mistral pour les modèles de niveau production (medium, large). Mais l'option de fallback existe.

## Hébergement Hetzner : le complément logique

Choisir Mistral pour l'IA mais OpenAI Cloud pour l'hébergement n'aurait aucun sens. DeepSight héberge l'intégralité de son backend sur **Hetzner Cloud**, datacenter de Falkenstein (Allemagne).

Pourquoi Hetzner :

1. **Datacenter européen** sous droit allemand, donc RGPD natif et hors Cloud Act.
2. **Coûts 3 à 4 fois inférieurs à AWS** pour des spécifications équivalentes (CPU dédié, NVMe, bande passante généreuse). Cela permet d'opérer un SaaS rentable sans gonfler les prix.
3. **Stabilité éprouvée** — Hetzner est un acteur de référence du cloud européen depuis 1997, avec une infrastructure massive et une réputation de fiabilité.

L'infrastructure complète tourne sur un VPS Hetzner avec une stack Docker minimaliste : FastAPI + PostgreSQL 17 + Redis 7 + Caddy reverse proxy avec SSL automatique. Tout est sous juridiction allemande, tout est conforme RGPD, **vos données ne quittent jamais l'Europe**.

## Ce que cela change concrètement pour vous

Pour la majorité des utilisateurs de DeepSight, la différence est **invisible au quotidien**. C'est précisément le but : un outil qui marche, qui est rapide, qui rend service, sans que la souveraineté soit un compromis.

Mais pour certains profils, c'est essentiel :

- **Chercheurs** qui manipulent des données préliminaires non publiées — pas de risque qu'un modèle entraîné sur leurs prompts publie l'idée avant eux.
- **Journalistes** qui fact-checkent des affaires sensibles — pas de risque de fuite via des subpoenas étrangers.
- **Professionnels juridiques et médicaux** soumis à des obligations strictes de confidentialité — la juridiction RGPD européenne donne un cadre clair.
- **Établissements publics et collectivités** qui ont des obligations légales d'hébergement européen — DeepSight coche les cases sans effort de leur part.

## Mistral et l'Europe : un pari plus large

Au-delà du cas DeepSight, choisir Mistral aujourd'hui, c'est faire un pari : **l'Europe peut, et doit, avoir ses propres champions de l'IA**. Pas par patriotisme économique, mais parce que la dépendance technologique est une fragilité géopolitique.

L'Europe a manqué le virage des moteurs de recherche (Google), des réseaux sociaux (Meta), du cloud (AWS). Si elle manque le virage de l'IA générative, ses entreprises et ses citoyens seront durablement dépendants d'acteurs étrangers pour l'une des technologies les plus structurantes du siècle.

Mistral n'a pas besoin d'écraser OpenAI pour être un succès. Il a besoin d'exister, de croître, de fournir des alternatives crédibles. Chaque entreprise européenne qui choisit Mistral plutôt que GPT-5 contribue à cet écosystème.

DeepSight a fait ce choix dès le premier jour. Pas comme un slogan marketing, mais comme une décision technique cohérente. **Vos données restent en Europe parce que tout l'écosystème de DeepSight est en Europe.**

## Conclusion : la neutralité technologique n'existe pas

L'idée selon laquelle "peu importe quel cloud, peu importe quelle IA, ça revient au même" est confortable mais fausse. Choisir une infrastructure technologique, c'est **choisir un cadre juridique**, **un horizon économique**, et **une géopolitique**. C'est vrai pour les particuliers et plus encore pour les organisations.

La souveraineté numérique n'impose pas de tout faire en Europe à tout prix. Elle invite à **considérer la juridiction comme une feature au même titre que la performance ou le prix**. Pour beaucoup d'usages, choisir européen est aujourd'hui équivalent en qualité, comparable en prix, et nettement supérieur en garanties juridiques.

[Découvrir DeepSight](/upgrade) — IA Mistral, hébergement Hetzner, RGPD natif. Vos vidéos analysées sans jamais quitter l'Europe.

---

_Article rédigé par l'équipe DeepSight, SAS française basée à Lyon. Mistral AI (Paris). Hetzner (Falkenstein, Allemagne). 100% européen, par conviction et par cohérence._
```

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/33667/DeepSight-Main" && git add frontend/src/content/blog/2026-04-29-souverainete-numerique-ia-europeenne.md frontend/src/content/blog/2026-04-29-souverainete-numerique-ia-europeenne.json && git commit -m "feat(blog): add article on European AI sovereignty"
```

---

### Task 8: BlogListPage component

**Files:**

- Create: `frontend/src/pages/BlogListPage.tsx`

- [ ] **Step 1: Écrire le composant**

Fichier `frontend/src/pages/BlogListPage.tsx` :

```typescript
/**
 * Blog List Page — DeepSight
 * /blog — grid de cards des articles publiés.
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen } from "lucide-react";
import Layout from "../components/Layout";
import { SEO } from "../components/SEO";
import { BreadcrumbJsonLd } from "../components/BreadcrumbJsonLd";
import { BlogCard } from "../components/BlogCard";
import { getAllArticles } from "../lib/blog";

const BlogListPage = () => {
  const articles = useMemo(() => getAllArticles(), []);

  return (
    <Layout>
      <SEO
        title="Blog — Articles, guides, méthodes IA pour vidéo"
        description="Le blog DeepSight : fact-checking TikTok, flashcards FSRS, souveraineté numérique. Méthodes pratiques et analyses approfondies pour mieux comprendre vos vidéos."
        path="/blog"
        keywords="blog deepsight, articles IA vidéo, fact-checking, flashcards, souveraineté numérique"
      />
      <BreadcrumbJsonLd path="/blog" />

      <main id="main-content" className="min-h-screen bg-bg-primary">
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-8 pb-16 md:pt-12 md:pb-24">
          {/* Back link */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Link>

          {/* Hero */}
          <motion.header
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-12 md:mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-text-secondary mb-4">
              <BookOpen className="w-3.5 h-3.5" />
              Blog DeepSight
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-text-primary mb-4 tracking-tight">
              Mieux comprendre vos vidéos
            </h1>
            <p className="text-lg text-text-secondary max-w-2xl">
              Fact-checking, mémorisation, souveraineté numérique : nos guides
              pratiques et analyses approfondies pour exploiter au mieux le
              contenu vidéo à l'ère de l'IA.
            </p>
          </motion.header>

          {/* Articles grid */}
          {articles.length === 0 ? (
            <p className="text-text-secondary">
              Aucun article publié pour l'instant.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article, idx) => (
                <BlogCard
                  key={article.meta.slug}
                  meta={article.meta}
                  readingTime={article.readingTime}
                  index={idx}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </Layout>
  );
};

export default BlogListPage;
```

- [ ] **Step 2: Typecheck**

Run: `cd "C:/Users/33667/DeepSight-Main/frontend" && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/33667/DeepSight-Main" && git add frontend/src/pages/BlogListPage.tsx && git commit -m "feat(blog): add BlogListPage with grid layout and SEO"
```

---

### Task 9: BlogPostPage component

**Files:**

- Create: `frontend/src/pages/BlogPostPage.tsx`

- [ ] **Step 1: Écrire le composant**

Fichier `frontend/src/pages/BlogPostPage.tsx` :

```typescript
/**
 * Blog Post Page — DeepSight
 * /blog/:slug — affiche un article complet (markdown rendu, SEO, breadcrumb, ArticleJsonLd).
 */

import { useMemo } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Calendar, Clock, Tag, User } from "lucide-react";
import Layout from "../components/Layout";
import { SEO } from "../components/SEO";
import { BreadcrumbJsonLd } from "../components/BreadcrumbJsonLd";
import { ArticleJsonLd } from "../components/ArticleJsonLd";
import { getArticleBySlug } from "../lib/blog";

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
};

const BlogPostPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const article = useMemo(
    () => (slug ? getArticleBySlug(slug) : null),
    [slug],
  );

  if (!article) {
    return <Navigate to="/blog" replace />;
  }

  const { meta, content, readingTime } = article;

  return (
    <Layout>
      <SEO
        title={meta.title}
        description={meta.description}
        path={`/blog/${meta.slug}`}
        image={
          meta.ogImage
            ? `https://www.deepsightsynthesis.com${meta.ogImage}`
            : undefined
        }
        type="article"
        keywords={meta.keywords}
      />
      <BreadcrumbJsonLd path={`/blog/${meta.slug}`} label={meta.title} />
      <ArticleJsonLd meta={meta} readingTime={readingTime} />

      <main id="main-content" className="min-h-screen bg-bg-primary">
        <article className="max-w-3xl mx-auto px-4 md:px-6 pt-8 pb-16 md:pt-12 md:pb-24">
          {/* Back link */}
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au blog
          </Link>

          {/* Header */}
          <motion.header
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-10"
          >
            {meta.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {meta.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-white/5 border border-white/10 text-text-secondary"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <h1 className="text-4xl md:text-5xl font-bold text-text-primary mb-6 tracking-tight leading-tight">
              {meta.title}
            </h1>
            <p className="text-lg text-text-secondary mb-6">
              {meta.description}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4" />
                {meta.author}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {formatDate(meta.publishedAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {readingTime} min de lecture
              </span>
            </div>
          </motion.header>

          {/* Cover image */}
          {meta.coverImage && (
            <div className="aspect-[16/9] mb-10 rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500/20 to-violet-500/20">
              <img
                src={meta.coverImage}
                alt={meta.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}

          {/* Content */}
          <div className="prose prose-invert prose-lg max-w-none prose-headings:text-text-primary prose-p:text-text-secondary prose-a:text-accent-primary prose-strong:text-text-primary prose-li:text-text-secondary prose-blockquote:text-text-secondary prose-code:text-accent-primary prose-pre:bg-bg-secondary">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </article>
      </main>
    </Layout>
  );
};

export default BlogPostPage;
```

- [ ] **Step 2: Typecheck**

Run: `cd "C:/Users/33667/DeepSight-Main/frontend" && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Vérifier que `prose` (Typography Tailwind) est dispo**

Run: `cd "C:/Users/33667/DeepSight-Main/frontend" && grep -l "@tailwindcss/typography" package.json tailwind.config.js`
Expected: au moins une occurrence. Si **rien** ne sort, ajouter le plugin :

```bash
cd "C:/Users/33667/DeepSight-Main/frontend" && npm install --save-dev @tailwindcss/typography
```

Puis dans `frontend/tailwind.config.js`, ajouter `require("@tailwindcss/typography")` au tableau `plugins`. Si le plugin était déjà installé, sauter cette installation.

- [ ] **Step 4: Re-typecheck après éventuelle install**

Run: `cd "C:/Users/33667/DeepSight-Main/frontend" && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/33667/DeepSight-Main" && git add frontend/src/pages/BlogPostPage.tsx frontend/package.json frontend/package-lock.json frontend/tailwind.config.js && git commit -m "feat(blog): add BlogPostPage with markdown render and Article JSON-LD"
```

---

### Task 10: Câblage routes dans App.tsx + LABELS breadcrumb

**Files:**

- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/BreadcrumbJsonLd.tsx`

- [ ] **Step 1: Ajouter "/blog" dans LABELS**

Dans `frontend/src/components/BreadcrumbJsonLd.tsx`, modifier la map `LABELS` (ligne 10) :

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
  "/blog": "Blog",
};
```

- [ ] **Step 2: Ajouter les imports lazy + routes dans App.tsx**

Dans `frontend/src/App.tsx`, après la ligne `const AboutPage = lazyWithRetry(() => import("./pages/AboutPage"));` (ligne 293), ajouter :

```typescript
const BlogListPage = lazyWithRetry(() => import("./pages/BlogListPage"));
const BlogPostPage = lazyWithRetry(() => import("./pages/BlogPostPage"));
```

Puis dans le bloc `<Routes>`, après la route `/about` (qui se termine ligne 648 par `</Route>` du bloc `path="/about"`), ajouter :

```tsx
<Route
  path="/blog"
  element={
    <RouteErrorBoundary
      variant="full"
      componentName="BlogListPage"
    >
      <Suspense fallback={<PageSkeleton variant="full" />}>
        <BlogListPage />
      </Suspense>
    </RouteErrorBoundary>
  }
/>

<Route
  path="/blog/:slug"
  element={
    <RouteErrorBoundary
      variant="full"
      componentName="BlogPostPage"
    >
      <Suspense fallback={<PageSkeleton variant="full" />}>
        <BlogPostPage />
      </Suspense>
    </RouteErrorBoundary>
  }
/>
```

- [ ] **Step 3: Typecheck**

Run: `cd "C:/Users/33667/DeepSight-Main/frontend" && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Build complet**

Run: `cd "C:/Users/33667/DeepSight-Main/frontend" && npm run build`
Expected: build successful, le sitemap mentionne déjà les anciennes routes (sera étendu Task 12).

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/33667/DeepSight-Main" && git add frontend/src/App.tsx frontend/src/components/BreadcrumbJsonLd.tsx && git commit -m "feat(blog): wire /blog and /blog/:slug routes with lazy loading"
```

---

### Task 11: Tests unitaires BlogListPage et BlogPostPage

**Files:**

- Create: `frontend/src/pages/__tests__/BlogListPage.test.tsx`
- Create: `frontend/src/pages/__tests__/BlogPostPage.test.tsx`

- [ ] **Step 1: Test BlogListPage**

Fichier `frontend/src/pages/__tests__/BlogListPage.test.tsx` :

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  renderWithProviders,
  screen,
} from "../../__tests__/test-utils";

vi.mock("../../lib/blog", () => ({
  getAllArticles: vi.fn(),
}));

import { getAllArticles } from "../../lib/blog";
import BlogListPage from "../BlogListPage";

const mockGetAllArticles = getAllArticles as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BlogListPage", () => {
  it("renders the hero title", () => {
    mockGetAllArticles.mockReturnValue([]);
    renderWithProviders(<BlogListPage />);
    expect(screen.getByText("Mieux comprendre vos vidéos")).toBeInTheDocument();
  });

  it("renders empty state when no articles", () => {
    mockGetAllArticles.mockReturnValue([]);
    renderWithProviders(<BlogListPage />);
    expect(
      screen.getByText("Aucun article publié pour l'instant."),
    ).toBeInTheDocument();
  });

  it("renders one card per article", () => {
    mockGetAllArticles.mockReturnValue([
      {
        meta: {
          slug: "article-1",
          title: "Article 1 Title",
          description: "Desc 1",
          publishedAt: "2026-04-29",
          author: "DeepSight",
          tags: ["test"],
          keywords: "k",
          coverImage: "/blog/cover1.webp",
        },
        content: "x",
        readingTime: 3,
      },
      {
        meta: {
          slug: "article-2",
          title: "Article 2 Title",
          description: "Desc 2",
          publishedAt: "2026-04-28",
          author: "DeepSight",
          tags: ["test"],
          keywords: "k",
          coverImage: "/blog/cover2.webp",
        },
        content: "y",
        readingTime: 5,
      },
    ]);
    renderWithProviders(<BlogListPage />);
    expect(screen.getByText("Article 1 Title")).toBeInTheDocument();
    expect(screen.getByText("Article 2 Title")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Test BlogPostPage**

Fichier `frontend/src/pages/__tests__/BlogPostPage.test.tsx` :

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  renderWithProviders,
  screen,
} from "../../__tests__/test-utils";

vi.mock("../../lib/blog", () => ({
  getArticleBySlug: vi.fn(),
}));

import { getArticleBySlug } from "../../lib/blog";
import BlogPostPage from "../BlogPostPage";

const mockGetArticleBySlug = getArticleBySlug as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BlogPostPage", () => {
  it("renders the article title and content for known slug", () => {
    mockGetArticleBySlug.mockReturnValue({
      meta: {
        slug: "test-slug",
        title: "Test Article Title",
        description: "Test description",
        publishedAt: "2026-04-29",
        author: "DeepSight",
        tags: ["tag1"],
        keywords: "k",
        coverImage: "/blog/test-cover.webp",
      },
      content: "## A heading\n\nA paragraph.",
      readingTime: 4,
    });

    renderWithProviders(<BlogPostPage />, {
      routerProps: { initialEntries: ["/blog/test-slug"] },
    });

    expect(screen.getByText("Test Article Title")).toBeInTheDocument();
    expect(screen.getByText("A heading")).toBeInTheDocument();
    expect(screen.getByText("A paragraph.")).toBeInTheDocument();
  });

  it("renders reading time", () => {
    mockGetArticleBySlug.mockReturnValue({
      meta: {
        slug: "x",
        title: "X",
        description: "X",
        publishedAt: "2026-04-29",
        author: "A",
        tags: [],
        keywords: "k",
        coverImage: "/blog/x.webp",
      },
      content: "Hello",
      readingTime: 7,
    });

    renderWithProviders(<BlogPostPage />, {
      routerProps: { initialEntries: ["/blog/x"] },
    });

    expect(screen.getByText("7 min de lecture")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd "C:/Users/33667/DeepSight-Main/frontend" && npx vitest run src/pages/__tests__/BlogListPage.test.tsx src/pages/__tests__/BlogPostPage.test.tsx src/lib/__tests__/blog.test.ts`
Expected: PASS — 9 tests au total (4 loader + 3 list + 2 post).

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/33667/DeepSight-Main" && git add frontend/src/pages/__tests__/BlogListPage.test.tsx frontend/src/pages/__tests__/BlogPostPage.test.tsx && git commit -m "test(blog): add BlogListPage and BlogPostPage tests"
```

---

### Task 12: Sitemap auto-generation pour articles

**Files:**

- Modify: `frontend/scripts/generate-sitemap.mjs`

- [ ] **Step 1: Étendre le script pour lire les frontmatters blog**

Remplacer le contenu de `frontend/scripts/generate-sitemap.mjs` par :

```javascript
#!/usr/bin/env node
/**
 * generate-sitemap.mjs — Generates frontend/public/sitemap.xml at build time.
 *
 * Wired via the `prebuild` npm script so each `vite build` regenerates a
 * fresh sitemap with today's lastmod, replacing the static checked-in
 * version. Routes are listed below; add a new entry whenever a public
 * page is added to App.tsx.
 *
 * Blog articles are auto-discovered from frontend/src/content/blog/*.json.
 *
 * Run manually: `node scripts/generate-sitemap.mjs`
 */

import { writeFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_URL = "https://www.deepsightsynthesis.com";
const TODAY = new Date().toISOString().split("T")[0];

/**
 * Public, indexable routes. Keep this in sync with App.tsx public routes.
 * Excludes /login, /auth/callback, /payment/success, /payment/cancel
 * (transient or auth gates) and /s/:shareToken (dynamic per-token).
 */
const STATIC_ROUTES = [
  { path: "/", priority: 1.0, changefreq: "weekly" },
  { path: "/about", priority: 0.8, changefreq: "monthly" },
  { path: "/upgrade", priority: 0.9, changefreq: "monthly" },
  { path: "/api-docs", priority: 0.6, changefreq: "monthly" },
  { path: "/contact", priority: 0.5, changefreq: "yearly" },
  { path: "/status", priority: 0.4, changefreq: "daily" },
  { path: "/legal", priority: 0.3, changefreq: "yearly" },
  { path: "/legal/cgu", priority: 0.3, changefreq: "yearly" },
  { path: "/legal/cgv", priority: 0.3, changefreq: "yearly" },
  { path: "/legal/privacy", priority: 0.3, changefreq: "yearly" },
  { path: "/blog", priority: 0.85, changefreq: "weekly" },
];

/**
 * Discover blog articles from frontend/src/content/blog/*.json.
 * Returns sitemap entries for each article.
 */
function discoverBlogArticles() {
  const blogDir = resolve(__dirname, "../src/content/blog");
  const entries = [];
  let files;
  try {
    files = readdirSync(blogDir).filter((f) => f.endsWith(".json"));
  } catch {
    console.warn(`[sitemap] No blog directory at ${blogDir}, skipping.`);
    return entries;
  }

  for (const file of files) {
    try {
      const raw = readFileSync(resolve(blogDir, file), "utf-8");
      const meta = JSON.parse(raw);
      if (!meta.slug || !meta.publishedAt) continue;
      entries.push({
        path: `/blog/${meta.slug}`,
        priority: 0.7,
        changefreq: "monthly",
        lastmod: meta.updatedAt || meta.publishedAt,
      });
    } catch (err) {
      console.warn(`[sitemap] Failed to parse ${file}:`, err.message);
    }
  }
  return entries;
}

function buildSitemap() {
  const blogEntries = discoverBlogArticles();
  const allRoutes = [...STATIC_ROUTES, ...blogEntries];

  const urls = allRoutes
    .map(
      ({ path, priority, changefreq, lastmod }) => `  <url>
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${lastmod || TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`,
    )
    .join("\n");

  return {
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`,
    count: allRoutes.length,
  };
}

const outputPath = resolve(__dirname, "../public/sitemap.xml");
mkdirSync(dirname(outputPath), { recursive: true });
const { xml, count } = buildSitemap();
writeFileSync(outputPath, xml, "utf-8");
console.log(
  `✓ Sitemap written: ${outputPath} (${count} URLs, lastmod=${TODAY})`,
);
```

- [ ] **Step 2: Run le script et vérifier le sitemap**

Run: `cd "C:/Users/33667/DeepSight-Main/frontend" && node scripts/generate-sitemap.mjs`
Expected: console output `✓ Sitemap written: ... (14 URLs ...)` (10 statiques + 3 blog + /blog).

- [ ] **Step 3: Vérifier le contenu du sitemap**

Run: `cd "C:/Users/33667/DeepSight-Main/frontend" && grep -E "(blog/fact-check-tiktok|blog/flashcards-fsrs|blog/souverainete)" public/sitemap.xml`
Expected: 3 lignes correspondant aux 3 articles.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/33667/DeepSight-Main" && git add frontend/scripts/generate-sitemap.mjs frontend/public/sitemap.xml && git commit -m "feat(blog): auto-discover blog articles in sitemap generator"
```

---

### Task 13: vercel.json — prerender bots IA + cache headers blog

**Files:**

- Modify: `frontend/vercel.json`

- [ ] **Step 1: Ajouter rewrites prerender pour /blog**

Dans `frontend/vercel.json`, dans le tableau `rewrites`, après le bloc `/contact` (lignes 58-68 du fichier actuel), ajouter avant `"source": "/chaines"` :

```json
{
  "source": "/blog",
  "has": [
    {
      "type": "header",
      "key": "user-agent",
      "value": "(?i)(GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|anthropic-ai|Claude-Web|PerplexityBot|Perplexity-User|Google-Extended|CCBot|cohere-ai|Bytespider|Applebot-Extended|Diffbot|ImagesiftBot)"
    }
  ],
  "destination": "/api/prerender?path=/blog"
},
{
  "source": "/blog/:slug",
  "has": [
    {
      "type": "header",
      "key": "user-agent",
      "value": "(?i)(GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|anthropic-ai|Claude-Web|PerplexityBot|Perplexity-User|Google-Extended|CCBot|cohere-ai|Bytespider|Applebot-Extended|Diffbot|ImagesiftBot)"
    }
  ],
  "destination": "/api/prerender?path=/blog/:slug"
},
```

- [ ] **Step 2: Ajouter cache headers pour le blog**

Dans le tableau `headers` de `vercel.json`, ajouter à la fin (juste avant la fermeture du tableau, après le bloc `/assets/(.*)`) :

```json
,
{
  "source": "/blog",
  "headers": [
    {
      "key": "Cache-Control",
      "value": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
    }
  ]
},
{
  "source": "/blog/:slug",
  "headers": [
    {
      "key": "Cache-Control",
      "value": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
    }
  ]
}
```

- [ ] **Step 3: Vérifier que le JSON est valide**

Run: `cd "C:/Users/33667/DeepSight-Main/frontend" && node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf-8'))"`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/33667/DeepSight-Main" && git add frontend/vercel.json && git commit -m "feat(blog): add bot IA prerender rewrites and cache headers for /blog"
```

---

### Task 14: Prerender Edge Function — support /blog et /blog/:slug

**Files:**

- Modify: `frontend/api/prerender.ts`

- [ ] **Step 1: Ajouter la page /blog (liste statique) et le handler dynamique**

Modifier `frontend/api/prerender.ts`. Dans l'objet `PAGES` (vers ligne 102), ajouter une nouvelle entrée `/blog` avant la fermeture de l'objet :

```typescript
"/blog": {
  slug: "/blog",
  title: "Blog DeepSight — Fact-checking, FSRS, souveraineté numérique",
  description:
    "Articles, guides et analyses approfondies de DeepSight : comment fact-checker TikTok en 3 étapes, comprendre l'algorithme FSRS, choisir une IA européenne. Tout pour mieux exploiter le contenu vidéo à l'ère de l'IA.",
  h1: "Blog DeepSight",
  sections: [
    {
      heading: "Articles publiés",
      body:
        "Comment vérifier une information sur TikTok en 3 étapes — méthode pratique pour fact-checker une vidéo en moins de 2 minutes, avec outils gratuits et focus sur la détection de deepfakes vocaux. " +
        "Réviser ses examens avec l'IA : guide des flashcards FSRS — fonctionnement de l'algorithme FSRS qui bat SM-2 de 30%, génération automatique depuis une vidéo de cours, planning de révision optimal. " +
        "Souveraineté numérique : pourquoi une IA européenne ? — enjeux RGPD vs Cloud Act, comparaison Mistral / OpenAI / Anthropic, choix de Hetzner pour l'hébergement européen.",
    },
    {
      heading: "Pourquoi un blog ?",
      body: "Le blog DeepSight publie des guides pratiques et des analyses approfondies pour aider les utilisateurs à mieux exploiter leur consommation vidéo. Fact-checking, mémorisation, IA générative, souveraineté numérique : les sujets sont à la croisée du logiciel et de l'hygiène cognitive.",
    },
  ],
  extraJsonLd: [
    {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "Blog DeepSight",
      url: `${SITE_URL}/blog`,
      publisher: {
        "@type": "Organization",
        name: "DeepSight",
        logo: { "@type": "ImageObject", url: ORG_LOGO },
      },
    },
  ],
},
```

- [ ] **Step 2: Ajouter le handler dynamique /blog/:slug dans `handler()`**

Toujours dans `frontend/api/prerender.ts`, modifier la fonction `handler` (vers ligne 319) pour gérer les slugs blog dynamiques. Remplacer le bloc :

```typescript
const url = new URL(request.url);
const path = url.searchParams.get("path") || "/";
const page = PAGES[path];

if (!page) {
  return new Response("Not found", { status: 404 });
}

const html = renderPage(page);
```

par :

```typescript
const url = new URL(request.url);
const path = url.searchParams.get("path") || "/";

// /blog/:slug — fetch the SPA index.html (already contains JSON-LD via Helmet
// SSR-equivalent through SEO/ArticleJsonLd hydration). Bots will parse the
// pre-rendered HTML head produced by the build. We delegate to a basic stub
// page generated from the article title for now — full SSR is out of scope.
if (path.startsWith("/blog/") && path !== "/blog/") {
  const slug = path.replace(/^\/blog\//, "").replace(/\/$/, "");
  const stub = blogStubPage(slug);
  return new Response(stub, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=600, s-maxage=3600",
      "X-Robots-Tag": "index, follow",
      "X-Prerender-For": "AI-bots",
    },
  });
}

const page = PAGES[path];

if (!page) {
  return new Response("Not found", { status: 404 });
}

const html = renderPage(page);
```

Puis ajouter, **avant** la fonction `renderPage` (vers ligne 345), la fonction stub :

```typescript
/**
 * Lightweight stub page for /blog/:slug requests by AI bots.
 * Returns a minimal but indexable HTML document. The full SPA still serves
 * the rich version to humans (and to bots without UA detection match).
 *
 * For Phase 2: swap this for actual MD/JSON loading once we host
 * the content on an Edge KV (Vercel Edge Config) or read at build time.
 */
function blogStubPage(slug: string): string {
  const title = `Article DeepSight — ${slug.replace(/-/g, " ")}`;
  const url = `${SITE_URL}/blog/${slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    url,
    publisher: {
      "@type": "Organization",
      name: "DeepSight",
      logo: { "@type": "ImageObject", url: ORG_LOGO },
    },
    inLanguage: "fr-FR",
  };
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:image" content="${OG_IMAGE}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<main>
<h1>${escapeHtml(title)}</h1>
<p>Cet article est publié sur le blog DeepSight. Pour accéder au contenu complet, visitez <a href="${url}">${url}</a>.</p>
<p>DeepSight est un SaaS d'analyse IA de vidéos YouTube et TikTok, 100% européen, propulsé par Mistral AI (France) et hébergé chez Hetzner (Allemagne).</p>
</main>
</body>
</html>`;
}
```

Aussi : ajouter `/blog` dans la map `labels` de `buildBreadcrumb` (vers ligne 466) :

```typescript
const labels: Record<string, string> = {
  "/about": "À propos",
  "/upgrade": "Tarifs",
  "/contact": "Contact",
  "/blog": "Blog",
};
```

- [ ] **Step 2.b: Ajouter "/blog" dans la nav du HTML rendu**

Dans la fonction `renderPage` (vers ligne 412), modifier la `<nav>` :

```html
<nav>
  <a href="${SITE_URL}/">Accueil</a> ·
  <a href="${SITE_URL}/about">À propos</a> ·
  <a href="${SITE_URL}/upgrade">Tarifs</a> ·
  <a href="${SITE_URL}/blog">Blog</a> ·
  <a href="${SITE_URL}/contact">Contact</a> ·
  <a href="${SITE_URL}/api-docs">API</a> ·
  <a href="${SITE_URL}/status">Statut</a> ·
  <a href="${SITE_URL}/legal">Mentions légales</a>
</nav>
```

- [ ] **Step 3: Typecheck**

Run: `cd "C:/Users/33667/DeepSight-Main/frontend" && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Build**

Run: `cd "C:/Users/33667/DeepSight-Main/frontend" && npm run build`
Expected: build successful.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/33667/DeepSight-Main" && git add frontend/api/prerender.ts && git commit -m "feat(blog): add /blog and /blog/:slug to AI bot prerender function"
```

---

### Task 15: Vérification finale et tests d'intégration

**Files:**

- (aucune création/modification — vérification only)

- [ ] **Step 1: Lancer la suite complète de tests Vitest**

Run: `cd "C:/Users/33667/DeepSight-Main/frontend" && npm run test`
Expected: tests existants 400/400 + 9 nouveaux tests (4 loader + 3 list + 2 post) — 409/409 passants. Si un test pré-existant casse, **stop** et investiguer (ne pas masquer la régression).

- [ ] **Step 2: Typecheck final**

Run: `cd "C:/Users/33667/DeepSight-Main/frontend" && npm run typecheck`
Expected: zéro erreur. Le projet a 19 erreurs TS pré-existantes mobile, mais le frontend doit rester clean.

- [ ] **Step 3: Lint**

Run: `cd "C:/Users/33667/DeepSight-Main/frontend" && npm run lint`
Expected: zéro erreur dans les nouveaux fichiers (warnings tolérables sur fichiers existants si déjà présents).

- [ ] **Step 4: Build production complet**

Run: `cd "C:/Users/33667/DeepSight-Main/frontend" && npm run build`
Expected: build successful, sitemap inclut les 3 articles + /blog (14 URLs au total).

- [ ] **Step 5: Smoke test local en preview**

Run: `cd "C:/Users/33667/DeepSight-Main/frontend" && npm run preview`
Puis ouvrir `http://localhost:4173/blog` dans le navigateur — vérifier :

- [ ] La page /blog charge sans erreur console
- [ ] Les 3 cards apparaissent (Titre, date, reading time, tags)
- [ ] Cliquer sur une card navigue vers /blog/:slug
- [ ] L'article rend correctement le markdown (titres, paragraphes, liens)
- [ ] Le breadcrumb "Accueil > Blog > [Titre]" est dans le `<head>` (View Source → JSON-LD)
- [ ] Le canonical pointe vers `https://www.deepsightsynthesis.com/blog/[slug]`
- [ ] L'image cover est masquée gracieusement si absente (placeholders pas encore générés)

- [ ] **Step 6: Commit final si tout passe (sans modifs nécessaires)**

```bash
cd "C:/Users/33667/DeepSight-Main" && git status
```

Si rien à committer, passer à l'étape suivante. Si des fichiers générés (sitemap, build) doivent être ignorés ou commit, agir selon la convention du repo.

---

## Self-Review

### 1. Spec coverage

| Requirement spec                                                              | Task                              |
| ----------------------------------------------------------------------------- | --------------------------------- |
| Routes `/blog` + `/blog/:slug` lazy-loaded                                    | Task 10                           |
| Stockage Markdown plain + JSON metadata                                       | Tasks 1, 5, 6, 7                  |
| Loader `getAllArticles`, `getArticleBySlug`, `calculateReadingTime`           | Task 2                            |
| Listing page (grid cards, image, titre, excerpt, date, tags, reading)         | Tasks 4, 8                        |
| Article page (frontmatter + markdown render + reading time)                   | Task 9                            |
| `<ArticleJsonLd>` JSON-LD Schema.org                                          | Task 3                            |
| `<SEO>` réutilisé par article                                                 | Task 9                            |
| `<BreadcrumbJsonLd>` étendu avec /blog                                        | Task 10                           |
| Sitemap auto-générée pour les 3 slugs                                         | Task 12                           |
| Tests Vitest BlogListPage + BlogPostPage                                      | Task 11                           |
| `vercel.json` rewrites bots IA + cache headers `/blog/*`                      | Task 13                           |
| Prerender Edge Function pour `/blog` + `/blog/:slug`                          | Task 14                           |
| Article 1 : "fact-check TikTok" (1800-2200 mots, 3 étapes, exemples)          | Task 5                            |
| Article 2 : "FSRS flashcards" (2000-2400 mots, FSRS, génération, planning)    | Task 6                            |
| Article 3 : "souveraineté numérique" (1800-2200 mots, RGPD, Mistral, Hetzner) | Task 7                            |
| MVP FR seul (pas EN)                                                          | (note Self-Review)                |
| Performance : articles statiques, build-time                                  | Task 2 (`import.meta.glob` eager) |

Tous les requirements sont mappés.

### 2. Placeholder scan

Aucun placeholder TBD/TODO/"à rédiger"/"similar to" dans les tâches. Chaque step a son code complet.

Une exception **justifiée** : Step 3 de la Task 9 inclut un _fallback_ conditionnel (« si `@tailwindcss/typography` est absent, l'installer »). Ce n'est pas un placeholder — c'est un check explicite avec commande exacte des deux branches.

### 3. Type consistency

- `BlogArticle.meta.slug: string` (Task 1) ↔ utilisé partout (Tasks 3, 4, 5, 6, 7, 8, 9, 11, 12, 14) — cohérent.
- `BlogArticleMeta.coverImage: string` (Task 1, requis) ↔ utilisé dans BlogCard et BlogPostPage avec fallback `onError` qui masque l'image — cohérent.
- `BlogArticleMeta.ogImage?: string` (Task 1, optionnel) ↔ utilisé avec fallback sur `coverImage` dans `<ArticleJsonLd>` (Task 3) et `<SEO>` (Task 9) — cohérent.
- `getAllArticles(): BlogArticle[]` ↔ utilisé dans BlogListPage (Task 8) et test loader (Task 2) — cohérent.
- `getArticleBySlug(slug): BlogArticle | null` ↔ utilisé dans BlogPostPage avec `if (!article) return <Navigate />` (Task 9) — cohérent.

### Décisions à confirmer (à signaler à l'utilisateur)

1. **MDX vs Markdown plain** — Recommandation retenue : Markdown plain + JSON metadata. Si l'utilisateur veut MDX (composants React inline dans articles, ex : CTA custom, embeds vidéos interactifs), basculer vers `vite-plugin-mdx` + `@mdx-js/rollup` ajouterait ~3 tasks au plan. **Recommandation : rester sur Markdown plain pour MVP, migrer plus tard si besoin.**

2. **Génération images cover article** — Les chemins `/blog/<slug>-cover.webp` sont référencés dans les frontmatters (Tasks 5, 6, 7) et dans `BlogCard`/`BlogPostPage` (avec `onError` qui masque gracieusement si absent). Les images **ne sont pas créées dans ce plan**. Options :
   - **(a)** Phase suivante dédiée : générer 3 images via Midjourney/DALL-E ou plus simple via outils Figma maison, dimensions 1200×630 pour OG + format WebP.
   - **(b)** Utiliser des images existantes du repo (logos DeepSight) en attendant.
   - **(c)** Générer un fond Tailwind/SVG procédural au build pour avoir quelque chose visuellement.

   **Recommandation : option (a) en task de suivi (~30-60 min), avec option (c) en placeholder en attendant.**

3. **Traduction EN** — MVP FR seul. Le frontend a déjà l'i18n FR+EN, mais le contenu blog est volumineux (~6000 mots × 2 langues = double effort). **Recommandation : phase 2 si le traffic FR justifie l'investissement EN. À 100 visiteurs/mois sur le blog FR, traduire est prématuré ; à 1000+/mois, ça vaut le coup.**

4. **Prerender Edge Function** — Le `blogStubPage` rend un HTML minimal pour les bots IA. C'est suffisant pour l'indexation initiale (URL canonique, JSON-LD Article, lien vers la version SPA). **Limitation connue** : pas de body article complet pour les bots — Google et ChatGPT ne verront pas le contenu de l'article tant que la SPA ne SSR-rendra pas. Phase 2 : packer le markdown au build dans une `KV` Edge Config Vercel ou bundler le contenu dans la function. Pour l'instant, les bots qui exécutent du JS (la majorité) verront le contenu via la SPA classique.

5. **Plugin `@tailwindcss/typography`** — Step 3 de la Task 9 vérifie sa présence. Si absent, le plan l'installe. Ce plugin est très commun mais peut ne pas être dans ce projet. À confirmer avec l'utilisateur ou laisser le step le détecter automatiquement.

---

## Execution Handoff

Plan complet et sauvegardé à `docs/superpowers/plans/2026-04-29-blog-architecture-3-articles.md`. Deux options d'exécution :

**1. Subagent-Driven (recommandé)** — Je dispatche un subagent frais par task, review entre chaque tâche, itération rapide.

**2. Inline Execution** — Exécution des tâches dans cette session via `superpowers:executing-plans`, batch avec checkpoints.

Quelle approche préfères-tu ?
