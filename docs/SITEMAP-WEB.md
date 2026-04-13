# DeepSight Web — Cartographie Complète du Site

_Dernière mise à jour : 12 avril 2026_

---

## Arbre d'architecture (toutes les routes)

```
🌐 deepsightsynthesis.com
│
├── 📄 PAGES PUBLIQUES (non authentifié)
│   ├── /                          → Landing page (redirige vers /dashboard si connecté)
│   ├── /login                     → Connexion (email + Google OAuth)
│   ├── /auth/callback             → Callback OAuth Google
│   ├── /about                     → À propos — "Analyser, comprendre, apprendre autrement"
│   ├── /contact                   → Formulaire de contact — fond animé icônes
│   ├── /status                    → Statut des services (health, DB, uptime, mémoire)
│   ├── /api-docs                  → Documentation API publique (Plan Expert requis)
│   ├── /s/:shareToken             → Analyse partagée (lien public)
│   ├── /extension-welcome         → Page d'accueil extension Chrome
│   ├── /payment/success           → Confirmation paiement Stripe
│   ├── /payment/cancel            → Annulation paiement Stripe
│   └── /legal                     → Hub juridique avec 4 sous-onglets :
│       ├── /legal (Mentions légales)    → Éditeur, SIRET, contact
│       ├── /legal/cgu                   → CGU / CGV
│       ├── /legal/privacy               → Confidentialité
│       └── /legal (Cookies)             → Politique cookies
│
├── 🔒 PAGES PROTÉGÉES (authentifié)
│   │
│   ├── 📊 ANALYSE & CONTENU
│   │   ├── /dashboard             → ⭐ PAGE PRINCIPALE — Analyse vidéo
│   │   │   ├── Onglets input : Recherche YouTube | URL Vidéo | Images | Texte | Bibliothèque
│   │   │   ├── Détection auto activable
│   │   │   ├── Personnalisation avancée (focus, ton, longueur, langue)
│   │   │   ├── Recherche approfondie (toggle, 40+ sources web)
│   │   │   ├── Section Recommandations Tournesol (Toutes/Français/Anglais)
│   │   │   └── Bandeau Extension Chrome en bas
│   │   │
│   │   ├── /history               → Historique des analyses
│   │   │   ├── Stats header : 63 Vidéos | 10 Débats | 99k Mots | 4h 7min Durée
│   │   │   ├── Profil utilisateur : catégories (tech, general, Culture, health)
│   │   │   ├── Onglets : Vidéos (63) | Débat IA (10)
│   │   │   ├── Recherche + filtre catégories + vue grille/liste
│   │   │   ├── Sections : Vidéos individuelles | Playlists | etc.
│   │   │   └── Vue détail inline (clic sur vidéo → expand avec player + métadonnées)
│   │   │
│   │   ├── /debate                → Débat IA ⚠️ ERREUR ACTUELLE — page crash
│   │   │   └── Affiche "Oups, une erreur est survenue" + boutons Réessayer/Retour
│   │   │
│   │   └── /debate/:id            → Détail d'un débat spécifique
│   │
│   ├── 🤖 RÉVISION & IA
│   │   ├── /chat                  → Chat IA contextuel
│   │   │   ├── Sidebar gauche : liste conversations (thumbnails vidéos + dates)
│   │   │   ├── Recherche conversations
│   │   │   ├── Zone centrale : "Choisir une vidéo" (sélection dans sidebar)
│   │   │   ├── Bouton Chat IA flottant en bas à droite
│   │   │   └── Bouton Retour en bas sidebar
│   │   │
│   │   ├── /revision              → ⚠️ Redirige probablement vers /study
│   │   │
│   │   └── /study                 → Révision (spaced repetition)
│   │       ├── Onglets : Vue d'ensemble | Mes vidéos | Badges (0/2)
│   │       ├── Interface flashcards, quiz
│   │       └── /study/:summaryId  → Révision d'une analyse spécifique
│   │
│   ├── 👤 COMPTE
│   │   ├── /settings              → Paramètres
│   │   │   ├── Apparence : Thème (Clair/Sombre/Système) + Langue (FR/EN)
│   │   │   ├── Notifications : toggle notifications navigateur
│   │   │   ├── Lecture vocale : lecture auto des réponses Chat IA
│   │   │   ├── Préférences d'analyse : Score Tournesol, Sauvegarde auto
│   │   │   └── Paramètres vocaux : Mode interaction (Appuyer/Détection vocale), Interruptions
│   │   │
│   │   ├── /account               → Mon compte
│   │   │   ├── Infos : email, identifiant, date membre, abonnement, crédits
│   │   │   └── Privilèges du plan : Analyses, Chat IA, Flashcards, Cartes mentales, Recherche web, Playlists
│   │   │
│   │   ├── /upgrade               → Mon plan (choix d'abonnement)
│   │   │   ├── Vue Cartes | Comparaison
│   │   │   ├── 3 plans : Gratuit (0€) | Plus (4.99€) | Pro (9.99€)
│   │   │   └── Détail features par plan avec bouton Downgrade/Upgrade
│   │   │
│   │   └── /usage                 → Utilisation
│   │       ├── Plan actuel + prix
│   │       ├── Compteurs : Analyses/mois | Chat IA/jour | Recherche web
│   │       └── Vidéo de présentation
│   │
│   ├── 📈 ADMIN (restreint)
│   │   ├── /admin                 → Dashboard admin
│   │   └── /analytics             → Analytics internes
│   │
│   └── 🔗 REDIRECTIONS
│       └── /playlists             → Redirige vers /debate
│
└── 🧩 COMPOSANTS TRANSVERSAUX (sidebar)
    ├── Logo Deep Sight + toggle collapse
    ├── Navigation principale :
    │   ├── Analyse
    │   ├── Historique
    │   └── Débat IA
    ├── Section "RÉVISION & IA" :
    │   ├── Chat IA
    │   └── Révision
    ├── Section "COMPTE" :
    │   ├── Paramètres
    │   ├── Mon compte
    │   ├── Mon plan
    │   └── Utilisation
    ├── Widget dynamique (rotation aléatoire — affiche contexte vidéo aléatoire)
    ├── Mode Jeu : ON/OFF + Classique/Prompt Inverse
    ├── Badge plan (Pro) + compteur analyses (7/100)
    ├── Profil utilisateur (nom + crédits)
    └── Bouton déconnexion
```

