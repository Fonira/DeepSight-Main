---
allowed-tools: Read, Grep, Glob
description: Tech stack et bibliothèques autorisées par plateforme DeepSight
---

# Tech Stack DeepSight

Vérifier la lib / proposer une alternative pour : $ARGUMENTS

## Frontend Web : Next.js 14+ (App Router), TypeScript strict, Tailwind, shadcn/ui, Lucide React, Zustand, React Hook Form + Zod, Framer Motion, Recharts, @stripe/stripe-js, sonner
Interdit : fs, path, child_process, toute lib Node-only.

## Mobile : Expo SDK (dernière stable), TypeScript strict, React Navigation, StyleSheet.create(), expo-secure-store, @react-native-async-storage, @expo/vector-icons, react-native-reanimated, expo-notifications
Composants : ✅ View/Text/ScrollView/TouchableOpacity/FlatList/Image/TextInput ❌ JAMAIS div/span/p/button/input

## Backend : FastAPI, Uvicorn, SQLAlchemy 2.0+ (async) + Alembic, PostgreSQL, Redis, python-jose (JWT), Pydantic v2, Mistral AI SDK, Perplexity + Brave Search, Resend, stripe, Pytest + pytest-asyncio, Celery/ARQ
Convention : snake_case, type hints, docstrings, async def.

## Extension Chrome : MV3, TypeScript/JS, Webpack/Vite, chrome.runtime/tabs/storage
Règle : transcripts extraits côté BACKEND.

## Règle d'or : avant npm/pip install → vérifier dans ce référentiel → si absent, proposer avec justification → installer dans le BON dossier