# Audit UI Extension DeepSight — Robustesse & Compatibilité

_Avril 2026 — Pré-soumission Chrome Web Store_

---

## Résumé exécutif

L'extension DeepSight injecte une carte dans la sidebar YouTube (`#secondary-inner`) sans aucune isolation DOM. Les styles sont injectés globalement via un `content.css` avec des `!important` partout. Il n'y a **pas de Shadow DOM**, ce qui expose l'extension à tous les conflits CSS avec YouTube ET les autres extensions.

**Risque global : ÉLEVÉ** — L'extension fonctionnera bien chez un utilisateur "vanilla" mais cassera dans de nombreuses configurations réelles (ad blockers, Dark Reader, Enhancer for YouTube, Tournesol, etc.).

---

## 🔴 RISQUES CRITIQUES (P0)

### 1. Pas de Shadow DOM — Pollution CSS bidirectionnelle

**Problème** : Tous les styles DeepSight (`.ds-*`, variables CSS `:root`) sont injectés dans le document global YouTube. YouTube peut écraser nos styles, et nos styles peuvent casser YouTube.

**Impact** :

- YouTube utilise des custom properties sur `:root` → nos variables `--bg-primary`, `--text-primary` etc. dans `design-tokens.css` **polluent le namespace global**
- Des extensions comme Dark Reader réécrivent TOUS les styles de la page → nos `!important` seront en guerre avec les leurs
- `all: initial` sur `#deepsight-card.ds-widget` (widget.css L16) est la bonne idée mais insuffisant sans Shadow DOM — les styles enfants ne sont pas protégés

**Solution** : **Migrer vers Shadow DOM**

```typescript
function createCard(): HTMLDivElement {
  const host = document.createElement("div");
  host.id = "deepsight-host";
  const shadow = host.attachShadow({ mode: "closed" });

  // Injecter les styles dans le shadow root
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = chrome.runtime.getURL("content.css");
  shadow.appendChild(style);

  const el = document.createElement("div");
  el.id = "deepsight-card";
  el.className = `deepsight-card ${isDarkTheme() ? "dark" : "light"}`;
  el.innerHTML = `...`;
  shadow.appendChild(el);

  return host as any; // Le host est retourné pour insertion
}
```

**Effort** : ~2-3h — Principalement déplacer l'injection CSS et adapter les `document.getElementById` en `shadow.getElementById`.

---

### 2. Variables CSS `:root` en conflit global

**Problème** : `design-tokens.css` déclare 50+ variables sur `:root` :

```css
:root {
  --bg-primary: #0a0a0f;
  --text-primary: #f5f0e8;
  --accent-primary: #c8903a;
  /* ... 50+ variables */
}
```

Ces noms sont trop génériques. N'importe quelle autre extension (ou YouTube lui-même) peut utiliser `--bg-primary` ou `--text-primary`.

**Solution** : Préfixer TOUTES les variables avec `--ds-` (certaines le sont déjà dans widget.css, mais pas dans design-tokens.css). Avec Shadow DOM, ce problème disparaît car les variables sont scopées.

---

### 3. Sélecteurs d'injection fragiles — YouTube change son DOM

**Problème** : L'injection repose sur :

```typescript
const SIDEBAR_SELECTORS = [
  "#secondary-inner",
  "#secondary",
  "ytd-watch-next-secondary-results-renderer",
];
```

YouTube modifie régulièrement son DOM (redesigns, A/B tests). Si `#secondary-inner` est renommé ou déplacé → l'extension ne s'injecte plus.

**Impact** : Déjà observé historiquement — YouTube a changé la structure de la sidebar plusieurs fois.

**Solution** : Système d'injection multi-stratégie avec fallback :

```typescript
const SIDEBAR_STRATEGIES = [
  // Stratégie 1 : Sidebar standard
  { selector: "#secondary-inner", position: "prepend" },
  { selector: "#secondary", position: "prepend" },
  {
    selector: "ytd-watch-next-secondary-results-renderer",
    position: "prepend",
  },
  // Stratégie 2 : Sous le player
  { selector: "#below", position: "prepend" },
  { selector: "ytd-watch-metadata", position: "afterend" },
  // Stratégie 3 : Floating fallback (comme TikTok)
  { selector: "body", position: "floating" },
];
```

