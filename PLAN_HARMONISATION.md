# PLAN D'HARMONISATION DeepSight — Écosystème Tri-Plateforme
*Février 2026 — Audit & Plan d'exécution*

---

## 1. INCOHÉRENCES CRITIQUES DÉTECTÉES

### 1.1 Les plans ne sont PAS les mêmes partout

| Source | Plans définis | Commentaire |
|--------|-------------|-------------|
| **Backend `config.py` (v3)** | free, starter, pro, expert, unlimited | ⚠️ Pas d'étudiant, pas d'équipe |
| **Backend `plan_config.py` (v4)** | free, etudiant, starter, pro, equipe | ✅ Source de vérité billing |
| **Frontend `planPrivileges.ts`** | free, etudiant, starter, pro, equipe | ✅ Miroir de v4 |
| **Frontend `UsageDashboard.tsx`** | free, starter, pro, expert | ❌ Copie locale divergente |
| **Mobile `planPrivileges.ts`** | free, student, starter, pro, team | ⚠️ Noms anglais différents |
| **Mobile `constants/config.ts`** | synthesis, detailed, critique, educational | ❌ Modes complètement différents |
| **Extension `types/index.ts`** | free, student, starter, pro, team | ✅ Mais via API (pas hardcodé) |

### 1.2 Les PRIX divergent

| Plan | Backend v3 (Stripe) | Backend v4 | Frontend | Mobile |
|------|---------------------|------------|----------|--------|
| Étudiant | **N'EXISTE PAS** | 2.99€ | 2.99€ | 2.99€ |
| Starter | **4.99€** | 5.99€ | 5.99€ | 5.99€ |
| Pro | **9.99€** | 12.99€ | 12.99€ | 12.99€ |
| Expert/Équipe | **14.99€** | 29.99€ | 29.99€ | 29.99€ |

### 1.3 Les LIMITES divergent

| Métrique | Backend v3 | Backend v4 | Frontend | Mobile |
|----------|-----------|------------|----------|--------|
| Free analyses | 5/jour | 3/mois | 3/mois | 3/mois |
| Free crédits | 500 | — | 150 cred | 150 cred |
| Free historique | 7 jours | 60 jours | 60 jours | 3 jours |
| Free chat/vidéo | 5 | 5 | 5 | 3 |
| Starter default model | small | **medium** | small | small |
| Pro default model | medium | **large** | medium | medium |

### 1.4 Les OPTIONS D'ANALYSE divergent

| Option | Web (Dashboard) | Mobile (Dashboard) | Mobile (config.ts) | Extension |
|--------|----------------|-------------------|-------------------|-----------|
| Modes analyse | accessible, standard, expert | accessible, standard, expert | synthesis, detailed, critique, educational | standard, accessible, expert |
| Catégories | 10 (auto + 9) | 10 (auto + 9) | général + ~8 | Aucune (auto) |
| Modèles | Dropdown si >1 | Dropdown si >1 | 3 fixes | Aucun choix |
| Anti-IA | Bouton géant | Toggle 72px | — | — |
| Style écriture | 6 options (web) | 6 options (≠ noms!) | — | — |
| Longueur | 4 (court/moyen/long/auto) | 3 (short/medium/long) | — | — |
| Checkboxes | 3 (comments/metadata/intention) | 2 (examples/personalTone) | — | — |
| Instructions | 2000 chars | 500 chars | — | — |

### 1.5 Les STYLES D'ÉCRITURE divergent

| Web (analysis.ts) | Mobile (analysis.ts) |
|-------------------|---------------------|
| default (Défaut) | academic |
| human (Humain) | conversational |
| academic (Académique) | professional |
| casual (Décontracté) | creative |
| humorous (Humoristique) | journalistic |
| feminine (Doux) | technical |

**Totalement différents !** Les styles web et mobile ne sont pas les mêmes.

---

## 2. DÉCISIONS D'HARMONISATION

