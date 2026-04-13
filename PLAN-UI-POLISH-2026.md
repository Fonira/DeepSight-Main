# DeepSight — Plan UI Polish Anti-AI-Slop

_Mars 2026 — Document de spécifications tri-plateforme_
_À utiliser avec Claude Code CLI + Superpowers + Callstack RN + Vercel React skills_

---

## 1. BRAND VOICE — Identité DeepSight

### Personnalité

**Le prof passionné** — Pédagogue, structuré, donne envie d'apprendre, autorité bienveillante. Jamais condescendant, toujours enthousiaste.

### Attributs de voix (5)

**Pédagogue**

- On est : clair, structuré, on guide sans imposer
- On n'est pas : scolaire, ennuyeux, paternaliste
- Ça sonne comme : « Voici ce que cette vidéo révèle vraiment »
- Ça ne sonne PAS comme : « Veuillez noter les points suivants »

**Précis**

- On est : sourcé, nuancé, factuel (marqueurs épistémiques SOLIDE/PLAUSIBLE/INCERTAIN)
- On n'est pas : froid, robotique, académique
- Ça sonne comme : « 3 points clés, dont 1 à vérifier »
- Ça ne sonne PAS comme : « L'analyse a identifié N éléments pertinents »

**Chaleureux**

- On est : encourageant, humain, accessible
- On n'est pas : familier, puéril, forcé
- Ça sonne comme : « Belle trouvaille, cette vidéo est dense ! »
- Ça ne sonne PAS comme : « Wow super choix !! 🎉🎉 »

**Curieux**

- On est : passionné par le savoir, on creuse, on connecte
- On n'est pas : dispersé, hors-sujet, bavard
- Ça sonne comme : « Ce point rejoint un concept intéressant... »
- Ça ne sonne PAS comme : « Fun fact : saviez-vous que... »

**Français & Européen**

- On est : fier de notre stack Mistral, on assume notre identité
- On n'est pas : chauvin, anti-anglophone, fermé
- Ça sonne comme : « Propulsé par Mistral AI 🇫🇷🇪🇺 — vos données restent en Europe »
- Ça ne sonne PAS comme : « Cocorico ! On est français ! »

### Ton UI — Micro-copies

| Contexte          | Ton                     | Exemple FR                                                        | Exemple EN                                      |
| ----------------- | ----------------------- | ----------------------------------------------------------------- | ----------------------------------------------- |
| CTA principal     | Direct + verbe d'action | « Analyser cette vidéo »                                          | "Analyze this video"                            |
| CTA secondaire    | Invitation douce        | « Découvrir les flashcards »                                      | "Explore flashcards"                            |
| État vide         | Chaleureux + guide      | « Aucune analyse pour l'instant — collez un lien pour commencer » | "No analyses yet — paste a link to get started" |
| Chargement        | Vivant                  | « Décryptage en cours... »                                        | "Decoding in progress..."                       |
| Erreur réseau     | Empathique + solution   | « Connexion perdue — on réessaie dans un instant »                | "Connection lost — retrying shortly"            |
| Erreur serveur    | Honnête + rassurant     | « Quelque chose a planté de notre côté. On s'en occupe. »         | "Something broke on our end. We're on it."      |
| Succès            | Sobre + satisfaisant    | « Analyse prête ✓ »                                               | "Analysis ready ✓"                              |
| Upgrade CTA       | Valeur, pas pression    | « Débloquer les exports PDF »                                     | "Unlock PDF exports"                            |
| Placeholder input | Action claire           | « Collez un lien YouTube... »                                     | "Paste a YouTube link..."                       |
| Tooltip           | Compact + utile         | « Fiabilité de cette affirmation »                                | "Reliability of this claim"                     |

### Langue & i18n

- **FR natif** comme langue par défaut
- **EN complet** accessible via paramètres (switch de locale)
- **Anglicismes acceptés** : Dashboard, Flashcards, Chat, Playlist, Export, Streaming
- **Architecture** : fichiers de traduction séparés (`locales/fr.json`, `locales/en.json`)
- **Convention** : clés sémantiques (`analysis.loading`, `error.network`, `cta.analyze`)

---

## 2. AUDIT CONCURRENTIEL — Ce qui fait "AI Slop"

### Traits AI Slop à éliminer de DeepSight

