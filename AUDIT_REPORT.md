# 📊 Audit DeepSight — Rapport Cross-référence Notion × Codebase
**Date** : 13 février 2026
**Auteur** : Claude (Senior Tech Lead)

---

## 🔴 TÂCHES OBSOLÈTES → Marquer ❌ Annulé dans Notion

| Tâche | ID Notion | Raison |
|-------|-----------|--------|
| Stripe billing portal + factures auto | `303d4ccc-7657-81e0` | Déjà implémenté `billing/router.py:491-513` |
| Architecture Extension Chrome (Manifest V3) | `303d4ccc-7657-8105` | Extension v1.1.0 existe et fonctionne |
| Word definitions porter sur mobile | `303d4ccc-7657-81bd` | `ConceptsGlossary.tsx` existe côté mobile |
| Push notifications mobile | `303d4ccc-7657-8171` | `notifications.ts` (406 lignes) implémenté |

## 🟡 TÂCHES PARTIELLEMENT FAITES → Mettre à jour description

| Tâche | État réel | Reste à faire |
|-------|-----------|---------------|
| Mentions légales obligatoires | `LegalPage.tsx` existe avec onglet | Vérifier contenu juridique |
| CGU/CGV conformes | Onglet CGU dans `LegalPage.tsx` | Vérifier conformité RGPD |
| SEO meta tags, sitemap, schema.org | `SEO.tsx` existe (OG, Twitter) | Manque sitemap.xml + schema.org |
| Refacto API mobile | Error handling centralisé | Nettoyage mineur possible |

## ✅ TÂCHES VALIDES — Priorisées pour exécution

### 🔴 Urgente / Bug
1. **Fix WebSocket JWT authentication** — `user_id = 1` hardcodé L569 `websocket.py`

### 🟠 Haute / Sécurité-Legal
2. **Cookie banner RGPD** — Aucun composant trouvé
3. **subscription_renewal Stripe** — `None` L214 `usage/router.py`

### 🟠 Haute / SEO-Marketing
4. **SEO: sitemap.xml + robots.txt** *(NOUVEAU)*
5. **Landing page copywriting + hero**
6. **Intégrer analytics PostHog**

### 🟠 Haute / Feature Parity Mobile
7. **Export PDF/Markdown mobile**
8. **Analytics page mobile**

### 🟠 Haute / DevOps
9. **Nettoyage Git 352 fichiers** *(NOUVEAU)*

### 🟠 Haute / Tests
10. **Tests backend 17 modules**

### 🟡 Moyenne
11. Monitoring & alerting backend
12. Nettoyer 12 branches Git stale
13. Email sequence onboarding (3 emails)
14. Schema.org JSON-LD *(NOUVEAU)*
15. CI/CD GitHub Actions *(NOUVEAU)*
16. Mise à jour extension Chrome sync API *(NOUVEAU)*

### 📈 Business / Marketing (non-technique)
17. Créer compte X/Twitter @DeepSightAI
18. Vidéo démo 2min
19. Outreach 20 YouTubers FR
20. Préparer Product Hunt launch
21. Article blog: Why I built DeepSight

---

## 🆕 NOUVELLES TÂCHES À CRÉER DANS NOTION

| Titre | Priorité | Type | Effort |
|-------|----------|------|--------|
| 🔐 Sécuriser endpoints /admin — middleware auth | 🔴 Urgente | 🐛 Bug | S (1-3h) |
| 🌐 Ajouter sitemap.xml + robots.txt | 🟠 Haute | ✨ Feature | S (1-3h) |
| 🧹 Nettoyage Git — 352 fichiers + .gitignore | 🟠 Haute | 🔧 DevOps | M (3-8h) |
| 📊 Schema.org JSON-LD pour analyses | 🟡 Moyenne | ✨ Feature | S (1-3h) |
| 🔄 CI/CD GitHub Actions | 🟡 Moyenne | 🔧 DevOps | M (3-8h) |
| 🔄 Extension Chrome sync API v3 | 🟡 Moyenne | ♻️ Refactor | M (3-8h) |