### 2.1 Source de vérité unique : `plan_config.py` (v4)

| Décision | Détail |
|----------|--------|
| Plans officiels | free, etudiant, starter, pro, equipe |
| Alias anglais | free, student, starter, pro, team |
| Prix | 0€, 2.99€, 5.99€, 12.99€, 29.99€ |
| `config.py` v3 | Synchroniser PLAN_LIMITS avec v4 ou pointer vers v4 |

### 2.2 Options d'analyse simplifiées (harmonisées)

**AVANT (13+ options, différentes par plateforme)**
**APRÈS (7 options, identiques partout)**

| Option | Web | Mobile | Extension | Valeurs |
|--------|-----|--------|-----------|---------|
| Mode | ✅ | ✅ | ✅ | accessible, standard, expert |
| Style | ✅ (L1 visible) | ✅ (L1 visible) | ❌ (pas de place) | default, human, academic, casual, humorous, soft |
| Anti-IA | ✅ (toggle compact) | ✅ (toggle compact) | ❌ | boolean |
| Longueur | ✅ (dans "Plus") | ✅ (dans "Plus") | ❌ | short, medium, long, auto |
| Instructions | ✅ (dans "Plus", 2000 chars) | ✅ (dans "Plus", 500 chars) | ❌ | string |
| Catégorie | ❌ Supprimée (auto) | ❌ Supprimée (auto) | ❌ (déjà auto) | Forcé "auto" |
| Modèle | ❌ Supprimé (auto best) | ❌ Supprimé (auto best) | ❌ (déjà absent) | Auto meilleur dispo |

### 2.3 Styles d'écriture unifiés

On fusionne les 2 listes en une seule cohérente :

| ID | FR | EN | Emoji | Disponible |
|----|----|----|-------|-----------|
| `default` | Par défaut | Default | ⚖️ | Web + Mobile |
| `human` | Naturel | Natural | 🧑 | Web + Mobile |
| `academic` | Académique | Academic | 🎓 | Web + Mobile |
| `casual` | Décontracté | Casual | 😊 | Web + Mobile |
| `humorous` | Humoristique | Humorous | 😄 | Web + Mobile |
| `soft` | Doux | Soft | 💜 | Web + Mobile |

### 2.4 Mode Texte : minimum 100 caractères

Ajout sur Web + Mobile du message : "Minimum 100 caractères" + validation visuelle.

---

## 3. FICHIERS À MODIFIER — PAR ÉTAPE

### ÉTAPE 1 : Simplification analyse (Frontend Web)

| # | Fichier | Action |
|---|---------|--------|
| 1 | `frontend/src/pages/DashboardPage.tsx` | Supprimer Catégorie, supprimer Modèle, réduire Anti-IA, remonter Style L1 |
| 2 | `frontend/src/components/analysis/CustomizationPanel.tsx` | Restructurer : Style au L1, supprimer checkboxes, Anti-IA = toggle |
| 3 | `frontend/src/types/analysis.ts` | Supprimer includeComments/Metadata/Intention, renommer feminine→soft |
| 4 | `frontend/src/components/SmartInputBar.tsx` | Ajouter validation 100 chars mode texte |
| 5 | `frontend/src/services/api.ts` | Adapter params envoyés (category=auto, model=auto) |

### ÉTAPE 2 : Harmonisation UsageDashboard

| # | Fichier | Action |
|---|---------|--------|
| 6 | `frontend/src/pages/UsageDashboard.tsx` | Supprimer PLAN_INFO hardcodé → importer planPrivileges.ts |
| 7 | `frontend/src/pages/UsageDashboard.tsx` | Corriger USER_GUIDE : modes "Express/Standard/Approfondi" → "Accessible/Standard/Expert" |
| 8 | `frontend/src/pages/UsageDashboard.tsx` | Mettre à jour section Personnalisation : refléter nouvelles options |
| 9 | `frontend/src/pages/UsageDashboard.tsx` | Supprimer section Modèles IA (auto-sélection) ou adapter texte |

