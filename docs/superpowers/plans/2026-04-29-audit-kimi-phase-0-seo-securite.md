# Audit Kimi Phase 0 — SEO + Headers Sécurité + Pricing v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aligner les surfaces publiques HTML statiques de DeepSight (index.html, vercel.json, UpgradePage SEO) sur la grille pricing v2 (Pro 8,99 € / Expert 19,99 €), corriger les vrais bugs Phase 0 de l'audit Kimi (anciens prix v0 résiduels, headers sécurité absents, pas de Product/Offer schema sur /upgrade) — sans toucher au système Helmet runtime déjà fonctionnel.

**Architecture:** Modifications ciblées sur 3 fichiers existants + 1 composant React JSON-LD (avec test Vitest TDD) + 1 fichier de configuration Vercel. Le composant `<ProductJsonLd>` suit le pattern de `<BreadcrumbJsonLd>` (Helmet `<script type="application/ld+json">`), exporte une fonction pure `buildProductJsonLd()` testable sans render React. Aucune modification du code Helmet existant : on l'utilise.

**Tech Stack:** React 18 + TypeScript strict + react-helmet-async ^2.0.5 + Vitest 2.1 + @testing-library/react 16 (déjà installés). Vercel JSON pour headers HTTP.

**⚠️ Couplage release-train obligatoire :** Ce plan ne doit **pas** être mergé/déployé seul. Il publie publiquement la grille v2 (8,99 €/19,99 €). Il forme une **release atomique** avec le plan jumeau `2026-04-29-pricing-v2-stripe-grandfathering.md` (à venir batch 2 — création des Stripe Price IDs v2, rename interne `plus → pro`/`pro → expert`, drapeau `User.is_legacy_pricing` pour grandfathering v1). Sinon : SEO annoncerait 8,99 € pendant que Stripe facturerait encore 5,99 €. Voir section **Release coordination** en bas de plan.

---

## Contexte préalable

### Plan d'orchestration (à confirmer)

Le contexte de mission mentionne un plan-frère `2026-04-29-RELEASE-ORCHESTRATION.md` (commit `021e4bf1`) qui contiendrait le mapping des conflits Alembic (010 voice-packs / 011 pricing-v2 / 012 parrainage / 013 edge-tts) et le release-train obligatoire #1 SEO + #3 pricing-v2. **À l'écriture de ce plan, ce fichier n'existe pas encore dans le repo** — il sera lu en premier par l'engineer une fois publié. Si l'orchestration finale renomme la branche cible, mettre à jour la décision **D4** ci-dessous.

### Trois grilles tarifaires cohabitent dans le code

| Grille                          | Statut                                                        | Plans                               | Où elle vit encore                                                                                                          |
| ------------------------------- | ------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **v0** (relique)                | À supprimer                                                   | Plus 4,99 € / Pro 9,99 €            | `frontend/index.html` JSON-LD lignes 163-197, `frontend/src/pages/UpgradePage.tsx:1142` description SEO                     |
| **v1** (prod actuelle facturée) | Maintenue pour abonnés legacy via grandfathering (autre plan) | Pro 5,99 € / Expert 14,99 €         | Stripe Price IDs production, `backend/src/core/config.py`, `frontend/src/config/planPrivileges.ts` (côté display + backend) |
| **v2** (cible publique)         | **Annoncée par ce plan**                                      | Pro **8,99 €** / Expert **19,99 €** | Sera affichée dans `index.html`, `<ProductJsonLd>` sur `/upgrade`, description SEO `UpgradePage.tsx`                        |

**⚠️ L'engineer ne touche que la grille v0 (suppression) et v2 (création) dans ce plan.** La grille v1 est traitée par le plan jumeau `pricing-v2-stripe-grandfathering`. Ne pas modifier `planPrivileges.ts` ni `backend/src/core/config.py` ici.

### Grille v2 cible publique (à inscrire dans tous les fichiers de ce plan)

| Plan    | Prix mensuel | Prix annuel (−17 %)          | Analyses/mois | Max durée vidéo |
| ------- | ------------ | ---------------------------- | ------------- | --------------- |
| Gratuit | 0 €          | —                            | 5             | 15 min          |
| Pro     | **8,99 €**   | **89,90 €/an** (≈ 7,49/mo)   | 30            | 2 h             |
| Expert  | **19,99 €**  | **199,90 €/an** (≈ 16,66/mo) | 100           | 4 h             |

### État DeepSight déjà bon — NE PAS recréer

L'audit Kimi 2026-04-29 contient plusieurs faux positifs. Voici ce qui est déjà fonctionnel et ne doit pas être recréé :

- ✅ `react-helmet-async ^2.0.5` installé (`frontend/package.json`)
- ✅ `<HelmetProvider>` global wrap dans `frontend/src/main.tsx:131-143`
- ✅ Composant `<SEO>` complet dans `frontend/src/components/SEO.tsx` (76 lignes — title/description/canonical/og/twitter/hreflang), utilisé par 25+ pages
- ✅ Composant `<BreadcrumbJsonLd>` dans `frontend/src/components/BreadcrumbJsonLd.tsx`
- ✅ FAQ JSON-LD inline dans `frontend/src/pages/LandingPage.tsx:602-618`
- ✅ Prerendering bots IA (GPTBot/ClaudeBot/Perplexity) dans `frontend/vercel.json:31-67`
- ✅ Cache headers existants dans `frontend/vercel.json:88-167`