| Trait AI Slop                                   | Présent chez DeepSight ?               | Action                                     |
| ----------------------------------------------- | -------------------------------------- | ------------------------------------------ |
| Gradients gratuits (hero bg qui ne sert à rien) | ⚠️ Partiellement (ambient glow subtil) | Réduire opacité mobile, garder web         |
| Cards identiques en grille sans hiérarchie      | ⚠️ Historique = grille plate           | Varier tailles, ajouter mise en avant      |
| Textes génériques "Powered by AI"               | ❌ Non                                 | —                                          |
| Animations de chargement standard (spinner)     | ⚠️ Rotating border classique           | Remplacer par skeleton + shimmer DeepSight |
| Empty states avec juste une icône + texte       | ⚠️ Basique                             | Ajouter doodle illustratif + CTA guidé     |
| Spacing monotone (tout à 16px)                  | ❌ Bon système 4px                     | —                                          |
| Boutons tous identiques                         | ⚠️ Peu de variation                    | Différencier CTA primaire vs secondaire    |
| Dark mode "juste noir"                          | ❌ Bon — #0a0a0f avec depth            | —                                          |

### Ce que Linear fait bien (à s'inspirer)

1. **Physique, pas décoratif** — Les éléments réagissent au toucher (lift, press, drag). Pas juste des couleurs jolies.
2. **Hiérarchie typographique forte** — Les titres portent le design, pas les effets.
3. **Densité d'information** — Beaucoup d'info dans peu d'espace, mais lisible.
4. **Micro-interactions tactiles** — Scale 0.98 au press, spring physics.
5. **Navigation bottom bar intelligente** — Accès rapide, pas de hamburger.
6. **Frosted glass ciblé** — Utilisé stratégiquement (nav, modals), pas partout.

### Ce que Raycast fait bien

1. **Compact mode** — Moins = plus focus.
2. **Réactivité instantanée** — Tout semble à 0ms.
3. **Thème adaptatif** — Couleurs qui s'adaptent sans effort.

---

## 3. ÉVOLUTION DOODLES — Mixed Media

### Direction artistique

Garder les 53 SVG paths existants mais les faire évoluer vers un style **mixed media** :

- **Éléments hand-drawn** : Traits légèrement irréguliers, comme dessinés au stylo fin (0.5mm)
- **Éléments géométriques** : Formes précises (cercles, lignes) qui contrastent avec le hand-drawn
- **Interaction** : Les deux styles coexistent — le hand-drawn pour l'organique, le géométrique pour la structure

### Modifications SVG concrètes

**Avant (actuel)** : Traits uniformes, strokeWidth fixe, paths lisses

```svg
<path d="M12 2L2 7l10 5 10-5-10-5z" strokeWidth="1.5" strokeLinecap="round"/>
```

**Après (mixed media)** : Traits variables, léger tremblement, strokeWidth dynamique

```svg
<!-- Hand-drawn feel : ajout de légères imperfections aux paths -->
<path d="M12.2 2.1L2.1 7.05l9.9 4.95 10.1-5.05-10.1-4.95z"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.85"/>
<!-- Geometric accent : cercle parfait en contraste -->
<circle cx="12" cy="7" r="2" strokeWidth="0.8" strokeDasharray="2 2"/>
```

### Règles d'évolution

1. **Ne PAS refaire tous les 53 paths** — Modifier progressivement, par catégorie
2. **Priorité** : ICONS_VIDEO et ICONS_STUDY (les plus vus)
3. **Ajouter** des éléments géométriques (dots grids, lignes de connexion) entre les doodles
4. **Réduire** la densité de 300+ éléments à ~200 par tile (plus respirant)
5. **Varier** les strokeWidth : 0.8px (fin) à 2px (accent) au lieu de 1.5px uniforme

### Nouvelles couleurs doodles (dark mode)

Garder la palette existante mais ajouter 2 couleurs "accent mixed media" :

- `#E2E8F0` — Gris clair froid (éléments géométriques)
- `#FDE68A` — Jaune doux (highlight hand-drawn)

---

## 4. PLAN DE MODIFICATIONS — Mobile (Priorité #1)

### 4.1 Navigation & Structure

**Problème** : Navigation potentiellement trop standard/générique.
**Solution Linear-inspired** :

| Modification                        | Fichier(s)                | Détail                                                      |
| ----------------------------------- | ------------------------- | ----------------------------------------------------------- |
| Bottom tab bar avec haptic feedback | `navigation/MainTabs.tsx` | Ajouter `expo-haptics` on tab press, scale animation spring |
| Tab icons animés (Reanimated 3)     | `navigation/MainTabs.tsx` | Icon scale 1→1.15 + color morph on active                   |
| Swipe-to-navigate entre tabs        | `navigation/MainTabs.tsx` | Gesture handler pour swipe horizontal                       |
| Header compact mode                 | `components/Header.tsx`   | Réduire height au scroll (Animated.ScrollView onScroll)     |