- **MutationObserver de récupération** : si la carte est détachée du DOM (YouTube rerender), la ré-injecter automatiquement.

---

## 🟡 RISQUES MOYENS (P1)

### 4. Compatibilité Tournesol — Même zone d'injection

**Problème** : L'extension Tournesol injecte ses éléments (score, bouton de vote) **directement sous la vidéo YouTube** dans `#below` et dans la barre d'actions. Elle crée un élément `#tournesol-container` ou un élément custom.

DeepSight injecte dans `#secondary-inner` (sidebar droite) → **pas de conflit d'emplacement direct**. Mais :

- Si YouTube passe en mode "théâtre" ou petit écran → la sidebar passe sous la vidéo → les deux extensions se retrouvent empilées
- Si un utilisateur a les deux, l'ordre d'empilement dans la sidebar n'est pas garanti

**Solution** :

1. **Détecter Tournesol** : `document.querySelector('[class*="tournesol"], #tournesol-container')`
2. **Respecter l'espace** : ajouter un `margin-top` si Tournesol est présent au-dessus
3. **Mode responsive** : quand la sidebar est repliée (< 1015px), passer en mode compact ou minimisé
4. **Documentation** : mentionner la compatibilité Tournesol dans la description Chrome Web Store

---

### 5. Ad blockers cassent le layout YouTube

**Problème** : uBlock Origin, AdBlock Plus et consorts suppriment des éléments du DOM YouTube, parfois y compris `#secondary` ou des éléments parents de la sidebar. Si `#secondary` est `display: none` ou supprimé → DeepSight ne peut pas s'injecter.

**Solution** :

- Ajouter un check `offsetHeight > 0` avant injection pour détecter les éléments cachés
- Si sidebar invisible/supprimée → activer le mode **floating** (comme pour TikTok)
- Observer les mutations DOM pour détecter la suppression tardive

```typescript
function isSidebarVisible(el: HTMLElement): boolean {
  return (
    el.offsetHeight > 0 &&
    el.offsetWidth > 0 &&
    getComputedStyle(el).display !== "none" &&
    getComputedStyle(el).visibility !== "hidden"
  );
}
```

---

### 6. Pas de responsive / mode théâtre / mode plein écran

**Problème** : La carte a un `max-width: 420px` et `width: 100%` mais aucune adaptation pour :

- **Mode théâtre YouTube** : la sidebar disparaît → la carte disparaît aussi
- **Fenêtre petite** (< 1015px) : YouTube empile la sidebar sous la vidéo → la carte peut se retrouver très loin en bas
- **Mode plein écran** : la carte est invisible

**Solution** :

```typescript
// Détecter mode théâtre
const isTheater = !!document.querySelector("ytd-watch-flexy[theater]");
const isFullscreen = !!document.fullscreenElement;

if (isTheater || isFullscreen) {
  // Passer en floating mini-card ou masquer avec icône de rappel
}

// Écouter les changements
const watchFlexy = document.querySelector("ytd-watch-flexy");
if (watchFlexy) {
  new MutationObserver(() => {
    const theater = watchFlexy.hasAttribute("theater");
    // Adapter l'affichage
  }).observe(watchFlexy, {
    attributes: true,
    attributeFilter: ["theater", "fullscreen"],
  });
}
```

---

### 7. Pas de bouton minimiser/masquer

**Problème** : La carte est toujours visible, pas moyen de la replier. Pour un utilisateur qui veut juste regarder sa vidéo, c'est intrusif. Le Chrome Web Store pénalise les extensions qui "encombrent" la page.

**Solution** :

- Ajouter un bouton ✕ dans le header → réduit la carte en icône flottante (logo DeepSight)
- Persister l'état dans `chrome.storage.local`
- L'icône flottante au clic réouvre la carte

---

### 8. `!important` partout — Guerre d'importance