### Faux positifs Kimi à documenter en intro de PR (pour reviewer)

L'audit affirme « Toutes les pages se canonisent vers la homepage ». **C'est faux pour le HTML rendu** : Helmet réécrit `<link rel="canonical">` au mount de chaque page via `<SEO path="/upgrade">`, etc. Le `<link rel="canonical" href=".../">` statique de `index.html:77` n'est qu'un fallback initial pour les bots qui n'exécutent pas JS — et ces bots passent déjà par les rewrites prerender (`/api/prerender`) configurés en `vercel.json:25-67`. Aucun changement de canonical à faire ici.

### État branche

- Branche cible attendue : `feature/audit-kimi-plans-2026-04-29` (à créer si elle n'existe pas — voir **D4**)
- Branche actuelle au moment de la rédaction : `feat/merge-voice-chat-context` (différente — décision **D4** à confirmer avec l'utilisateur avant Task 1)

---

## File Structure

| Fichier                                                    | Action                                    | Responsabilité                                                                                                      |
| ---------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `frontend/index.html`                                      | Modify (lignes 11, 13-15, 18-20, 152-199) | Title + meta description + meta keywords + JSON-LD WebApplication offers (grille v2)                                |
| `frontend/vercel.json`                                     | Modify (ajout dans le tableau `headers`)  | Ajouter une entrée `/(.*)` avec CSP + 4 headers sécurité                                                            |
| `frontend/src/pages/UpgradePage.tsx`                       | Modify (lignes 1140-1145)                 | Description SEO en grille v2 + import + mount `<ProductJsonLd />`                                                   |
| `frontend/src/components/ProductJsonLd.tsx`                | Create                                    | Composant React + fonction pure `buildProductJsonLd()` (Schema.org Product/Offers grille v2)                        |
| `frontend/src/components/__tests__/ProductJsonLd.test.tsx` | Create                                    | Vitest — 5 tests sur `buildProductJsonLd()` (structure, prix Pro 8,99, prix Expert 19,99, devise EUR, count offres) |

**Décomposition** : Chaque fichier a une responsabilité unique. Le composant `<ProductJsonLd>` exporte sa fonction de construction `buildProductJsonLd()` pour tester la structure JSON-LD sans `render()` React (DRY, pas de duplication entre prod et tests).

---

## Tasks

### Task 1: Aligner `index.html` sur la grille pricing v2

**Files:**

- Modify: `frontend/index.html:11`
- Modify: `frontend/index.html:13-15`
- Modify: `frontend/index.html:18-20`
- Modify: `frontend/index.html:152-199`

**Pourquoi :** L'audit Kimi confirme : (a) le `<title>` ne mentionne pas TikTok alors que la prop est supportée depuis mars 2026, (b) la meta description n'évoque pas TikTok ni les nouveautés (flashcards, fact-check), (c) les keywords manquent TikTok/voice agent, (d) le JSON-LD WebApplication contient encore les anciens prix v0 (Plus 4,99 € / Pro 9,99 €) absents de la roadmap publique. Cette task supprime entièrement v0 et installe v2.

- [ ] **Step 1: Mettre à jour le `<title>` (ligne 11)**

```html
<title>DeepSight — Analyse YouTube & TikTok par IA</title>
```

Remplace exactement :

```html
<title>DeepSight - Analyse YouTube IA</title>
```

- [ ] **Step 2: Mettre à jour la meta description (lignes 13-15)**

```html
<meta
  name="description"
  content="Analysez vos vidéos YouTube et TikTok avec l'IA : synthèses sourcées, fact-checking nuancé, flashcards FSRS, chat contextuel et voice agent. 100 % européen, propulsé par Mistral AI."
/>
```

- [ ] **Step 3: Mettre à jour les meta keywords (lignes 18-20)**

```html
<meta
  name="keywords"
  content="youtube, tiktok, analyse vidéo, IA, intelligence artificielle, résumé, synthèse, fact-checking, flashcards, voice agent, Mistral AI, deepsight"
/>
```

- [ ] **Step 4: Remplacer le JSON-LD WebApplication par la grille v2 (lignes 152-199)**

Sélectionner exactement le bloc actuel (du `<script type="application/ld+json">` ouvrant ligne 152 jusqu'à son `</script>` fermant ligne 199) et le remplacer par :

```html
<!-- 🧠 JSON-LD Structured Data — WebApplication (pricing v2 publique) -->
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "DeepSight",
    "alternateName": "DeepSight Synthesis",
    "url": "https://www.deepsightsynthesis.com",
    "description": "Analysez et synthétisez vos vidéos YouTube et TikTok avec l'IA. Synthèses sourcées, fact-checking nuancé, flashcards FSRS, chat contextuel, voice agent. 100% européen, propulsé par Mistral AI.",
    "applicationCategory": "EducationalApplication",
    "operatingSystem": "Web, iOS, Android, Chrome",
    "inLanguage": ["fr", "en"],
    "offers": [
      {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "EUR",
        "name": "Gratuit",
        "description": "5 analyses/mois, vidéos jusqu'à 15 min, flashcards, quiz, chat contextuel"
      },
      {
        "@type": "Offer",
        "price": "8.99",
        "priceCurrency": "EUR",
        "name": "Pro",
        "description": "30 analyses/mois, vidéos jusqu'à 2 h, mind maps, fact-check, web search, exports PDF",
        "priceSpecification": {
          "@type": "UnitPriceSpecification",
          "price": "8.99",
          "priceCurrency": "EUR",
          "unitText": "MONTH"
        }
      },
      {
        "@type": "Offer",
        "price": "19.99",
        "priceCurrency": "EUR",
        "name": "Expert",
        "description": "100 analyses/mois, vidéos jusqu'à 4 h, voice agent ElevenLabs, playlists illimitées, deep research, priority queue",
        "priceSpecification": {
          "@type": "UnitPriceSpecification",
          "price": "19.99",
          "priceCurrency": "EUR",
          "unitText": "MONTH"
        }
      }
    ]
  }
</script>
```

Notes :

- `unitText` passe de `"monthly"` (non standard) à `"MONTH"` (UN/CEFACT, recommandé par Schema.org).
- L'`Organization` JSON-LD juste en dessous (lignes 200-225) reste **inchangé**.
- Pas d'`aggregateRating` ajouté ici (voir **D1** dans Self-review).

- [ ] **Step 5: Vérification visuelle locale**

Run :

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run dev
```

Ouvrir `http://localhost:5173/` puis dans DevTools Console exécuter :

```js
document
  .querySelectorAll('script[type="application/ld+json"]')
  .forEach((s) => console.log(JSON.parse(s.textContent)));
```

Expected : 2 objets logged. Le premier `WebApplication` doit lister 3 offers avec prix `"0"`, `"8.99"`, `"19.99"` et **aucun** `"4.99"` ou `"9.99"`.

- [ ] **Step 6: Commit**

```bash
git add frontend/index.html
git commit -m "feat(seo): align index.html WebApplication JSON-LD with pricing v2"
```

---

### Task 2: Ajouter les headers de sécurité HTTP dans `vercel.json`

**Files:**

- Modify: `frontend/vercel.json:87-167` (extension du tableau `headers`)

**Pourquoi :** L'audit Kimi confirme : aucun header de sécurité (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) n'est présent côté Vercel. Conséquences : XSS plus facile, clickjacking possible, fuite Referer cross-origin, accès géoloc/caméra théoriquement ouvert à tous les iframes. La config Caddy backend a déjà du HSTS — cette task étend la même hygiène au front Vercel.

- [ ] **Step 1: Whitelister tous les services tiers réellement utilisés en prod**

Vérifier rapidement (lecture seule, pour confiance dans la CSP) que les domaines suivants sont bien ceux utilisés. Run :

```bash
cd C:/Users/33667/DeepSight-Main/frontend
grep -rE "stripe\.com|posthog\.com|sentry\.io|elevenlabs\.io|supabase\.co|crisp\.chat|youtube\.com|tiktok\.com|fonts\.(googleapis|gstatic)\.com" src/ --include="*.ts" --include="*.tsx" --include="*.html" -l | head -20
```

Expected : voir au moins `index.html` (Google Fonts), un fichier PostHog, un fichier Sentry, un fichier Stripe (`api.ts` ou checkout), et un fichier Crisp si actif. La CSP du Step suivant les whitelist tous.

- [ ] **Step 2: Ajouter l'entrée `headers` globale**

Dans `frontend/vercel.json`, dans le tableau `"headers"` (qui commence ligne 87), insérer **comme première entrée** (avant l'objet `/sitemap.xml` actuel ligne 89), un nouvel objet :

```json
{
  "source": "/(.*)",
  "headers": [
    {
      "key": "Content-Security-Policy",
      "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.posthog.com https://eu.i.posthog.com https://*.sentry.io https://browser.sentry-cdn.com https://client.crisp.chat https://settings.crisp.chat; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://client.crisp.chat; img-src 'self' https: data: blob:; font-src 'self' data: https://fonts.gstatic.com https://client.crisp.chat; connect-src 'self' https://api.deepsightsynthesis.com https://*.stripe.com https://*.posthog.com https://eu.i.posthog.com https://*.sentry.io https://*.ingest.sentry.io https://*.elevenlabs.io https://api.elevenlabs.io https://*.supabase.co wss://*.supabase.co https://client.crisp.chat https://wss.relay.crisp.chat wss://client.relay.crisp.chat https://storage.crisp.chat; frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.youtube.com https://www.youtube-nocookie.com https://www.tiktok.com https://game.crisp.chat; media-src 'self' https: blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self' https://*.stripe.com; frame-ancestors 'self'; upgrade-insecure-requests"
    },
    {
      "key": "X-Frame-Options",
      "value": "SAMEORIGIN"
    },
    {
      "key": "X-Content-Type-Options",
      "value": "nosniff"
    },
    {
      "key": "Referrer-Policy",
      "value": "strict-origin-when-cross-origin"
    },
    {
      "key": "Permissions-Policy",
      "value": "camera=(self), microphone=(self), payment=(self), geolocation=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), midi=(), sync-xhr=()"
    }
  ]
}
```

⚠️ Vercel applique les headers dans l'ordre du tableau. Mettre cette entrée **en tête** garantit qu'elle s'applique avant les entrées spécifiques (qui n'ajoutent que `Cache-Control` et `Content-Type` — donc pas de conflit, juste une priorité claire).

⚠️ La CSP autorise `'unsafe-inline'` et `'unsafe-eval'` pour `script-src`. Justification dans **D2** ci-dessous (Vite 5 prod build, PostHog, Stripe SDK injectent du JS inline). Une migration vers `nonce` ou `hash` est trackée dans le plan jumeau `pricing-v2-stripe-grandfathering` (post-MVP).

- [ ] **Step 3: Validation locale du JSON**

Run :

```bash
cd C:/Users/33667/DeepSight-Main/frontend
node -e "console.log(JSON.parse(require('fs').readFileSync('vercel.json','utf8')).headers.length)"
```

Expected : un nombre supérieur ou égal à `9` (8 entrées existantes + la nouvelle). Si ça plante : erreur de syntaxe JSON dans le fichier — relire avec un linter.

- [ ] **Step 4: Validation CSP avec un parser**

Run :

```bash
cd C:/Users/33667/DeepSight-Main/frontend
node -e "
const csp = JSON.parse(require('fs').readFileSync('vercel.json','utf8')).headers[0].headers.find(h => h.key === 'Content-Security-Policy').value;
const directives = csp.split(';').map(d => d.trim().split(' ')[0]).filter(Boolean);
console.log('Directives:', directives);
console.log('Has frame-ancestors:', directives.includes('frame-ancestors'));
console.log('Has upgrade-insecure-requests:', directives.includes('upgrade-insecure-requests'));
"
```

Expected output (l'ordre peut varier, mais les 3 lignes doivent être imprimées avec `true` pour les deux derniers) :

```
Directives: [ 'default-src', 'script-src', 'style-src', 'img-src', 'font-src', 'connect-src', 'frame-src', 'media-src', 'worker-src', 'object-src', 'base-uri', 'form-action', 'frame-ancestors', 'upgrade-insecure-requests' ]
Has frame-ancestors: true
Has upgrade-insecure-requests: true
```

- [ ] **Step 5: Commit**

```bash
git add frontend/vercel.json
git commit -m "feat(security): add CSP and 4 security headers to Vercel config"
```

---

### Task 3: Corriger la description SEO de `UpgradePage.tsx`

**Files:**

- Modify: `frontend/src/pages/UpgradePage.tsx:1140-1144`

**Pourquoi :** Cette description est servie aux moteurs de recherche et bots IA via Helmet sur `/upgrade`. Elle mentionne actuellement `Plus (4,99€/mois) et Pro (9,99€/mois)` — exactement la grille v0 obsolète. Si on déploie SEO sans corriger ça, on annonce 4,99 € alors que Stripe facturera bientôt 8,99 €.

- [ ] **Step 1: Remplacer la description**

Edit ciblé :

```tsx
<SEO
  title="Tarifs"
  description="Découvrez les plans DeepSight : Gratuit, Pro (8,99 €/mois) et Expert (19,99 €/mois). Analysez vos vidéos YouTube et TikTok avec l'IA, fact-checking nuancé et voice agent."
  path="/upgrade"
/>
```

Remplace exactement (lignes 1140-1144) :

```tsx
<SEO
  title="Tarifs"
  description="Découvrez les plans DeepSight : Gratuit, Plus (4,99€/mois) et Pro (9,99€/mois). Analysez vos vidéos YouTube et TikTok avec l'IA."
  path="/upgrade"
/>
```

- [ ] **Step 2: Vérifier qu'il ne reste plus aucun ancien prix dans le fichier**

Run :

```bash
cd C:/Users/33667/DeepSight-Main/frontend
grep -nE "4[,.]99|9[,.]99" src/pages/UpgradePage.tsx | grep -v "^\s*\*" || echo "OK aucun reste v0"
```

Expected : `OK aucun reste v0`. Si des occurrences sortent : contexte → prix Stripe v1 actuel (5,99 € / 14,99 €) — laisser tel quel, il sera traité par le plan jumeau `pricing-v2-stripe-grandfathering`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/UpgradePage.tsx
git commit -m "fix(seo): update UpgradePage SEO description to pricing v2"
```

---

### Task 4: Créer `<ProductJsonLd>` en TDD (test d'abord)

**Files:**

- Create: `frontend/src/components/__tests__/ProductJsonLd.test.tsx`
- Create: `frontend/src/components/ProductJsonLd.tsx`

**Pourquoi :** L'audit Kimi note l'absence de schema `Product` + `Offer` sur `/upgrade`. Ce schema permet à Google et aux LLMs (Perplexity, ChatGPT) de comprendre le catalogue tarifaire. On suit le pattern `BreadcrumbJsonLd` : un composant React minimal qui émet un `<script type="application/ld+json">` via Helmet, et exporte une fonction pure `buildProductJsonLd()` testable sans render.

- [ ] **Step 1: Créer le fichier de test (failing) — `frontend/src/components/__tests__/ProductJsonLd.test.tsx`**

```tsx
/**
 * 🧪 ProductJsonLd Tests — Schema.org Product + Offers (pricing v2)
 */

import { describe, it, expect } from "vitest";
import { buildProductJsonLd } from "../ProductJsonLd";

describe("buildProductJsonLd", () => {
  it("returns a Schema.org Product object with the right @context and @type", () => {
    const jsonLd = buildProductJsonLd();
    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@type"]).toBe("Product");
    expect(jsonLd.name).toBe("DeepSight");
  });

  it("exposes exactly 3 offers (Free, Pro, Expert)", () => {
    const jsonLd = buildProductJsonLd();
    expect(Array.isArray(jsonLd.offers)).toBe(true);
    expect(jsonLd.offers).toHaveLength(3);
    const names = jsonLd.offers.map((o) => o.name);
    expect(names).toEqual(["Gratuit", "Pro", "Expert"]);
  });

  it("uses pricing v2: Pro = 8.99 EUR/month", () => {
    const jsonLd = buildProductJsonLd();
    const proOffer = jsonLd.offers.find((o) => o.name === "Pro");
    expect(proOffer).toBeDefined();
    expect(proOffer!.price).toBe("8.99");
    expect(proOffer!.priceCurrency).toBe("EUR");
    expect(proOffer!.priceSpecification.unitText).toBe("MONTH");
  });

  it("uses pricing v2: Expert = 19.99 EUR/month", () => {
    const jsonLd = buildProductJsonLd();
    const expertOffer = jsonLd.offers.find((o) => o.name === "Expert");
    expect(expertOffer).toBeDefined();
    expect(expertOffer!.price).toBe("19.99");
    expect(expertOffer!.priceCurrency).toBe("EUR");
    expect(expertOffer!.priceSpecification.unitText).toBe("MONTH");
  });

  it("does NOT contain any v0 legacy price (4.99 or 9.99)", () => {
    const serialized = JSON.stringify(buildProductJsonLd());
    expect(serialized).not.toContain("4.99");
    expect(serialized).not.toContain("9.99");
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec attendu**

Run :

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npx vitest run src/components/__tests__/ProductJsonLd.test.tsx
```

Expected : FAIL — `Cannot find module '../ProductJsonLd'` (ou équivalent). Le fichier n'existe pas encore.

- [ ] **Step 3: Créer le composant et la fonction pure — `frontend/src/components/ProductJsonLd.tsx`**

```tsx
import { Helmet } from "react-helmet-async";

const SITE_URL = "https://www.deepsightsynthesis.com";

/**
 * Schéma TypeScript du JSON-LD Product Schema.org émis par ce composant.
 * Volontairement strict pour que les tests valident la grille tarifaire.
 */
interface ProductOffer {
  "@type": "Offer";
  name: string;
  price: string;
  priceCurrency: "EUR";
  description: string;
  priceSpecification: {
    "@type": "UnitPriceSpecification";
    price: string;
    priceCurrency: "EUR";
    unitText: "MONTH";
  };
}

interface ProductJsonLdShape {
  "@context": "https://schema.org";
  "@type": "Product";
  name: string;
  description: string;
  brand: { "@type": "Brand"; name: string };
  url: string;
  offers: ProductOffer[];
}

/**
 * Construit le JSON-LD Product+Offers correspondant à la grille pricing v2 publique
 * (Gratuit, Pro 8,99 €/mois, Expert 19,99 €/mois).
 *
 * Exporté pour permettre des tests purs (sans render React).
 */
export const buildProductJsonLd = (): ProductJsonLdShape => ({
  "@context": "https://schema.org",
  "@type": "Product",
  name: "DeepSight",
  description:
    "Plateforme SaaS d'analyse de vidéos YouTube et TikTok par IA. Synthèses sourcées, fact-checking nuancé, flashcards FSRS, chat contextuel, voice agent.",
  brand: { "@type": "Brand", name: "DeepSight" },
  url: `${SITE_URL}/upgrade`,
  offers: [
    {
      "@type": "Offer",
      name: "Gratuit",
      price: "0",
      priceCurrency: "EUR",
      description:
        "5 analyses/mois, vidéos jusqu'à 15 min, flashcards, quiz, chat contextuel.",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "0",
        priceCurrency: "EUR",
        unitText: "MONTH",
      },
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "8.99",
      priceCurrency: "EUR",
      description:
        "30 analyses/mois, vidéos jusqu'à 2 h, mind maps, fact-check, web search, exports PDF.",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "8.99",
        priceCurrency: "EUR",
        unitText: "MONTH",
      },
    },
    {
      "@type": "Offer",
      name: "Expert",
      price: "19.99",
      priceCurrency: "EUR",
      description:
        "100 analyses/mois, vidéos jusqu'à 4 h, voice agent ElevenLabs, playlists illimitées, deep research, priority queue.",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "19.99",
        priceCurrency: "EUR",
        unitText: "MONTH",
      },
    },
  ],
});

/**
 * Émet le JSON-LD Product+Offers dans le `<head>` via Helmet.
 *
 * Usage :
 *   <ProductJsonLd />
 *
 * Pattern aligné sur BreadcrumbJsonLd.tsx.
 */
export const ProductJsonLd = () => {
  const jsonLd = buildProductJsonLd();
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
};
```

- [ ] **Step 4: Relancer le test pour vérifier le passage**

Run :

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npx vitest run src/components/__tests__/ProductJsonLd.test.tsx
```

Expected : 5 tests passent en vert (`5 passed`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ProductJsonLd.tsx frontend/src/components/__tests__/ProductJsonLd.test.tsx
git commit -m "feat(seo): add ProductJsonLd component with pricing v2 offers (TDD)"
```

---

### Task 5: Monter `<ProductJsonLd />` dans `UpgradePage.tsx`

**Files:**

- Modify: `frontend/src/pages/UpgradePage.tsx` (import en tête + render ligne ~1145)

**Pourquoi :** Le composant n'a aucun effet tant qu'il n'est pas rendu. Il faut l'ajouter à `/upgrade` à côté de `<BreadcrumbJsonLd path="/upgrade" />`.

- [ ] **Step 1: Repérer la ligne d'import existante de `BreadcrumbJsonLd`**

Run :

```bash
cd C:/Users/33667/DeepSight-Main/frontend
grep -n "BreadcrumbJsonLd" src/pages/UpgradePage.tsx
```

Expected : 2 lignes (un import en haut + un usage ligne 1145). Noter le numéro de la ligne d'import — on s'en sert au step suivant.

- [ ] **Step 2: Ajouter l'import**

À la suite immédiate de la ligne d'import existante de `BreadcrumbJsonLd`, insérer :

```tsx
import { ProductJsonLd } from "../components/ProductJsonLd";
```

⚠️ Si l'import existant utilise un alias `@/components/...`, refléter le même style ; sinon utiliser le chemin relatif `../components/ProductJsonLd` comme ci-dessus pour rester cohérent avec le pattern des imports voisins de cette page.

- [ ] **Step 3: Mounter `<ProductJsonLd />` à côté de `<BreadcrumbJsonLd path="/upgrade" />`**

Edit :

```tsx
      <BreadcrumbJsonLd path="/upgrade" />
      <ProductJsonLd />
```

Remplace (autour de la ligne 1145, après la fin du bloc `<SEO ... />`) :

```tsx
<BreadcrumbJsonLd path="/upgrade" />
```

- [ ] **Step 4: Vérification typecheck + tests existants**

Run :

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run typecheck
```

Expected : pas d'erreur. Si `tsc` reporte une erreur dans `UpgradePage.tsx` liée à un import : refixer le chemin (alias vs relatif).

Run aussi :

```bash
npx vitest run src/components/__tests__/ProductJsonLd.test.tsx
```

Expected : 5 tests passent (sécurité — assure que rien n'a régressé).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/UpgradePage.tsx
git commit -m "feat(seo): mount ProductJsonLd on /upgrade page"
```

---

### Task 6: Vérification finale (build + grep absence prix v0/v1 + post-deploy)

**Files:** Aucun — c'est uniquement de la vérification build + post-deploy.

- [ ] **Step 1: Build production complet**

Run :

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run build
```

Expected : build success, taille bundle similaire à la dernière version. Aucune erreur ni warning bloquant.

- [ ] **Step 2: Vérifier absence des prix v0 dans le HTML buildé**

Run :

```bash
cd C:/Users/33667/DeepSight-Main/frontend
grep -nE "\"4\.99\"|\"9\.99\"" dist/index.html && echo "FAIL: ancien prix v0 détecté" || echo "OK aucun prix v0"
```

Expected : `OK aucun prix v0`. Si on trouve `"4.99"` ou `"9.99"` : retour à Task 1 — un endroit a été oublié.

- [ ] **Step 3: Vérifier présence des prix v2 dans le HTML buildé**

Run :

```bash
cd C:/Users/33667/DeepSight-Main/frontend
grep -E "\"8\.99\"|\"19\.99\"" dist/index.html | head -3
```

Expected : au moins 2 lignes — une mentionnant `"8.99"`, une `"19.99"` (à l'intérieur du JSON-LD WebApplication).

- [ ] **Step 4: Lancer la suite de tests Vitest**

Run :

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test
```

Expected : tous les tests passent (incluant les 5 nouveaux de `ProductJsonLd.test.tsx`). Si une régression apparaît dans un test sans rapport (ex : `CookieBanner.test.tsx`), c'est probablement pré-existant — valider avec `git stash` + relance pour confirmer.

- [ ] **Step 5: Vérifier le contenu de `vercel.json` une dernière fois**

Run :

```bash
cd C:/Users/33667/DeepSight-Main/frontend
node -e "
const cfg = JSON.parse(require('fs').readFileSync('vercel.json','utf8'));
const global = cfg.headers.find(h => h.source === '/(.*)');
if (!global) { console.error('FAIL: pas de headers globaux'); process.exit(1); }
const keys = global.headers.map(h => h.key);
const required = ['Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy'];
const missing = required.filter(k => !keys.includes(k));
if (missing.length) { console.error('FAIL missing:', missing); process.exit(1); }
console.log('OK 5/5 headers sécurité présents');
"
```

Expected : `OK 5/5 headers sécurité présents`.

- [ ] **Step 6: Commit final (recap, si rien de nouveau ne reste à staged, sauter)**

```bash
git status
```

Si pas de fichier modifié, rien à committer ici. Sinon :

```bash
git add -p
git commit -m "chore(verify): post-build SEO + security audit checks"
```

- [ ] **Step 7: Vérification post-déploiement Vercel preview (déclenchement par PR)**

⚠️ **Ne pas exécuter ce step avant d'avoir poussé une PR et que Vercel ait déployé une preview** (ce qui implique d'avoir lu la section **Release coordination** ci-dessous et coordonné avec le plan `pricing-v2-stripe-grandfathering`).

Une fois la preview Vercel disponible (URL du type `https://frontend-v46-cppme-xxx.vercel.app`), depuis n'importe quelle machine :

```bash
PREVIEW_URL="<URL preview Vercel ici>"
curl -sI "$PREVIEW_URL/" | grep -iE "content-security-policy|x-frame-options|x-content-type-options|referrer-policy|permissions-policy"
```

Expected : 5 lignes affichées, une par header. Si un header manque sur la preview : Vercel n'a pas appliqué la nouvelle config — vérifier que le commit Task 2 est bien dans la branche déployée.

Vérifier aussi le JSON-LD :

```bash
curl -s "$PREVIEW_URL/" | grep -oE '"price":"[^"]*"' | sort -u
```

Expected : `"price":"0"`, `"price":"8.99"`, `"price":"19.99"`. **Aucune** occurrence de `"4.99"` ou `"9.99"`.

---

## Self-review

### Couverture du spec — checklist Phase 0 audit Kimi

| Bug Phase 0 audité                                                 | Task qui le corrige |
| ------------------------------------------------------------------ | ------------------- |
| `index.html` JSON-LD utilise prix v0 (4,99 / 9,99)                 | Task 1 (Step 4)     |
| `UpgradePage.tsx:1140-1144` description SEO mentionne anciens prix | Task 3              |
| `index.html` `<title>` statique sans TikTok                        | Task 1 (Step 1)     |
| Aucun header sécurité dans `vercel.json`                           | Task 2              |
| Pas de `Product`/`Offer` schema dédié sur `/upgrade`               | Task 4 + Task 5     |
| Faux positif Kimi « canonisation vers homepage »                   | Documenté en intro  |

Aucun gap.

### Cohérence types/noms

- `buildProductJsonLd()` est utilisé tel quel dans `ProductJsonLd.tsx` (Task 4) et dans le test (Task 4 step 1). Aucun renommage.
- Le composant `<ProductJsonLd>` (Task 4) est importé en `import { ProductJsonLd } from "../components/ProductJsonLd"` puis monté `<ProductJsonLd />` dans Task 5 — cohérent.
- Les prix `8.99` et `19.99` sont identiques dans `index.html` (Task 1), `UpgradePage.tsx` description (Task 3), `ProductJsonLd.tsx` (Task 4) et tests (Task 4) — pas de drift numérique.
- `unitText: "MONTH"` partout (Task 1 + Task 4) — pas de retour au "monthly" non standard de la grille v0.

### Scan placeholders

Recherché : "TBD", "TODO", "implement later", "fill in details", "Add appropriate", "Similar to Task". Aucun trouvé. Tous les steps qui modifient du code montrent le code complet.

### Décisions à confirmer avec l'utilisateur AVANT exécution

- **D1 — `aggregateRating` factice ?** Schema.org `Product` accepte un champ `aggregateRating` qui boost l'apparition dans les résultats Google avec étoiles. Mais on n'a pas encore de système d'avis utilisateur. Trois options :
  - (a) **Ne pas en mettre** (recommandé — pas de mensonge, pas de risque de pénalité Google "fake reviews")
  - (b) Mettre une note basée sur les vrais avis Chrome Web Store (à scraper manuellement la première fois)
  - (c) Préparer le terrain en stockant un endpoint `/api/ratings` côté backend et un widget côté front

- **D2 — `'unsafe-inline'` + `'unsafe-eval'` dans `script-src` ?** Vite 5 prod build inline le CSS critical et certains scripts. PostHog/Stripe/Sentry SDKs injectent aussi du JS inline. Sans ces flags, la CSP cassera l'app en prod. Trois options :
  - (a) **Garder** `'unsafe-inline' 'unsafe-eval'` (recommandé MVP — la CSP reste utile sur les autres directives)
  - (b) Migrer vers `nonce` ou `hash` — nécessite hooks Vite + middleware Vercel Edge — gros chantier, à planifier en plan séparé
  - (c) Tester en `Content-Security-Policy-Report-Only` pendant 7 jours avant de bloquer

- **D3 — Domaines Crisp réellement utilisés ?** La whitelist Crisp inclut `client.crisp.chat`, `wss.relay.crisp.chat`, `wss://client.relay.crisp.chat`, `storage.crisp.chat`, `settings.crisp.chat`, `game.crisp.chat`. Vérifier rapidement si Crisp est encore actif sur le site (sinon : retirer toutes ces entrées pour réduire la surface). Confirmer avec l'utilisateur.

- **D4 — Branche cible.** Le contexte de mission demande `feature/audit-kimi-plans-2026-04-29`. La branche actuelle au moment de la rédaction est `feat/merge-voice-chat-context`. Confirmer avec l'utilisateur :
  - (a) Créer la nouvelle branche depuis `main` avant Task 1 (recommandé)
  - (b) Travailler sur la branche actuelle puis cherry-pick (déconseillé — risque de mélange)
  - (c) Repartir d'un autre point

- **D5 — Coordination release-train.** Voir section dédiée ci-dessous. Confirmer avec l'utilisateur la stratégie : feature flag, branche `release/pricing-v2`, ou release simultanée ?

---

## Release coordination — couplage atomique avec `pricing-v2-stripe-grandfathering`

⚠️ **Ce plan ne doit PAS être déployé seul en production.**

### Risque concret

Si on merge ce plan SEO sans le plan `pricing-v2-stripe-grandfathering` :

- Le HTML public (et JSON-LD ingéré par Google + Perplexity + ChatGPT) annoncera **8,99 €** et **19,99 €**.
- Stripe continuera à facturer **5,99 €** (Pro v1) et **14,99 €** (Expert v1).
- L'utilisateur arrive sur `/upgrade`, lit "Pro 8,99 €" dans la fiche Schema.org indexée, clique sur "Upgrade Pro", et passe au checkout Stripe à **5,99 €** → **incohérence prix affiché vs facturé** → pertes de confiance + obligation légale (article L. 121-1 Code conso FR : prix affiché ≠ prix facturé = pratique commerciale trompeuse).

### Stratégie recommandée — release-train `release/pricing-v2`

**Option recommandée :** merger les deux plans dans une **branche d'intégration** `release/pricing-v2` qui ne sera mergée à `main` qu'après validation manuelle des deux halves.

Workflow :

1. Créer `release/pricing-v2` depuis `main`.
2. PR #N — ce plan SEO (`feature/audit-kimi-plans-2026-04-29`) → cible `release/pricing-v2`. Review + merge.
3. PR #N+1 — plan jumeau `pricing-v2-stripe-grandfathering` → cible `release/pricing-v2`. Review + merge. Cette PR contient :
   - Création des Stripe Price IDs `price_pro_v2_899eur_month`, `price_expert_v2_1999eur_month` (annual idem)
   - Migration Alembic 011 ajoutant `User.is_legacy_pricing BOOLEAN DEFAULT FALSE` et marquant tous les abonnés actuels v1 à `TRUE` (grandfathering)
   - Backend `BillingService` : si `is_legacy_pricing=True` → retourner Price IDs v1, sinon v2
   - Frontend `planPrivileges.ts` : afficher les bons prix selon le drapeau renvoyé par `/api/auth/me`
4. Smoke test sur preview Vercel + sandbox Stripe.
5. Merge `release/pricing-v2` → `main` lors d'une fenêtre de déploiement coordonnée (ex : un dimanche soir).
6. Surveillance Sentry + Stripe webhooks pendant 24 h.

### Stratégie alternative — feature flag CSP-friendly

Si la coordination n'est pas possible : exposer la grille v2 derrière un flag PostHog `ff:pricing_v2_public_seo`. Tant que `false`, le code de ce plan ne charge pas le `<ProductJsonLd>` et `index.html` reste en grille v0. Une fois le backend prêt, on flippe le flag → le HTML statique ne change pas (il faut un redeploy Vercel pour ça), donc le flag ne couvre que les composants React. **Pas idéal** — les bots IA cachent index.html.

### Décision à prendre par l'utilisateur (D5)

- (a) **Release-train `release/pricing-v2`** (recommandé)
- (b) Feature flag PostHog (deuxième choix, partiel)
- (c) Déployer ce plan seul, immédiatement, et déployer le plan jumeau sous 24 h max (risqué — fenêtre d'incohérence)

---

## Execution Handoff

**Plan complet et sauvegardé dans `docs/superpowers/plans/2026-04-29-audit-kimi-phase-0-seo-securite.md`. Deux options d'exécution :**

**1. Subagent-Driven (recommandé)** — Je dispatche un sous-agent frais par task, je review entre les tasks, itération rapide. Particulièrement adapté ici : 6 tasks indépendantes, faible couplage, audit trail clair.

**2. Inline Execution** — On exécute les tasks dans cette session avec des checkpoints de review.

⚠️ **Avant d'exécuter** : confirmer les 5 décisions D1-D5 (notamment **D4 branche cible** et **D5 release coordination**), sinon on risque le pire scénario : SEO annonçant 8,99 € en prod pendant que Stripe facture encore 5,99 €.

**Quelle approche ?**