### 4.2 Cards & Listes (Historique)

**Problème** : Grille plate d'analyses identiques = AI slop.
**Solution** :

| Modification                                   | Fichier(s)                    | Détail                                                                  |
| ---------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------- |
| Card hierarchy — dernier résultat = large card | `screens/HistoryScreen.tsx`   | Première card 100% width avec thumbnail, reste en grille 2 colonnes     |
| Press effect physique                          | `components/AnalysisCard.tsx` | Reanimated: scale(0.97) + translateY(2) on press, spring release        |
| Skeleton loading DeepSight-branded             | `components/SkeletonCard.tsx` | Créer : shimmer avec gradient brand (indigo→violet), pas gris générique |
| Swipe-to-delete avec spring                    | `components/AnalysisCard.tsx` | PanGestureHandler + Reanimated spring pour supprimer                    |
| Badge marqueur épistémique sur card            | `components/AnalysisCard.tsx` | Petit badge coloré (SOLIDE=vert, INCERTAIN=orange) visible directement  |

### 4.3 Analyse Screen (4 tabs — le plus complexe)

**Problème** : Beaucoup de contenu, risque de wall-of-text.
**Solution** :

| Modification                          | Fichier(s)                          | Détail                                                                       |
| ------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| Tab indicator animé (underline slide) | `screens/AnalysisScreen.tsx`        | Reanimated SharedTransition sur le tab indicator                             |
| Sections collapsibles avec animation  | `components/CollapsibleSection.tsx` | Height animation smooth (pas de LayoutAnimation)                             |
| Pull-to-refresh avec doodle animation | `screens/AnalysisScreen.tsx`        | Custom RefreshControl avec un doodle qui s'anime                             |
| Typographie renforcée                 | Global theme                        | H1: 24px bold 800, H2: 19px semibold, body: 15px regular — plus de contraste |
| Blockquotes stylées (citations vidéo) | `components/VideoQuote.tsx`         | Border-left indigo 3px + bg surface subtil + icône guillemets                |

### 4.4 Chat Screen

| Modification                               | Fichier(s)                       | Détail                                                               |
| ------------------------------------------ | -------------------------------- | -------------------------------------------------------------------- |
| Bulles messages avec tail (comme iMessage) | `components/ChatBubble.tsx`      | SVG tail sur les bulles, pas juste des rectangles arrondis           |
| Typing indicator doodle-style              | `components/TypingIndicator.tsx` | 3 dots qui rebondissent avec spring physics, pas juste opacity pulse |
| Input bar glass effect                     | `screens/ChatScreen.tsx`         | BlurView (expo-blur) sur l'input bar                                 |

### 4.5 Flashcards

| Modification               | Fichier(s)                         | Détail                                                        |
| -------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| Flip 3D plus réaliste      | `components/FlashcardStack.tsx`    | Ajouter shadow qui change pendant le flip (perspective depth) |
| Confetti subtil on correct | `components/FlashcardStack.tsx`    | Micro-confetti (5-8 particules) pas explosif                  |
| Progress ring animé        | `components/FlashcardProgress.tsx` | SVG circle animé avec Reanimated, pas une barre plate         |

### 4.6 Empty States (doodle-powered)

| Screen             | Doodle                         | Texte                                                             |
| ------------------ | ------------------------------ | ----------------------------------------------------------------- |
| Historique vide    | Doodle vidéo (play + loupe)    | « Aucune analyse pour l'instant — collez un lien pour commencer » |
| Chat sans contexte | Doodle chat (bulle + cerveau)  | « Analysez d'abord une vidéo pour discuter avec l'IA »            |
| Flashcards vides   | Doodle study (cartes + étoile) | « Vos flashcards apparaîtront ici après une analyse »             |
| Erreur réseau      | Doodle tech (wifi barré)       | « Connexion perdue — on réessaie dans un instant »                |

---

## 5. PLAN DE MODIFICATIONS — Web (Polish)

### 5.1 Landing Page

