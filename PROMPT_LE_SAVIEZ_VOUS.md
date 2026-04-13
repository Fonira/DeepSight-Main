# PROMPT CLAUDE CODE — Implémentation visuelle "Le Saviez-Vous" avec images IA

## Contexte

Le pipeline backend est prêt : Mistral (art director) → OpenAI (DALL-E 2 free / DALL-E 3 premium) → post-process WebP → upload R2 → table `keyword_images` PostgreSQL. Les images sont des photos éditoriales still-life sur fond noir avec lumière dorée latérale, style DeepSight.

Le type `LoadingWord` dans `frontend/src/contexts/LoadingWordContext.tsx` a DÉJÀ le champ `imageUrl?: string` (ligne 33). Le type `HistoryKeyword` a DÉJÀ `image_url: string | null` (ligne 50). La conversion dans `convertHistoryKeyword()` mappe déjà `imageUrl: keyword.image_url || undefined` (ligne 148).

L'endpoint backend existe : `GET /api/images/keyword/{term}` → retourne `{ term, image_url, status }`.

Les images font 360x360 WebP (free) ou 512x512 WebP (premium).

## Ta mission

Intégrer les images IA générées dans l'affichage frontend du widget "Le Saviez-Vous" de manière astucieuse, originale et cohérente avec le design system DeepSight (dark mode, glassmorphism, accents indigo/violet/gold).

### Composants à modifier

1. **`frontend/src/components/DidYouKnowCard.tsx`** — Widget compact en haut à droite du dashboard (desktop). Actuellement n'affiche que le spinner cosmique + terme + définition texte. Il faut y intégrer l'image IA quand `displayedWord.imageUrl` est disponible.

2. **`frontend/src/components/WhackAMole/FactRevealCard.tsx`** — Card qui s'affiche après avoir attrapé une taupe dans le mini-jeu. Même structure, pas d'image actuellement.

3. **`frontend/src/components/ConceptsGlossary.tsx`** — Section "Concepts Clés" dans le détail d'analyse. Liste de termes avec catégorie + définition. Pas d'image actuellement.

### Directives visuelles OBLIGATOIRES

- **Design system** : fond `#0a0a0f`, surfaces `#12121a`, borders `white/5%`, accents indigo `#6366f1`, violet `#8b5cf6`, or `#C8903A`
- **Glassmorphism** : `backdrop-blur-xl bg-white/5 border border-white/10`
- **Animations** : Framer Motion, transitions `200ms cubic-bezier(0.4,0,0.2,1)`
- **Radius** : 6px (sm), 10px (md), 16px (lg)
- Les images ont un fond noir (#0a0a0f) avec lumière dorée — elles s'intègrent parfaitement dans le dark mode

### Idées créatives à explorer (choisis les meilleures, combine-les)

**Pour DidYouKnowCard :**

- L'image IA remplace le spinner cosmique quand elle existe, avec un fade-in reveal élégant
- OU l'image est en fond de la card avec un gradient overlay noir→transparent, le texte par-dessus
- OU un mini aperçu circulaire (avatar-style) à gauche du terme, avec un halo doré subtil
- Transition fluide entre concepts : l'image se dissolve/morphe quand on passe au concept suivant
- Si pas d'imageUrl → fallback au spinner cosmique actuel (graceful degradation)

**Pour FactRevealCard (WhackAMole) :**

- L'image se "révèle" avec un effet cinématique (zoom-in + brightness increase depuis le noir)
- OU effet polaroid : l'image apparaît comme une photo qui se développe
- Intégrer l'image en haut de la card, le texte en dessous

**Pour ConceptsGlossary :**

- Thumbnail circulaire ou carré arrondi à gauche de chaque concept (si image dispo)
- Hover : l'image s'agrandit dans un tooltip/popover avec un effet de "loupe"
- Badge visuel discret qui indique si l'image a été générée par IA

### Contraintes techniques

- Lazy loading des images (`loading="lazy"`) — elles viennent de R2 CDN
- Placeholder/skeleton pendant le chargement (shimmer effect sur fond sombre)
- `onError` fallback si l'image ne charge pas → cacher et fallback au comportement sans image
- Ne PAS casser le comportement existant : si `imageUrl` est undefined/null, tout doit fonctionner comme avant
- TypeScript strict, zéro `any`
- Tailwind CSS uniquement, pas de CSS custom sauf keyframes animation si nécessaire
- Framer Motion pour les animations (déjà importé dans les composants)

### Ce que tu ne dois PAS faire

- Ne PAS modifier le backend, l'API, le contexte LoadingWordContext ou les types — tout est déjà prêt
- Ne PAS modifier d'autres fichiers que les 3 composants listés
- Ne PAS ajouter de dépendances npm
- Ne PAS toucher au router, au store, ou aux services/api.ts

### Livrables

Modifie les 3 fichiers. Code complet, production-ready, pas d'extraits partiels. Chaque fichier doit être complet de la première à la dernière ligne. Teste que TypeScript compile (`cd frontend ; npx tsc --noEmit`).
