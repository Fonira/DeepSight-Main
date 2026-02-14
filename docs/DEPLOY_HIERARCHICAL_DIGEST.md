# Déploiement — Hierarchical Digest Pipeline

> Date: 14 Février 2026
> Auteur: Claude (Senior Tech Lead)

## Fichiers modifiés

### Backend (6 fichiers)
| Fichier | Action | Description |
|---------|--------|-------------|
| `backend/src/db/database.py` | Modifié | `VideoChunk` model + `full_digest` sur Summary |
| `backend/src/videos/chunking.py` | **NOUVEAU** | Pipeline chunking complet (586L) |
| `backend/src/videos/service.py` | Modifié | Background task après chaque analyse |
| `backend/src/playlists/router.py` | Modifié | Méta-analyse enrichie + chat hiérarchique |
| `backend/alembic/versions/002_add_video_chunks.py` | **NOUVEAU** | Migration Alembic |
| `backend/migrations/add_video_chunks.sql` | **NOUVEAU** | Script SQL backup |

### Mobile (5 fichiers)
| Fichier | Action | Description |
|---------|--------|-------------|
| `mobile/src/navigation/AppNavigator.tsx` | Modifié | Routes playlist commentées |
| `mobile/src/screens/index.ts` | Modifié | Exports playlist commentés |
| `mobile/src/components/navigation/CustomTabBar.tsx` | Modifié | Onglet playlist retiré |
| `mobile/src/hooks/useNotifications.ts` | Modifié | Nav playlist commentée |
| `mobile/src/services/notifications.ts` | Modifié | `notifyPlaylistComplete()` désactivée |

---

## Étapes de déploiement

### 1. Migration Base de Données (Railway PostgreSQL)

**Option A — Alembic (recommandé si configuré):**
```bash
cd backend
alembic upgrade head
```

**Option B — SQL manuel (Railway console ou psql):**
```sql
-- Copier-coller le contenu de backend/migrations/add_video_chunks.sql
ALTER TABLE summaries ADD COLUMN IF NOT EXISTS full_digest TEXT;

CREATE TABLE IF NOT EXISTS video_chunks (
    id SERIAL PRIMARY KEY,
    summary_id INTEGER NOT NULL REFERENCES summaries(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    start_seconds INTEGER NOT NULL DEFAULT 0,
    end_seconds INTEGER NOT NULL DEFAULT 0,
    chunk_text TEXT NOT NULL,
    chunk_digest TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_video_chunks_summary_id ON video_chunks(summary_id);
CREATE INDEX IF NOT EXISTS ix_video_chunks_summary_chunk ON video_chunks(summary_id, chunk_index);
```

### 2. Déploiement Backend (Railway)
```bash
git add backend/src/db/database.py backend/src/videos/chunking.py backend/src/videos/service.py backend/src/playlists/router.py backend/alembic/versions/002_add_video_chunks.py backend/migrations/add_video_chunks.sql
git commit -m "feat(backend): hierarchical digest pipeline - full transcript processing for playlists"
git push origin main
```
Railway redéploie automatiquement.

### 3. Déploiement Mobile (EAS)
```bash
cd mobile
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

---

## Vérification post-déploiement

### Test 1 — Analyse vidéo individuelle
1. Analyser une vidéo longue (>30 min)
2. Vérifier dans les logs Railway: `"Starting chunking pipeline"`
3. Vérifier en DB: `SELECT * FROM video_chunks WHERE summary_id = <id>;`
4. Vérifier: `SELECT full_digest FROM summaries WHERE id = <id>;`

### Test 2 — Playlist
1. Analyser une playlist de 3+ vidéos
2. Vérifier que la méta-analyse est plus détaillée
3. Tester le chat corpus: poser une question spécifique sur le contenu d'une vidéo
4. Vérifier les logs: `"Building hierarchical context"`, tailles de contexte

### Test 3 — Mobile
1. Vérifier que l'app mobile n'a plus d'onglet "Playlists"
2. Vérifier que l'analyse vidéo fonctionne normalement
3. Vérifier que le chat IA fonctionne normalement

---

## Rollback

Si problème, les changements sont rétrocompatibles :
- `full_digest` est nullable → les anciennes analyses fonctionnent sans
- Le chat fallback sur `summary_content` si `full_digest` absent
- Le chunking background ne bloque jamais l'analyse principale
- La migration SQL est réversible: `DROP TABLE video_chunks; ALTER TABLE summaries DROP COLUMN full_digest;`