| Modification                              | Fichier(s)                     | Détail                                                                         |
| ----------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------ |
| Hero : typographie plus forte             | `pages/LandingPage.tsx`        | Title en 800 weight, letter-spacing -0.02em, plus imposant                     |
| Hero : CTA avec micro-animation           | `components/AnalyzeButton.tsx` | Ajouter un subtle bounce idle (float keyframe, 3s)                             |
| Scroll reveals plus smooth                | `pages/LandingPage.tsx`        | Intersection Observer + Framer Motion stagger 80ms (au lieu de tout d'un coup) |
| Pricing cards : highlight plan recommandé | `components/PricingCard.tsx`   | Border glow + badge "Populaire" + scale(1.02) sur le plan Étudiant             |

### 5.2 Dashboard

| Modification                                 | Fichier(s)                | Détail                                                          |
| -------------------------------------------- | ------------------------- | --------------------------------------------------------------- |
| Sidebar : item actif avec glow subtil        | `components/Sidebar.tsx`  | Background accent-primary-muted + left border 2px accent        |
| Cards historique : hover effect plus tactile | `components/Card.tsx`     | Mouse-tracking gradient déjà présent — ajouter translateY(-2px) |
| Loading states : skeleton branded            | `components/Skeleton.tsx` | Shimmer indigo→violet au lieu de gris→gris                      |

### 5.3 Doodle Background Web

| Modification                  | Fichier(s)                        | Détail                                    |
| ----------------------------- | --------------------------------- | ----------------------------------------- |
| Réduire densité               | `components/DoodleBackground.tsx` | Passer de 300+ à ~200 éléments par tile   |
| Ajouter éléments géométriques | `components/DoodleBackground.tsx` | Dot grids, connection lines entre doodles |
| Varier strokeWidth            | `components/DoodleBackground.tsx` | Range 0.8-2.0 au lieu de 1.5 fixe         |

---

## 6. PLAN DE MODIFICATIONS — Extension Chrome

| Modification                     | Fichier(s)                       | Détail                               |
| -------------------------------- | -------------------------------- | ------------------------------------ |
| Popup : header plus compact      | `popup/components/MainView.tsx`  | Réduire padding top, logo plus petit |
| Badge plan : style pill cohérent | `popup/components/PlanBadge.tsx` | Même style que mobile/web            |
| Transition entre vues            | `popup/components/*.tsx`         | Framer Motion fade+slide 150ms       |

---

## 7. WORKFLOW D'EXÉCUTION (Claude Code CLI)

### Comment utiliser ce plan avec les skills installées

```
Phase 1 — Mobile (Callstack + Superpowers)
├── /brainstorming → Valider l'approche pour chaque section (4.1 à 4.6)
├── /execute-plan → Implémenter section par section
├── /code-review → Review après chaque section
└── Commit atomique après chaque section validée

Phase 2 — Web (Vercel React + Superpowers)
├── /brainstorming → Prioriser les modifs web (5.1 à 5.3)
├── /execute-plan → Implémenter
└── /code-review → Valider

Phase 3 — Extension (Superpowers)
├── Modifs légères (section 6)
└── Build + test dans Chrome

Phase 4 — i18n
├── Extraire toutes les micro-copies dans locales/fr.json
├── Traduire en locales/en.json
└── Intégrer react-i18next (web) + expo-localization (mobile)
```

### Commandes de démarrage

```powershell
# Sur MSI-PC — Mobile d'abord
cd C:\Users\33667\DeepSight-Main\mobile ; claude

# Dans Claude Code :
/using-superpowers
# Puis coller la section 4.x du plan à exécuter
```

### Dépendances à installer (si manquantes)

```bash
# Mobile
cd mobile
npx expo install expo-haptics expo-blur
npm install react-native-reanimated react-native-gesture-handler

# Web (normalement déjà présent)
cd frontend
npm install framer-motion  # si pas déjà installé
```

---

## 8. CHECKLIST DE VALIDATION

### Par modification, vérifier :

- [ ] TypeScript strict — pas de `any`
- [ ] Compatible iOS + Android (tester les deux)
- [ ] Accessible (aria-labels, minimum touch target 44x44)
- [ ] Performance — pas de re-render inutile (useMemo, useCallback)
- [ ] Cohérent web ↔ mobile (mêmes couleurs, même ton)
- [ ] Dark mode ET light mode
- [ ] Animations respectent prefers-reduced-motion
- [ ] Micro-copies en FR avec clés i18n prêtes

### Critères "pas AI slop" :

- [ ] Chaque élément a une raison d'exister (pas décoratif gratuit)
- [ ] Les animations ont un but (feedback, guidage, plaisir)
- [ ] La typographie porte le design (pas les effets)
- [ ] Les empty states racontent une histoire
- [ ] Le toucher est physique (spring, scale, haptics)
- [ ] Le contenu prime sur le chrome

---

_Ce document est le contrat de specs UI. Chaque section = 1 tâche Notion. Exécuter avec Superpowers : /brainstorming → /execute-plan → /code-review._
