# 📚 Documentation Sync - TODOs

**Généré le:** 30 janvier 2026  
**Période analysée:** 2 dernières semaines de commits

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

## 🟢 Minor / Nice-to-have

### 9. Version bump
`docs/CLAUDE-BACKEND.md` indique "Version actuelle: 5.5.1"
→ Vérifier si la version est toujours à jour après ces commits

### 10. TypeScript fixes frontend
**Commit:** `da65b2bf` - "fix(frontend): Resolve TypeScript errors"
→ Vérifier si des types publics de l'API ont changé

---

## 📋 Résumé des actions

| Priorité | Action | Fichier cible |
|----------|--------|---------------|
| 🔴 Haute | Créer CONTRIBUTING.md | `/CONTRIBUTING.md` |
| 🔴 Haute | Doc SSL Railway | `backend/README.md`, `docs/CLAUDE-BACKEND.md` |
| 🟡 Moyenne | Doc système transcripts | `docs/CLAUDE-BACKEND.md` |
| 🟡 Moyenne | Doc mobile complète | `mobile/README.md` (à créer) |
| 🟡 Moyenne | Doc hooks stability | `mobile/README.md` |
| 🟢 Basse | Version check | `docs/CLAUDE-BACKEND.md` |

---

*Ce fichier sera supprimé une fois les mises à jour effectuées.*
