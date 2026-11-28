# Fiche Chrome Web Store — DeepSight

État : **préparée, non publiée**. L'ancienne fiche n'est plus accessible : on
crée une **nouvelle fiche**, donc un **nouvel ID d'extension**.

Ce document suit l'ordre du dashboard Chrome Web Store. Les textes en anglais
sont ceux de la fiche par défaut (`default_locale: en`) ; la version française
va dans la fiche localisée `fr`.

---

## 1. Prérequis avant la soumission

- [ ] **Compte développeur Chrome Web Store** sur le compte Google DeepSight
      (frais d'inscription unique, à régler dans le dashboard).
- [ ] **Le relecteur doit pouvoir tester** : sortir du mode privé (aujourd'hui
      l'API répond `private_mode` à tout autre compte que l'admin et au mode
      invité) ou lui fournir un compte de test.
- [ ] **Politique de confidentialité à jour** —
      `https://www.deepsightsynthesis.com/legal/privacy`, section 4
      « Extension Chrome » (`frontend/src/pages/PrivacyPolicy.tsx`). Elle ne
      parle que de YouTube ; il manque :
  - TikTok (mêmes données que YouTube) ;
  - la reprise de session sur `www.deepsightsynthesis.com` (le script lit les
    jetons que le site stocke dans son propre `localStorage`) ;
  - la lecture du presse-papiers, uniquement au clic sur « Coller le lien ».
- [ ] **Connexion Google** : soit on la laisse coupée côté API (le bouton se
      masque tout seul), soit on ajoute l'URI de redirection
      `https://<ID>.chromiumapp.org/` au client OAuth Google une fois l'ID
      connu (§ 2).
- [ ] **Version** : `version` de `public/manifest.json` à augmenter à chaque
      nouveau téléversement (2.0.0 pour le premier).

## 2. Figer l'ID de l'extension (une seule fois)

Procédure officielle (doc Chrome « Manifest – key ») :

1. `npm run package:cws`, puis dans le dashboard **Add new item** → téléverser
   le zip de `release/`. **Ne pas publier.**
2. Onglet **Package** → **View public key** → copier ce qu'il y a entre
   `-----BEGIN PUBLIC KEY-----` et `-----END PUBLIC KEY-----`, sur une ligne.
3. L'ajouter dans `public/manifest.json` : `"key": "<clé>"`, puis rebuild.
   L'extension chargée en local a alors le même ID que la fiche.
4. Rien d'autre à faire pour les téléversements suivants :
   `package:cws` retire `key` du zip (le Store refuse un manifest qui le
   contient).

À mettre à jour avec le nouvel ID :

- client OAuth Google (si la connexion Google est activée) ;
- le site, quand la fiche sera publique : aucun lien vers le Store
  n'existe aujourd'hui dans `frontend/`.

Rien à changer côté API : le CORS accepte toute origine
`chrome-extension://<id>`.

## 3. Le paquet

```powershell
cd C:\Users\maxim\DeepSight\extension ; npm run package:cws
```

→ `release\deepsight-extension-v<version>.zip` (≈ 730 Ko). Le script
`scripts/package-cws.mjs` fait son propre build de production dans
`release\cws-build\` : `dist\` (l'extension chargée en local) n'est pas
touché. Puis il :

- retire `key` du manifest et exclut les source maps ;
- tant que `STORE_VOICE` vaut `false` (en tête du script) : compile sans les
  appels vocaux (`--env voice=off`), exclut leurs fichiers, retire la
  permission `offscreen` et les hôtes ElevenLabs de la CSP. Le SDK ElevenLabs
  référence un worklet hébergé sur un CDN : le laisser dans le zip pourrait
  être lu comme du code distant, interdit en MV3.

En local, `npm run build` garde la voix : elle n'apparaît que si l'API répond
`voice_available: true` (clé ElevenLabs configurée sur le serveur).

Permissions du paquet : `storage`, `alarms`, `identity`, `clipboardWrite`,
`clipboardRead`, `sidePanel`. À l'installation, Chrome avertit de l'accès aux
données sur YouTube, TikTok et les sites DeepSight (hôtes et scripts du
manifest) et de la lecture des données copiées (`clipboardRead`).

## 4. Onglet « Store listing »

### Nom et résumé

Lus dans le manifest (`public/_locales/<langue>/messages.json`) :

| | EN | FR |
| --- | --- | --- |
| Nom | DeepSight - AI Video Analysis | DeepSight - Analyse vidéo IA |
| Résumé (≤ 132) | Analyze YouTube & TikTok videos in one click in Chrome's side panel: structured summary, reliability check, chat. European AI. | Analysez une vidéo YouTube ou TikTok en un clic depuis le panneau latéral : synthèse structurée, fiabilité, chat. IA européenne. |

### Description détaillée (EN)

```text
Analyze the YouTube or TikTok video you're watching in one click, without leaving the page.

DeepSight opens in Chrome's side panel, next to the video. Click "Analyze this video" and get a structured analysis written by Mistral AI:

• Verdict and key points of the video
• Main concepts and tags
• A reliability indicator: reliable, to verify or unreliable
• Three levels of detail: Accessible, Standard, Expert
• Analyses in English, French, Spanish or German

Then keep going:

• Chat with the video: ask follow-up questions, answers are grounded in the video
• Quick Chat: start chatting about a video without running a full analysis
• Share an analysis as a summary card, or print it to PDF
• Find your recent analyses in one place

Flashcards, quizzes, mind maps, playlists and exports are in the DeepSight web app, one click away, with the same account.

FREE TO START
• 3 analyses without an account
• Free account: 5 analyses per month
• Paid plans from €8.99/month on deepsightsynthesis.com

PRIVACY
• Only the video you choose to analyze is sent to DeepSight. The extension does not read your browsing history.
• Analyses are generated by Mistral AI, a European provider.
• Privacy policy: https://www.deepsightsynthesis.com/legal/privacy

Built by an independent developer in France.
```

### Description détaillée (FR)

```text
Analysez la vidéo YouTube ou TikTok que vous regardez en un clic, sans quitter la page.

DeepSight s'ouvre dans le panneau latéral de Chrome, à côté de la vidéo. Cliquez sur « Analyser cette vidéo » et obtenez une analyse structurée, rédigée par l'IA française Mistral :

• Verdict et points clés de la vidéo
• Concepts principaux et tags
• Un indicateur de fiabilité : fiable, à vérifier ou peu fiable
• Trois niveaux de détail : Accessible, Standard, Expert
• Analyses en français, anglais, espagnol ou allemand

Et ensuite :

• Discutez avec la vidéo : posez vos questions, les réponses s'appuient sur la vidéo
• Quick Chat : discutez d'une vidéo sans lancer d'analyse complète
• Partagez une analyse sous forme de fiche, ou imprimez-la en PDF
• Retrouvez vos analyses récentes au même endroit

Flashcards, quiz, cartes mentales, playlists et exports sont dans l'app web DeepSight, à un clic, avec le même compte.

GRATUIT POUR COMMENCER
• 3 analyses sans compte
• Compte gratuit : 5 analyses par mois
• Offres payantes dès 8,99 €/mois sur deepsightsynthesis.com

CONFIDENTIALITÉ
• Seule la vidéo que vous choisissez d'analyser est envoyée à DeepSight. L'extension ne lit pas votre historique de navigation.
• Les analyses sont générées par Mistral AI, un fournisseur européen.
• Politique de confidentialité : https://www.deepsightsynthesis.com/legal/privacy

Développé par un développeur indépendant, en France.
```

Avant de coller : vérifier que ces chiffres sont encore vrais
(`backend/src/billing/plan_config.py` pour les plans,
`backend/src/core/task_store.py` pour les 3 analyses invité par 24 h).

### Catégorie, langue, liens

- Catégorie : Productivité (sous-catégorie Éducation ou Outils, selon la
  liste du dashboard).
- Langues : English (par défaut), Français.
- Site officiel : `https://www.deepsightsynthesis.com`
- Support : `maxime@deepsightsynthesis.com`

### Visuels

Exigés par le dashboard : l'icône 128 × 128 (déjà dans le paquet :
`icons/icon128.png`), au moins une capture 1280 × 800, et la petite tuile
promo 440 × 280. La tuile marquee 1400 × 560 est facultative.

