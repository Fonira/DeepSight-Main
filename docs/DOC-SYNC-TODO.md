# 📚 Documentation Sync - TODOs

**Généré le:** 30 janvier 2026  
**Dernière mise à jour:** 30 janvier 2026 @ 20:00  
**Période analysée:** 2 dernières semaines de commits

---

## 🔴 URGENT - Changements majeurs non documentés

### 0. Extension Chrome YouTube ⭐ NOUVEAU

**Commit:** `f8a66006` - "feat(extension): Add Chrome extension for YouTube" (30 jan 2026)

**Composant majeur ajouté !** L'extension a son propre `README.md` mais :

**À faire immédiatement:**

- [ ] Mettre à jour `README.md` principal → ajouter `extension/` dans la structure
- [ ] Ajouter section "Extension Chrome" dans le README principal
- [ ] Corriger l'URL API dans `extension/README.md` (indique `deepsight-production` mais devrait être `deep-sight-backend-v3-production`)

**Note:** L'extension est complète avec :

- Manifest V3
- React 18 + TypeScript + Webpack 5
- Tailwind CSS
- Documentation README dédiée (bien faite !)

---

## 🔴 Manquants (à créer)

### 1. CONTRIBUTING.md

Aucun guide de contribution n'existe. À créer avec :

- Workflow Git (branches, PRs)
- Standards de code (linting, types)
- Process de review
- Setup environnement dev

### 2. Documentation Mobile

Le mobile manque de documentation dédiée :

- Setup Expo/EAS
- Configuration Apple Developer
- Build et deploy (EAS Build)
- Différences avec le web

---

## 🟡 À mettre à jour

### 3. Configuration SSL PostgreSQL (Railway)

**Commits concernés:** `fa3bd25f`, `816b2a69`, `02d613ae`, `aebf3b5e`

Plusieurs commits récents pour configurer SSL avec Railway proxy :

```python
# Nouvelle config dans database.py
ssl='require'  # ou ssl=True selon le context
```

**Fichiers à documenter:**

- `backend/README.md` → Section "Déploiement Railway"
- `docs/CLAUDE-BACKEND.md` → Section "Configuration environnement"

**Ajouter:**

```env
# Pour Railway public proxy avec SSL termination
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db
# Note: utiliser ssl='require' dans asyncpg pour Railway proxy
```

---

### 4. Nouveau système de transcripts

**Fichiers ajoutés:**

- `backend/src/transcripts/monitor.py`
- `backend/src/transcripts/ultra_resilient.py`

**Non documenté dans:**

- `docs/CLAUDE-BACKEND.md` (section "Extraction YouTube")
- `backend/README.md`

**À ajouter:** Description du monitoring et du système ultra-résilient de fallback.

---

### 5. Limite académique (tier system)

**Commit:** `fde42dd3` - "fix(academic): increase schema limit to match tier system"

**À vérifier et documenter:**

- Nouvelle limite dans `academic/schemas.py`
- Impact sur les quotas par plan
- Mettre à jour les tableaux de quotas si changés

---

### 6. Fix auth mobile

**Commit:** `fca4abc7` - "fix(auth): Correction du bug de connexion mobile"

**À documenter:**

- Comportement attendu sur mobile
- Différences d'auth mobile vs web (si applicable)
- `mobile/src/contexts/AuthContext.tsx` - changements

---

### 7. Stabilité des hooks React Native

**Commit:** `cf7af8fa` - "fix(hooks): Improve component stability with mounted reference"

**Fichiers modifiés:**

- `mobile/src/hooks/useNotifications.ts`
- `mobile/src/hooks/useNetworkStatus.ts`

**À documenter:** Pattern de cleanup avec `mounted` ref pour éviter les memory leaks.

---

### 8. Credentials Apple EAS

**Commit:** `d7522328` - "chore: update Apple credentials for EAS submit"

**À ajouter dans documentation mobile:**

- Process de mise à jour des credentials
- Certificats et provisioning profiles
- EAS Submit configuration

---

### 9. BackgroundAnalysisProvider (nouveau context)

**Commit:** `6557f258` - "fix(mobile): Add missing BackgroundAnalysisProvider to App.tsx"

**À documenter:**

- Architecture des Context providers de l'app mobile
- Ordre d'imbrication des providers dans `App.tsx`
- Fonctionnalité d'analyse en arrière-plan

---

### 10. Limitation modèles IA (Mistral only)

**Commit:** `79ffe71d` - "fix(mobile): Fix history analysis loading + limit AI models to Mistral only"

**À documenter:**

- Quels modèles IA sont disponibles sur mobile vs web
- Raison de la limitation à Mistral (coût ? perf ? disponibilité ?)

---

## 🟢 Minor / Nice-to-have

### 11. Version bump

`docs/CLAUDE-BACKEND.md` indique "Version actuelle: 5.5.1"
→ Vérifier si la version est toujours à jour après ces commits

### 12. TypeScript fixes frontend

**Commit:** `da65b2bf` - "fix(frontend): Resolve TypeScript errors"
→ Vérifier si des types publics de l'API ont changé

---

## 📋 Résumé des actions

| Priorité      | Action                             | Fichier cible                                 |
| ------------- | ---------------------------------- | --------------------------------------------- |
| 🔴 **URGENT** | Ajouter extension Chrome au README | `/README.md`                                  |
| 🔴 **URGENT** | Corriger URL API extension         | `extension/README.md`                         |
| 🔴 Haute      | Créer CONTRIBUTING.md              | `/CONTRIBUTING.md`                            |
| 🔴 Haute      | Doc SSL Railway                    | `backend/README.md`, `docs/CLAUDE-BACKEND.md` |
| 🟡 Moyenne    | Doc système transcripts            | `docs/CLAUDE-BACKEND.md`                      |
| 🟡 Moyenne    | Doc mobile complète                | `mobile/README.md`                            |
| 🟡 Moyenne    | Doc hooks stability                | `mobile/README.md`                            |
| 🟢 Basse      | Version check                      | `docs/CLAUDE-BACKEND.md`                      |

---

_Ce fichier sera supprimé une fois les mises à jour effectuées._
