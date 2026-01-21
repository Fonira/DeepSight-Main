# DeepSight - Monorepo

Application d'analyse de videos YouTube avec IA.

## Structure

```
DeepSight-Main/
├── backend/     # API FastAPI (Railway)
├── frontend/    # App React/Vite (Vercel)
├── mobile/      # App React Native/Expo
└── docs/        # Documentation
```

## Demarrage rapide

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn src.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Mobile
```bash
cd mobile
npm install
npx expo start
```

## Deploiement

- **Backend**: Railway (Root Directory: `/backend`)
- **Frontend**: Vercel (Root Directory: `/frontend`)
- **Mobile**: EAS Build (Root Directory: `/mobile`)

## API Endpoints

- Production: `https://deep-sight-backend-v3-production.up.railway.app`
- Health check: `GET /health`
