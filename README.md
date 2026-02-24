<p align="center">
  <img src="frontend/public/logo-dark.png" alt="DeepSight Logo" width="200">
</p>

<h1 align="center">🤿 DeepSight</h1>

<p align="center">
  <strong>AI-Powered YouTube Video Analysis with Bayesian Epistemology</strong>
</p>

<p align="center">
  <a href="https://www.deepsightsynthesis.com">
    <img src="https://img.shields.io/badge/Website-deepsightsynthesis.com-blue?style=for-the-badge&logo=google-chrome" alt="Website">
  </a>
  <a href="https://deep-sight-backend-v3-production.up.railway.app/docs">
    <img src="https://img.shields.io/badge/API-Docs-green?style=for-the-badge&logo=swagger" alt="API Docs">
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi" alt="FastAPI">
  <img src="https://img.shields.io/badge/React-18.3+-61DAFB?style=flat-square&logo=react" alt="React">
  <img src="https://img.shields.io/badge/Expo-SDK_54-000020?style=flat-square&logo=expo" alt="Expo">
  <img src="https://img.shields.io/badge/TypeScript-5.6+-3178C6?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python" alt="Python">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Deployed_on-Railway-0B0D0E?style=flat-square&logo=railway" alt="Railway">
  <img src="https://img.shields.io/badge/Deployed_on-Vercel-000000?style=flat-square&logo=vercel" alt="Vercel">
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License">
</p>

---

## 📖 About

**DeepSight** is a SaaS platform that transforms how you consume YouTube content. Using advanced AI models and Bayesian epistemology principles, it provides:

- 🎯 **Intelligent Summaries** — Structured analysis with key concepts extraction
- 🔍 **Fact-Checking** — AI-powered claim verification with confidence levels
- 📚 **Study Tools** — Flashcards, quizzes, and mind maps generation
- 💬 **Contextual Chat** — Ask questions about any analyzed video
- 📊 **Epistemic Markers** — Clarity levels: SOLID, PLAUSIBLE, UNCERTAIN, TO VERIFY

---

## 🖼️ Screenshots

<p align="center">
  <img src="docs/screenshots/analysis-view.png" alt="Analysis View" width="80%">
  <br><em>Video analysis with Bayesian epistemic markers</em>
</p>

<p align="center">
  <img src="docs/screenshots/chat-interface.png" alt="Chat Interface" width="80%">
  <br><em>Contextual AI chat about analyzed content</em>
</p>

---

## 🏗️ Architecture

```
DeepSight-Main/
├── 🔧 backend/          # FastAPI API (Python 3.11)
│   ├── src/
│   │   ├── auth/        # JWT + Google OAuth
│   │   ├── videos/      # Analysis engine
│   │   ├── chat/        # Mistral AI chat
│   │   ├── billing/     # Stripe integration
│   │   └── study/       # Quiz, flashcards, mindmap
│   └── requirements.txt
│
├── 🌐 frontend/         # React + Vite (TypeScript)
│   ├── src/
│   │   ├── pages/       # Route components
│   │   ├── components/  # UI library
│   │   └── services/    # API client
│   └── package.json
│
├── 📱 mobile/           # Expo + React Native
│   ├── src/
│   │   ├── screens/     # App screens
│   │   ├── components/  # Native components
│   │   └── services/    # Shared API client
│   └── app.json
│
└── 📚 docs/             # Documentation
    ├── API.md           # API reference
    └── ARCHITECTURE.md  # System design
```

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.11+** — Backend runtime
- **Node.js 20+** — Frontend & mobile
- **PostgreSQL** — Production database (SQLite for dev)

### Backend Setup

```bash
# Clone and navigate
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys (Mistral, Stripe, etc.)

# Run development server
cd src && uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Set VITE_API_URL=http://localhost:8000

# Run development server
npm run dev
```

### Mobile Setup

```bash
cd mobile

# Install dependencies
npm install

# Start Expo development server
npx expo start

# Run on device/simulator
npm run ios      # iOS Simulator
npm run android  # Android Emulator
```

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/deepsight

# JWT Security
JWT_SECRET_KEY=your-secret-key-min-32-chars
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# AI APIs (Required)
MISTRAL_API_KEY=your-mistral-api-key

# AI APIs (Optional)
PERPLEXITY_API_KEY=your-perplexity-key  # For fact-checking

# Payments
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email
RESEND_API_KEY=re_...

# Frontend
FRONTEND_URL=https://www.deepsightsynthesis.com
```

### Frontend (`frontend/.env.local`)

```env
VITE_API_URL=https://deep-sight-backend-v3-production.up.railway.app
VITE_SENTRY_DSN=optional-sentry-dsn
```

---

## 🔬 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Backend** | FastAPI + SQLAlchemy | Async API + ORM |
| **AI** | Mistral AI + Perplexity | Analysis + Fact-check |
| **Frontend** | React 18 + Vite + Tailwind | Modern web UI |
| **Mobile** | Expo SDK 54 + React Native | Cross-platform apps |
| **State** | Zustand + TanStack Query | Client state management |
| **Auth** | JWT + Google OAuth | Secure authentication |
| **Payments** | Stripe | Subscription billing |
| **Deploy** | Railway + Vercel + EAS | Cloud infrastructure |

---

## 💰 Pricing Plans

| Plan (Display) | Internal ID | Price | Analyses/mo | Key Features |
|----------------|------------|-------|-------------|--------------|
| **Free** | free | $0 | 3 | 15min videos, 60-day history |
| **Starter** | etudiant | $2.99 | 20 | Flashcards, mind maps |
| **Student** | starter | $5.99 | 50 | 2h videos, web search AI |
| **Pro** | pro | $12.99 | 200 | Playlists, unlimited chat, PDF export |

---

## 📡 API Reference

The DeepSight API is fully documented:

- **Interactive Docs**: [/docs](https://deep-sight-backend-v3-production.up.railway.app/docs) (Swagger UI)
- **API Reference**: [docs/API.md](docs/API.md)
- **Health Check**: `GET /health`

### Quick Examples

```bash
# Analyze a video
curl -X POST "https://api.deepsightsynthesis.com/api/videos/analyze" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtube.com/watch?v=..."}'

# Ask a question about the analysis
curl -X POST "https://api.deepsightsynthesis.com/api/chat/ask" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"summary_id": 123, "question": "What are the main arguments?"}'
```

---

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest tests/ -v

# Frontend type checking
cd frontend
npm run typecheck

# Mobile type checking
cd mobile
npm run typecheck
```

---

## 🚢 Deployment

### Backend → Railway

```bash
# Railway auto-deploys from main branch
# Configuration in railway.json
```

### Frontend → Vercel

```bash
# Vercel auto-deploys from main branch
# Configuration in vercel.json
```

### Mobile → EAS Build

```bash
# Build for production
eas build --platform all --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 🔗 Links

- **Website**: [deepsightsynthesis.com](https://www.deepsightsynthesis.com)
- **API Docs**: [Swagger UI](https://deep-sight-backend-v3-production.up.railway.app/docs)
- **Backend**: [Railway Dashboard](https://railway.app)
- **Frontend**: [Vercel Dashboard](https://vercel.com)

---

<p align="center">
  Made with ❤️ by the DeepSight Team
</p>
