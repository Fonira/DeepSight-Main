# DeepSight — Agent Teams Prompt (13 février 2026)

## Instructions Globales
- Chaque teammate travaille UNIQUEMENT sur ses fichiers assignés
- AUCUNE modification de fichiers hors scope
- Code production-ready : TypeScript strict, gestion d'erreurs, edge cases
- Design system : dark mode #0a0a0f, accents bleu/violet/cyan, glassmorphism
- Backend Railway 512MB : pas de nouvelles dépendances lourdes
- Commit atomique par tâche terminée

---

## Teammate 1 — Frontend Legal (CGU/CGV)
**Notion ID**: 303d4ccc-7657-81e2-a58f-e882231f3516
**Priorité**: 🔴 Urgente — Deadline AUJOURD'HUI

### Scope fichiers (EXCLUSIF)
- `frontend/src/pages/LegalPage.tsx` (existe, à refactorer)
- `frontend/src/pages/TermsPage.tsx` (nouveau)
- `frontend/src/pages/PrivacyPage.tsx` (nouveau)
- `frontend/src/components/legal/` (nouveau dossier)

### Tâche
Créer des pages CGU et Politique de confidentialité conformes RGPD pour DeepSight.

**Informations légales** :
- Société : DeepSight / RCS 994 558 898 Lyon
- Site : https://www.deepsightsynthesis.com
- Hébergement : Railway (EU) + Vercel
- Données collectées : email, nom, historique d'analyses YouTube, données de paiement (via Stripe)
- Plans tarifaires : Free (0€), Student (2,99€), Starter (5,99€), Pro (12,99€), Team (29,99€)
- Paiement : Stripe (CB)
- Cookies : analytics (Sentry, PostHog prévu)
- Durée conservation : selon plan (3j Free → illimité Team)
- Contact DPO : contact@deepsightsynthesis.com

**Contenu à créer** :
1. **CGU** (`TermsPage.tsx`) : objet du service, inscription, plans/tarifs, propriété intellectuelle, responsabilités, résiliation, droit applicable (français)
2. **Politique de confidentialité** (`PrivacyPage.tsx`) : données collectées, base légale, sous-traitants (Stripe, Mistral AI, Perplexity, Railway, Vercel, Resend), droits RGPD (accès, rectification, suppression, portabilité), cookies, transferts hors UE
3. **Refactorer `LegalPage.tsx`** : en faire un hub avec liens vers CGU et Politique de confidentialité

**Design** : dark mode, typographie claire, sections avec ancres, table des matières

### Routes à ajouter
```tsx
// Dans le router principal (vérifier App.tsx ou router config)
<Route path="/terms" element={<TermsPage />} />
<Route path="/privacy" element={<PrivacyPage />} />
```

### NE PAS TOUCHER
- Aucun fichier mobile
- Aucun fichier backend
- Aucune page frontend hors scope legal

---

## Teammate 2 — Mobile Features (Export + Analytics)
**Notion IDs**:
- Export : 303d4ccc-7657-814a-9d05-ed71fdebb219
- Analytics : 303d4ccc-7657-8133-a7d0-cda19ed8dcd1
**Priorité**: 🟠 Haute — Deadline 20 février

### Scope fichiers (EXCLUSIF)
- `mobile/src/screens/ExportScreen.tsx` (nouveau)
- `mobile/src/screens/AnalyticsScreen.tsx` (nouveau)
- `mobile/src/components/export/` (nouveau dossier)
- `mobile/src/components/analytics/` (nouveau dossier)
- `mobile/src/services/api.ts` — SEULEMENT ajouter des fonctions dans `exportApi` et créer `analyticsApi` (ne pas modifier les fonctions existantes)

### Tâche 1 : Export PDF/Markdown Mobile
Créer un écran d'export qui permet de télécharger les analyses en PDF ou Markdown.

**Endpoints backend existants** :
```
POST /api/videos/export
Body: { summary_id: int, format: "pdf" | "docx" | "markdown" }
Response: fichier binaire
```

**Fonctionnalités** :
- Sélection du format (PDF, Markdown) — DOCX optionnel mobile
- Preview avant export
- Téléchargement via `expo-file-system` + `expo-sharing`
- Gestion des erreurs (analyse non trouvée, format non supporté)
- Loading state avec animation

**UI** : StyleSheet.create, dark mode, boutons avec icônes Ionicons

### Tâche 2 : Analytics Page Mobile
Créer un écran analytics montrant les statistiques d'utilisation de l'utilisateur.

**Endpoints backend existants** :
```
GET /api/usage/stats → { analyses_used, analyses_limit, credits_used, credits_limit, ... }
GET /api/videos/history?page=1&per_page=10 → { items: [...], total, pages }
```

**Fonctionnalités** :
- Résumé : analyses utilisées / limite, crédits restants
- Graphique simple (barres ou cercle) des analyses par jour/semaine
- Historique récent (5 dernières analyses)
- Badge plan actuel

**UI** : StyleSheet.create, composants réutilisables, react-native-svg pour les graphiques simples

### NE PAS TOUCHER
- Aucun fichier frontend
- Aucun fichier backend
- `mobile/src/screens/AnalysisScreen.tsx` (existant, différent)
- Navigation : mentionner les routes à ajouter mais ne pas modifier le fichier navigation directement

---

## Teammate 3 — Frontend Marketing (Landing Page)
**Notion ID**: 303d4ccc-7657-810c-a446-d50d5a61c9bf
**Priorité**: 🟠 Haute — Deadline 17 février

### Scope fichiers (EXCLUSIF)
- `frontend/src/pages/LandingPage.tsx` (existe, à réécrire)
- `frontend/src/components/landing/` (nouveau dossier pour composants)

### Tâche
Réécrire le copywriting de la landing page pour être plus convaincant et conversion-oriented.

**Proposition de valeur DeepSight** :
- Analyse YouTube alimentée par IA bayésienne
- Résumés intelligents avec niveaux de certitude (SOLIDE/PLAUSIBLE/INCERTAIN/A VÉRIFIER)
- Fact-checking automatique via Perplexity
- Flashcards et concept maps pour l'étude
- Chat contextuel avec l'analyse
- Export PDF/Markdown

**Cible** : étudiants, chercheurs, créateurs de contenu, professionnels qui consomment beaucoup de YouTube éducatif

**Structure landing** :
1. Hero : headline percutant + CTA + démo visuelle
2. Pain points : problèmes résolus (fake news, prise de notes, temps perdu)
3. Features : 4-6 features clés avec icônes
4. Social proof : métriques ou témoignages (placeholder OK)
5. Plans tarifaires : Free → Team avec CTA
6. FAQ : 5-6 questions fréquentes
7. Footer CTA : dernier call-to-action

**Design** : dark mode glassmorphism, animations Framer Motion, responsive (mobile-first), accents bleu/violet/cyan

### NE PAS TOUCHER
- Aucun fichier mobile
- Aucun fichier backend
- Aucune page frontend hors landing

---

## Tâche Différée — PostHog Integration
**Notion ID**: 303d4ccc-7657-812a-b4a0-f7969a5fe5a4
**Raison** : touche des fichiers cross-cutting (frontend App.tsx, mobile App.tsx, potentiellement backend)
**À faire APRÈS** les 3 teammates ci-dessus
