# 🤿 Deep Sight API v3.0

> Backend FastAPI pour l'analyse intelligente de vidéos YouTube avec IA bayésienne

## 📋 Table des matières

- [Architecture](#-architecture)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Déploiement Railway](#-déploiement-railway)
- [API Endpoints](#-api-endpoints)
- [Fonctionnalités](#-fonctionnalités)

## 🏗️ Architecture

```
src/
├── main.py                 # Point d'entrée FastAPI
├── core/
│   └── config.py           # Configuration centrale (plans, quotas, API keys)
├── db/
│   └── database.py         # SQLAlchemy async (15 tables)
├── auth/
│   ├── router.py           # Endpoints authentification
│   ├── service.py          # Logique JWT, OAuth, users
│   ├── schemas.py          # Modèles Pydantic
│   ├── dependencies.py     # get_current_user, require_plan
│   └── email.py            # Templates Resend
├── videos/
│   ├── router.py           # Endpoints analyse vidéo
│   ├── service.py          # Opérations DB summaries
│   ├── analysis.py         # Prompts Mistral bayésiens
│   ├── schemas.py          # Modèles Pydantic
│   └── export.py           # Export PDF/DOCX/MD
├── transcripts/
│   └── youtube.py          # Extraction YouTube multi-fallback
├── chat/
│   ├── router.py           # Endpoints chat IA
│   └── service.py          # Chat Mistral + Perplexity
├── billing/
│   └── router.py           # Stripe checkout & webhooks
└── admin/
    └── router.py           # Panel administration
```

## 🚀 Installation

### Prérequis

- Python 3.11+
- PostgreSQL (production) ou SQLite (dev)
- ffmpeg (pour yt-dlp)

### Installation locale

```bash
# Cloner et entrer dans le répertoire
cd deepsight-backend

# Créer un environnement virtuel
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou: venv\Scripts\activate  # Windows

# Installer les dépendances
pip install -r requirements.txt

# Copier et configurer l'environnement
cp .env.example .env
# Éditer .env avec vos clés API

# Lancer en développement
cd src
uvicorn main:app --reload --port 8000
```

## ⚙️ Configuration

### Variables d'environnement essentielles

```env
# Base de données
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db

# JWT
JWT_SECRET_KEY=your-secret-key-32-chars-minimum

# API Mistral (obligatoire)
MISTRAL_API_KEY=your-mistral-key

# Frontend
FRONTEND_URL=https://your-frontend.vercel.app
ALLOWED_ORIGINS=https://your-frontend.vercel.app

# Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure-password
```

### Plans et quotas (core/config.py)

| Plan     | Crédits/mois | Chat/jour | Playlists | Web Search |
|----------|--------------|-----------|-----------|------------|
| Free     | 10           | 10        | ❌        | ❌         |
| Starter  | 50           | 40        | ❌        | ❌         |
| Pro      | 150          | 100       | ✅ (50)   | ✅ (30)    |
| Expert   | 400          | ∞         | ✅ (100)  | ✅ (100)   |

## 🚂 Déploiement Railway

### 1. Configuration Railway

```json
// railway.json
{
  "deploy": {
    "startCommand": "cd src && uvicorn main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/health"
  }
}
```

### 2. Variables d'environnement Railway

Configurer dans Railway Dashboard :
- `DATABASE_URL` (fourni automatiquement avec PostgreSQL)
- `JWT_SECRET_KEY`
- `MISTRAL_API_KEY`
- `FRONTEND_URL`
- Autres clés API selon besoins

### 3. PostgreSQL

Ajouter le service PostgreSQL dans Railway. La `DATABASE_URL` est automatiquement injectée.

## 📡 API Endpoints

### 🔐 Authentication (`/api/auth`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/register` | Inscription |
| POST | `/login` | Connexion → JWT |
| POST | `/refresh` | Rafraîchir token |
| POST | `/verify-email` | Vérifier code |
| POST | `/forgot-password` | Initier reset |
| POST | `/reset-password` | Reset avec code |
| GET | `/me` | Profil utilisateur |
| GET | `/quota` | Quotas détaillés |
| GET | `/google/login` | URL OAuth Google |
| GET | `/google/callback` | Callback Google |

### 📹 Videos (`/api/videos`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/analyze` | Lancer analyse → task_id |
| GET | `/status/{task_id}` | Polling status |
| GET | `/history` | Historique paginé |
| GET | `/summary/{id}` | Détails résumé |
| PUT | `/summary/{id}` | Update (favoris, notes) |
| DELETE | `/summary/{id}` | Supprimer |
| GET | `/summary/{id}/export` | Export MD/PDF/DOCX |
| GET | `/info?url=` | Info vidéo sans analyse |
| GET | `/categories` | Liste catégories |
| GET | `/stats` | Statistiques user |
| POST | `/playlist/analyze` | Analyse playlist (Pro) |
| GET | `/playlists` | Liste playlists |

### 💬 Chat (`/api/chat`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/ask` | Question → réponse |
| POST | `/ask/stream` | Question → SSE stream |
| GET | `/history/{summary_id}` | Historique chat |
| DELETE | `/history/{summary_id}` | Effacer chat |
| GET | `/quota` | Quotas chat |

### 💳 Billing (`/api/billing`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/plans` | Liste des plans |
| GET | `/info` | Info facturation |
| POST | `/checkout` | Créer session Stripe |
| GET | `/portal` | Portail client Stripe |
| GET | `/transactions` | Historique transactions |
| POST | `/webhook` | Webhook Stripe |

### 👑 Admin (`/api/admin`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/stats` | Dashboard stats |
| GET | `/users` | Liste users paginée |
| GET | `/users/{id}` | Détails user |
| PUT | `/users/{id}` | Update user |
| POST | `/users/{id}/credits` | Ajouter crédits |
| DELETE | `/users/{id}` | Supprimer user |
| GET | `/logs` | Logs admin |

## ✨ Fonctionnalités

### Analyse vidéo avec IA bayésienne

- **3 modes d'analyse** : accessible, standard, expert
- **Prompts épistémiques** avec marqueurs (✅ SOLIDE, ⚖️ PLAUSIBLE, ❓ INCERTAIN, ⚠️ À VÉRIFIER)
- **Timecodes obligatoires** dans les résumés
- **Détection automatique** de catégorie (11 catégories)
- **Extraction d'entités** (concepts, personnes, organisations)
- **Score de fiabilité** 0-100

### Extraction YouTube multi-fallback

1. `youtube-transcript-api` (rapide)
2. `yt-dlp` (fiable)
3. `Supadata API` (backup payant)

### Chat IA contextuel

- Questions sur le contenu vidéo
- Historique de conversation
- Recherche web avec Perplexity (Pro+)
- Streaming SSE

### Système de crédits

- Quotas par plan
- Transactions enregistrées
- Renouvellement mensuel automatique (Stripe)

## 🔧 Développement

### Tests locaux

```bash
# Healthcheck
curl http://localhost:8000/health

# Documentation Swagger
open http://localhost:8000/docs
```

### Structure de réponse standard

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed"
}
```

### Erreurs

```json
{
  "detail": "Error message",
  "error": "error_code"
}
```

## 📄 Licence

Propriétaire - Deep Sight © 2024