---

## Résumé des observations (12 avril 2026)

| Page              | Route        | État     | Notes                                       |
| ----------------- | ------------ | -------- | ------------------------------------------- |
| Dashboard/Analyse | `/dashboard` | ✅ OK    | Page principale, 5 onglets input            |
| Historique        | `/history`   | ✅ OK    | Stats + profil + grille vidéos              |
| Débat IA          | `/debate`    | ❌ CRASH | Error boundary affiché                      |
| Chat IA           | `/chat`      | ✅ OK    | Sidebar conversations + zone chat           |
| Révision          | `/revision`  | ⚠️ Vide  | Page noire, probablement redirige           |
| Study             | `/study`     | ✅ OK    | 3 onglets, contenu vide (pas de flashcards) |
| Paramètres        | `/settings`  | ✅ OK    | 4 sections, scrollable                      |
| Mon compte        | `/account`   | ✅ OK    | Infos + privilèges plan                     |
| Mon plan          | `/upgrade`   | ✅ OK    | 3 plans (Gratuit/Plus/Pro)                  |
| Utilisation       | `/usage`     | ✅ OK    | Compteurs + vidéo                           |
| About             | `/about`     | ✅ OK    | Page statique simple                        |
| Contact           | `/contact`   | ✅ OK    | Fond animé, formulaire                      |
| Status            | `/status`    | ✅ OK    | Health check live                           |
| API Docs          | `/api-docs`  | ✅ OK    | Doc endpoints publics                       |
| Legal             | `/legal`     | ✅ OK    | 4 sous-onglets juridiques                   |

### Bugs identifiés pendant la cartographie

1. **`/debate` crash** — Error boundary avec "Oups, une erreur est survenue"
2. **`/revision` page noire** — Aucun contenu affiché, possible problème de routing
3. **Pricing incohérent** — CLAUDE.md dit 3 plans (Gratuit/Pro 5.99€/Expert 14.99€) mais la page `/upgrade` montre Gratuit/Plus 4.99€/Pro 9.99€

### Notes pricing (ce que j'ai vu sur `/upgrade`)

- **Gratuit** : 0€ — 5 analyses, 15min, Chat IA 5q/vidéo, Flashcards & Quiz
- **Plus** : 4.99€ — 25 analyses, 1h, Chat IA 25q/50j, Fact-check auto, Recherche web 20/mois, Débat IA 3/mois
- **Pro** : 9.99€ — 100 analyses, 4h, Chat IA illimité, Deep Research, Playlists 10, ElevenLabs 45min, TTS, Débat IA 20/mois