**Problème** : `widget.css` utilise `!important` sur quasi toutes les propriétés (~200 occurrences). C'est une stratégie de survie sans Shadow DOM, mais :

- Les autres extensions font pareil → bataille d'`!important`
- YouTube ajoute parfois des styles inline → override même `!important`

**Solution** : Avec Shadow DOM, on n'a plus besoin d'aucun `!important` → styles propres et maintenables.

---

## 🟢 RISQUES MINEURS (P2)

### 9. Fonts externes non chargées

**Problème** : `design-tokens.css` référence 'Cormorant Garamond', 'DM Sans', 'JetBrains Mono' mais aucun `@font-face` ou import Google Fonts n'est présent dans le content script. → Fallback sur les polices système.

**Impact** : Mineur visuellement, mais le rendu variera selon l'OS (Mac → San Francisco, Windows → Segoe UI, Linux → Noto Sans).

**Solution** : Soit embarquer un subset des fonts en web_accessible_resources, soit explicitement utiliser les system fonts stack et enlever les références aux fonts custom.

---

### 10. Performance MutationObserver

**Problème** : Un MutationObserver écoute `document.body` avec `{ childList: true, subtree: true }` (content.ts L842). Sur YouTube (SPA très dynamique), ça peut déclencher des milliers de callbacks.

**Solution** :

- Limiter le scope à `#content` ou `ytd-watch-flexy` plutôt que `document.body`
- Throttle/debounce le callback
- Déconnecter l'observer une fois `injected = true`

---

### 11. Double fichier content.ts / content/widget.ts

**Problème** : Le code d'injection existe en double (`content.ts` racine + `content/widget.ts`). Le z-index `99999` est hardcodé dans les deux pour TikTok floating.

**Solution** : Supprimer le doublon et centraliser.

---

## 📋 PLAN D'ACTION PRIORISÉ

| #   | Action                                                                | Priorité | Effort | Impact                            |
| --- | --------------------------------------------------------------------- | -------- | ------ | --------------------------------- |
| 1   | **Shadow DOM** : migrer l'injection dans un shadow root fermé         | P0       | 3h     | Élimine P0-1, P0-2, P1-8          |
| 2   | **Injection multi-stratégie** : fallback sous le player puis floating | P0       | 2h     | Élimine P0-3, P1-5                |
| 3   | **Détection théâtre/fullscreen** : adapter ou masquer la carte        | P1       | 1.5h   | Élimine P1-6                      |
| 4   | **Bouton minimiser** : réduire en icône flottante                     | P1       | 1.5h   | Élimine P1-7, mieux pour le Store |
| 5   | **Compatibilité Tournesol** : détecter + respecter l'espace           | P1       | 1h     | Élimine P1-4                      |
| 6   | **Observer optimisé** : scope réduit + disconnect                     | P2       | 30min  | Élimine P2-10                     |
| 7   | **Cleanup doublon** : supprimer content/widget.ts ou content.ts       | P2       | 30min  | Élimine P2-11                     |
| 8   | **Fonts** : clarifier la stratégie (system stack ou embed)            | P2       | 30min  | Élimine P2-9                      |

**Total estimé : ~10h de travail**

**Ordre recommandé : 1 → 2 → 4 → 3 → 5 → 6 → 7 → 8**

Le Shadow DOM (action 1) est la fondation — il résout 3 problèmes d'un coup et rend les actions suivantes plus simples.

---

## Compatibilité Tournesol — Recommandations spécifiques

Pour que DeepSight et Tournesol soient **complémentaires** :

1. **Aucun conflit de zone** : Tournesol = sous la vidéo / actions. DeepSight = sidebar. Pas de collision directe.
2. **Mode compact** : quand la sidebar est absente (théâtre, petit écran), DeepSight passe en floating → ne chevauche pas Tournesol
3. **Mention croisée optionnelle** : si Tournesol est détecté, afficher le score Tournesol dans le header de la carte DeepSight (via l'API Tournesol que le backend utilise déjà)
4. **Chrome Web Store** : mentionner dans la description "Compatible avec l'extension Tournesol"

---

_Rapport généré le 12 avril 2026_