Captures à faire sur une vraie vidéo, sur Windows (5 maximum) :

1. Side panel ouvert à côté d'une vidéo YouTube, analyse terminée
   (verdict + points clés).
2. Chat avec la vidéo (question + réponse).
3. Indicateur de fiabilité et concepts.
4. Une vidéo TikTok analysée.
5. Analyses récentes.

## 5. Onglet « Privacy practices »

### Single purpose

```text
DeepSight analyzes the YouTube or TikTok video open in the current tab and shows an AI-generated structured summary of it in Chrome's side panel, where the user can also ask follow-up questions about that video.
```

### Justification des permissions

| Permission | Justification (à coller) |
| --- | --- |
| `storage` | Keeps the user's session (access and refresh tokens), their settings (language, analysis mode) and a short list of recent analyses on the device. |
| `alarms` | Renews the session token every 30 minutes so the user stays signed in, and wakes the background service worker every 30 seconds so an analysis in progress is not interrupted. |
| `identity` | Google sign-in through chrome.identity.launchWebAuthFlow, only when the user clicks "Continue with Google". |
| `clipboardRead` | Reads the clipboard only when the user clicks "Paste link", to analyze a YouTube or TikTok link they copied. |
| `clipboardWrite` | Copies a share link to the clipboard when the user clicks Copy or Share. |
| `sidePanel` | The whole interface lives in Chrome's side panel, opened from the toolbar icon or Alt+Shift+D. |
| Hôtes YouTube et TikTok | Detect the video open in the current tab so the side panel can offer to analyze it, and show the DeepSight badge on YouTube watch pages. Only the video ID is sent to the DeepSight API, when the user starts an analysis. |
| `api.deepsightsynthesis.com` | The DeepSight API: sign-in, analyses, chat and plan information. |
| Script sur `www.deepsightsynthesis.com` | Reuses the DeepSight web session (tokens the site stores in its own localStorage), so a user signed in on the website is signed in in the extension. |

