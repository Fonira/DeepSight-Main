# Migration Plans V2 — février 2026

## 1. Script SQL (exécuter sur PostgreSQL Railway)

```sql
UPDATE users SET plan = 'equipe' WHERE plan IN ('expert', 'team');
UPDATE users SET plan = 'etudiant' WHERE plan = 'student';
UPDATE users SET plan = 'free' WHERE plan NOT IN ('free', 'etudiant', 'starter', 'pro', 'equipe');
SELECT plan, COUNT(*) as nb FROM users GROUP BY plan ORDER BY nb DESC;
```

## 2. Variables d'environnement à ajouter dans Railway

### Stripe Price IDs (Dashboard Stripe → Produits → clic sur chaque produit → copier le Price ID)

```env
STRIPE_PRICE_ETUDIANT_TEST=price_xxx
STRIPE_PRICE_ETUDIANT_LIVE=price_xxx
STRIPE_PRICE_STARTER_TEST=price_xxx
STRIPE_PRICE_STARTER_LIVE=price_xxx
STRIPE_PRICE_PRO_TEST=price_xxx
STRIPE_PRICE_PRO_LIVE=price_xxx
STRIPE_PRICE_EQUIPE_TEST=price_xxx
STRIPE_PRICE_EQUIPE_LIVE=price_xxx
```

### Variable de mode test/live

```env
STRIPE_TEST_MODE=true   # mettre false au lancement
```

## 3. Tests post-déploiement

1. `GET /api/billing/plans` → 5 plans, bons prix, bons noms
2. `GET /api/billing/plans?platform=mobile` → features filtrées
3. `GET /api/billing/my-plan` → plan actuel + usage
4. `POST /api/billing/create-checkout {plan: 'starter'}` → URL Stripe valide
5. Carte test `4242 4242 4242 4242` → webhook reçu → plan mis à jour en DB
6. Tenter `POST /api/chat/ask` sans plan pro → `403 feature_locked`
7. Stripe Customer Portal → annulation → plan retombe à `free`

## 4. Correspondance Stripe ↔ Backend

| Produit Stripe | Price ID (test) | PlanId backend |
|---|---|---|
| Deep Sight Etudiant 2.99€ | price_xxx | etudiant |
| Deep Sight Starter 5.99€ | price_xxx | starter |
| Deep Sight Pro 12.99€ | price_xxx | pro |
| Deep Sight Equipe 29.99€ | price_xxx | equipe |