### ÉTAPE 3 : Synchronisation plans sur le site Web

| # | Fichier | Action |
|---|---------|--------|
| 10 | `frontend/src/pages/LandingPage.tsx` | Supprimer PLANS hardcodé → importer planPrivileges.ts |
| 11 | `frontend/src/components/layout/Sidebar.tsx` | Ajouter labels etudiant/equipe |
| 12 | `frontend/src/components/sidebar/SidebarUserCard.tsx` | Vérifier glow colors tous plans |
| 13 | `frontend/src/components/CreditAlert.tsx` | Aligner plans |
| 14 | `frontend/src/components/UpgradeModal.tsx` | Vérifier prix/features |

### ÉTAPE 4 : Harmonisation Mobile

| # | Fichier | Action |
|---|---------|--------|
| 15 | `mobile/src/types/analysis.ts` | Aligner WritingStyle et TargetLength avec le web |
| 16 | `mobile/src/components/analysis/CustomizationPanel.tsx` | Même structure que web (Style L1, toggle Anti-IA, Plus d'options) |
| 17 | `mobile/src/screens/DashboardScreen.tsx` | Supprimer Catégorie, Modèle |
| 18 | `mobile/src/components/SmartInputBar.tsx` | Validation 100 chars texte |
| 19 | `mobile/src/constants/config.ts` | Supprimer ANALYSIS_MODES legacy (synthesis/detailed/critique) |
| 20 | `mobile/src/config/planPrivileges.ts` | Synchroniser valeurs avec backend v4 |
| 21 | `mobile/src/services/api.ts` | Adapter params analyse (category=auto, model=auto) |

### ÉTAPE 5 : Backend synchronisation

| # | Fichier | Action |
|---|---------|--------|
| 22 | `backend/src/core/config.py` PLAN_LIMITS | Synchroniser avec plan_config.py v4 (ajouter etudiant, aligner prix) |
| 23 | `backend/src/core/config.py` STRIPE_CONFIG | Aligner prix (starter=5.99, pro=12.99, ajouter etudiant) |
| 24 | `backend/src/videos/router.py` | Model auto=best_for_plan, category=auto par défaut |

### ÉTAPE 6 : Extension (minimal, déjà propre)

| # | Fichier | Action |
|---|---------|--------|
| 25 | `extension/src/popup/components/SynthesisView.tsx` | Vérifier FEATURE_CTAS prix |
| 26 | `extension/src/types/index.ts` | Confirmer PlanInfo.plan_id inclut 'student' |

---

## 4. ESTIMATION

| Étape | Complexité | Fichiers | Risque |
|-------|-----------|----------|--------|
| 1. Simplification Web | Moyenne | 5 | Faible (UI only) |
| 2. UsageDashboard | Faible | 1 | Faible (guide text) |
| 3. Sync plans Web | Moyenne | 5 | Moyen (LandingPage refactor) |
| 4. Mobile | Haute | 7 | Moyen (types partagés) |
| 5. Backend | Haute | 3 | **Élevé** (impacts auth + billing) |
| 6. Extension | Faible | 2 | Faible |

**Total : ~26 fichiers, 6 étapes**

---

## 5. ORDRE D'EXÉCUTION RECOMMANDÉ

1. **Étape 1** → Simplification analyse Web (impact visible immédiat, zéro risque backend)
2. **Étape 2** → UsageDashboard (cohérence guide)
3. **Étape 3** → Sync plans Web (tous les prix/features alignés sur planPrivileges.ts)
4. **Étape 4** → Mobile (aligner types + UI avec web)
5. **Étape 5** → Backend (sync config.py avec plan_config.py, DERNIÈRE car plus risqué)
6. **Étape 6** → Extension (vérification finale)

Chaque étape est indépendante et testable avant de passer à la suivante.