### Code distant

« No, I am not using remote code » — vrai pour le zip de `package:cws` (tout
le JS est dans le paquet ; le SDK ElevenLabs est exclu tant que la voix est
coupée).

### Données collectées

Ce que l'extension envoie réellement à l'API DeepSight (pas d'analytics, pas
de rapport de crash envoyé : `utils/analytics.ts` et `sentry-reporter.ts` ne
sortent rien du navigateur) :

| Donnée | Quand | Case du formulaire (proposée) |
| --- | --- | --- |
| E-mail (+ mot de passe à la connexion) | création de compte, connexion | Personally identifiable information, Authentication information |
| Jetons de session | chaque appel API | Authentication information |
| URL / ID de la vidéo | au clic sur Analyser ou Quick Chat | Web history |
| Questions posées dans le chat | à l'envoi d'une question | Personal communications |

Le classement « Web history » et « Personal communications » est une
interprétation prudente des définitions du Store : à confirmer au moment de
remplir le formulaire.

Cocher les trois certifications : pas de vente des données, pas d'usage
étranger à la fonction de l'extension, pas d'usage pour du crédit.

URL de la politique de confidentialité :
`https://www.deepsightsynthesis.com/legal/privacy`

## 6. Mettre la voix dans une version publiée

La voix est déjà rebranchée dans le code : l'extension l'affiche dès que
l'API répond `voice_available: true` (clé ElevenLabs sur le serveur, kill
switch `VOICE_CALL_DISABLED` coupé). Seul le paquet du Store la laisse de
côté. Pour l'y mettre :

1. Héberger dans le paquet le worklet libsamplerate que le SDK ElevenLabs va
   chercher sur un CDN (comme `rawAudioProcessor.js` et
   `audioConcatProcessor.js` dans `webpack.config.js`).
2. Passer `STORE_VOICE` à `true` dans `scripts/package-cws.mjs`.
3. Compléter la fiche : justification de `offscreen` (capture micro dans un
   document offscreen, `getUserMedia` n'étant pas disponible dans le service
   worker), données « audio » envoyées à ElevenLabs dans les pratiques de
   confidentialité, et la politique de confidentialité du site.
4. Vérifier que la description reste juste : l'audio part chez ElevenLabs,
   pas chez Mistral (« IA européenne »).
