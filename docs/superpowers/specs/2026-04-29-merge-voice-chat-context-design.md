# Merge contexte Voice ↔ Chat — Design

**Date** : 2026-04-29
**Auteur** : Maxime Le Parc (DeepSight)
**Statut** : Draft — en attente de revue
**Source** : Brainstorm session 2026-04-29 (Opus 4.7)
**Spec apparentée** : [`2026-04-26-quick-voice-call-design.md`](./2026-04-26-quick-voice-call-design.md) (décision ouverte #2 résolue ici)

## Contexte et problème

DeepSight a deux interfaces conversationnelles par vidéo :

- **Chat IA texte** (`/chat?summary={id}` web, `ChatDrawer` extension, study tab mobile) — Mistral + Perplexity v4.0
- **Voice call** (overlay `/history` web, side panel extension PR #128, `(tabs)/study` mobile PR #127) — ElevenLabs Conversational AI

L'infrastructure de timeline unifiée existe déjà (migration 007, `ChatMessage.source ∈ {text, voice}`, `voice_session_id`, `voice_speaker`, `time_in_call_secs`). Le voice agent persiste bien ses transcripts dans `chat_messages` et le chat texte est injecté dans son `system_prompt` au démarrage.

**Mais trois trous fonctionnels persistent** :

1. **Voice agent rappelé sur la même vidéo ne se souvient pas des appels voice précédents.** Cause directe : `voice/router.py:576` drop volontairement _toutes_ les voice rows de l'injection (`[m for m in trimmed if m.get("source") != "voice"]`), y compris celles des sessions terminées. Le commentaire justifie le drop pour éviter la duplication avec la session active, mais le filtre n'exclut pas `exclude_voice_session_id` — il exclut tout.
2. **Chat IA Mistral voit les voice rows mais sans étiquette source/temporelle, et limité à 6 messages** (`chat/service.py:551 — for msg in chat_history[-6:]`). Mistral ne sait pas qu'un message vient d'un appel voice ni quand il a été dit, et perd toute trace au-delà de 6 messages.
3. **Pas de résumé condensé pour les sessions anciennes**, donc dès que l'historique grossit on perd soit du contexte (cap 6 messages) soit on dépasse les limites tokens (ElevenLabs `system_prompt` ≈ 12 KB en pratique).

Le but : un **contexte partagé bidirectionnel par vidéo**, persistant entre sessions, avec un format unifié réutilisable par chat et voice.

## Objectifs

1. **Symbiose chat ↔ voice** : l'agent voice et l'agent chat partagent la même mémoire conversationnelle par vidéo. Tout ce qui est dit (texte ou voix) est récupérable par les deux.
2. **Reprise sur même vidéo** : un nouvel appel voice réinjecte les digests des sessions précédentes + les 30 derniers échanges verbatim.
3. **Tri-plateforme cohérent** : web, extension Chrome, mobile Expo doivent tous bénéficier du même backend amélioré sans changement structurel frontend.
4. **Économie tokens et coûts** : cap dur 12 KB pour `system_prompt` voice, digest pré-calculé en DB pour amortir le coût Mistral.

## Décisions verrouillées

| #   | Décision                   | Choix retenu                                                                                                     |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | Scope merge                | **Contexte partagé bidirectionnel** (UIs séparées chat / voice restent telles quelles)                           |
| 2   | Surfaces                   | **Tri-plateforme** : web + extension Chrome + mobile Expo                                                        |
| 3   | Stratégie réinjection      | **Verbatim récent + résumé ancien** : 30 derniers messages verbatim + 2-3 bullets par session pour les anciennes |
| 4   | Comportement clear         | **Clear texte ET voice ensemble** (RGPD-friendly, un seul bouton corbeille par vidéo)                            |
| 5   | Approche technique         | **Approche A — digest pré-calculé en DB** (latence rappel quasi nulle, coût Mistral one-shot par session)        |
| 6   | Étiquetage messages        | Format `[VOCAL • il y a 2j • user]` / `[TEXTE • il y a 1h • toi]` (source + temporel relatif + speaker)          |
| 7   | Modèle pour digest         | `mistral-small-2603` (rapide, ≈0.0001€/digest, suffit pour 2-3 bullets)                                          |
| 8   | Cap tokens                 | `target='voice'` → 12 KB hard cap · `target='chat'` → 30 KB soft cap                                             |
| 9   | Bucket chat texte          | 1 digest par 20 messages texte d'une vidéo (tranche)                                                             |
| 10  | Sous-agents implémentation | **Opus 4.7 obligatoire** (`claude-opus-4-7[1m]`) — règle de mémoire perma                                        |

## Architecture macro

```
┌─────────────────────────────────────────────────────────────┐
│  voice/router.py        chat/router.py     (consumers)      │
│         │                      │                            │
│         ▼                      ▼                            │
│  ┌──────────────────────────────────────────────┐           │
│  │   context_builder.build_unified_context_block│  NEW      │
│  │   (summary_id, user_id, lang, target,        │           │
│  │    exclude_voice_session_id?)                │           │
│  │                                              │           │
│  │   1. SELECT digests anciens                  │           │
│  │      (voice_sessions.digest_text             │           │
│  │       + chat_text_digests)                   │           │
│  │   2. SELECT 30 derniers chat_messages        │           │
│  │      (toutes sources mélangées, ASC)         │           │
│  │   3. Format unifié [SOURCE • Δt • speaker]   │           │
│  │   4. Cap selon target                        │           │
│  └──────────────────────────────────────────────┘           │
│                              ▲                              │
│  ┌──────────────────────────────────────────────┐           │
│  │   context_digest_service                     │  NEW      │
│  │                                              │           │
│  │   on_voice_session_end(session_id) →         │           │
│  │      Mistral-small → voice_sessions.digest   │           │
│  │                                              │           │
│  │   maybe_chat_text_bucket(summary_id, uid) →  │           │
│  │      every 20 text msgs → chat_text_digests  │           │
│  └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

**Principe** : un seul service `context_builder` consommé par chat ET voice. Un seul service `context_digest_service` qui produit les résumés à la fin de session voice ou par bucket de 20 chat texte. Frontend = zéro changement structurel.

## Spec #1 — Backend

### a. Migration Alembic 010

`backend/alembic/versions/010_add_conversation_digests.py`

```python
"""add_conversation_digests

Revision ID: 010_add_conversation_digests
Revises: 009_add_user_preferences_json
Create Date: 2026-04-29
"""
import sqlalchemy as sa
from alembic import op

revision = "010_add_conversation_digests"
down_revision = "009_add_user_preferences_json"
branch_labels = None
depends_on = None


def upgrade():
    # Digest par session voice (1 row par voice_session)
    op.add_column("voice_sessions",
        sa.Column("digest_text", sa.Text, nullable=True))
    op.add_column("voice_sessions",
        sa.Column("digest_generated_at", sa.DateTime(timezone=True), nullable=True))

    # Digest par bucket chat texte (1 row par tranche de 20 msgs texte d'une vidéo)
    op.create_table("chat_text_digests",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("summary_id", sa.Integer,
                  sa.ForeignKey("summaries.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer,
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("first_message_id", sa.Integer,
                  sa.ForeignKey("chat_messages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("last_message_id", sa.Integer,
                  sa.ForeignKey("chat_messages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("digest_text", sa.Text, nullable=False),
        sa.Column("msg_count", sa.Integer, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_chat_text_digests_summary_user",
        "chat_text_digests", ["summary_id", "user_id"]
    )


def downgrade():
    op.drop_index("ix_chat_text_digests_summary_user", "chat_text_digests")
    op.drop_table("chat_text_digests")
    op.drop_column("voice_sessions", "digest_generated_at")
    op.drop_column("voice_sessions", "digest_text")
```

**Justification 2 tables** : voice = naturellement borné (1 session = 1 digest, calculé en fin de session). Chat texte = continu, pas de signal de fin → on bucketise par tranches de 20 messages pour ne pas relancer Mistral à chaque message.

### b. Service `context_builder`

`backend/src/voice/context_builder.py` (NEW — placé sous `voice/` car partagé mais le voice est l'initiateur de la spec)

```python
"""Unified context block builder for voice + chat agents.

Consolidates voice session digests + chat text digests + recent verbatim
messages into a single block injectable into either an ElevenLabs voice
agent system_prompt or a Mistral chat conversation history.

Replaces:
  - voice/router.py:_build_chat_history_block_for_voice (Spec #1, Task 6)
  - chat/service.py:build_chat_prompt history_text logic (line 549-553)
"""

from typing import Literal, Optional
from datetime import datetime, timezone
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import ChatMessage, VoiceSession, ChatTextDigest

VOICE_SYSTEM_PROMPT_CAP_BYTES = 12_000   # ElevenLabs hard limit safe margin
CHAT_HISTORY_CAP_BYTES = 30_000          # Mistral-large 262K, room to spare
RECENT_VERBATIM_LIMIT = 30
PER_MESSAGE_MAX_CHARS = 600


async def build_unified_context_block(
    db: AsyncSession,
    *,
    summary_id: int,
    user_id: int,
    lang: str = "fr",
    target: Literal["voice", "chat"],
    exclude_voice_session_id: Optional[str] = None,
) -> str:
    """Build the unified context block for a chat or voice agent.

    Args:
        summary_id: video summary id (per-video memory boundary)
        user_id: owner of the conversation
        lang: 'fr' or 'en' for header strings
        target: 'voice' applies the 12 KB cap; 'chat' the 30 KB cap
        exclude_voice_session_id: when called from a *new* voice session,
            pass its own id so its already-active rows are not re-injected

    Returns "" when nothing to inject.
    """
    cap = (
        VOICE_SYSTEM_PROMPT_CAP_BYTES if target == "voice"
        else CHAT_HISTORY_CAP_BYTES
    )

    # 1. Fetch voice digests (sessions previously ended on this video)
    voice_digests_q = (
        select(VoiceSession.id, VoiceSession.created_at,
               VoiceSession.duration_seconds, VoiceSession.digest_text)
        .where(
            VoiceSession.summary_id == summary_id,
            VoiceSession.user_id == user_id,
            VoiceSession.digest_text.isnot(None),
        )
        .order_by(VoiceSession.created_at.asc())
    )
    if exclude_voice_session_id:
        voice_digests_q = voice_digests_q.where(
            VoiceSession.id != exclude_voice_session_id
        )
    voice_digests = (await db.execute(voice_digests_q)).all()

    # 2. Fetch chat text digests (buckets of 20 text messages)
    chat_digests = (await db.execute(
        select(ChatTextDigest)
        .where(
            ChatTextDigest.summary_id == summary_id,
            ChatTextDigest.user_id == user_id,
        )
        .order_by(ChatTextDigest.created_at.asc())
    )).scalars().all()

    # 3. Fetch last 30 chat_messages (all sources mixed, ASC for chronology)
    recent_q = (
        select(ChatMessage)
        .where(
            ChatMessage.summary_id == summary_id,
            ChatMessage.user_id == user_id,
        )
        .order_by(ChatMessage.created_at.desc())
        .limit(RECENT_VERBATIM_LIMIT)
    )
    recent = list(reversed((await db.execute(recent_q)).scalars().all()))

    # 4. Render
    block = _render_block(
        lang=lang,
        voice_digests=voice_digests,
        chat_digests=chat_digests,
        recent=recent,
        exclude_voice_session_id=exclude_voice_session_id,
    )

    # 5. Cap enforcement (truncate from the oldest digests first)
    if len(block.encode("utf-8")) > cap:
        block = _truncate_to_cap(block, cap, lang=lang)

    return block


def _render_block(
    *, lang: str, voice_digests, chat_digests, recent, exclude_voice_session_id
) -> str:
    """Render the unified block. See spec example for output shape.

    Logic:
      1. If no digests AND no recent → return ""
      2. Build header (FR or EN)
      3. If digests exist: render "### Résumé sessions antérieures" section
         - Merge voice_digests + chat_digests in chronological order by created_at
         - For voice digest: prefix with "{date} (voice {duration}s):"
         - For chat digest:  prefix with "{date} (chat texte {msg_count} msgs):"
         - Body = the digest_text bullets verbatim
      4. If recent exists: render "### Derniers échanges (N)" section
         - Skip rows where voice_session_id == exclude_voice_session_id
         - For each row, format: [SOURCE • Δt • SPEAKER] CONTENT
           - SOURCE = "VOCAL" if source='voice' else "TEXTE"
           - Δt = relative humanized ("il y a 2j", "il y a 1h", "à l'instant")
           - SPEAKER = "user" if role='user' else "toi" (FR) / "you" (EN)
           - CONTENT truncated at PER_MESSAGE_MAX_CHARS, ellipsis if cut
      5. Footer: "Continue dans la lignée de cette conversation." (FR)
                 / "Continue this conversation in the same vein." (EN)
    """


def _truncate_to_cap(block: str, cap: int, *, lang: str) -> str:
    """Truncate block to fit within cap bytes, preserving the most recent
    verbatim section. Drops oldest digest bullets first, then oldest verbatim
    rows, until under cap. Adds a footer note '[contexte tronqué]'."""
```

**Format de sortie attendu** (FR, target='voice', exemple) :

```
## Contexte conversation précédente

### Résumé sessions antérieures
- 2026-04-25 (voice 8 min) : utilisateur a demandé si JPP est censuré, tu as répondu via web_search
- 2026-04-26 (chat texte) : focus sur modèle Janus + bigravité

### Derniers échanges (30)
[VOCAL • il y a 2j • user] Pourquoi il dit que les Russes vont sur Mars ?
[VOCAL • il y a 2j • toi]  Selon ce que j'écoute, JPP affirme que…
[TEXTE • il y a 1h • user] Résume-moi en 1 phrase
[TEXTE • il y a 1h • toi]  JPP est disruptif car…

Continue dans la lignée de cette conversation.
```

### c. Service `context_digest_service`

`backend/src/voice/context_digest.py` (NEW)

```python
"""Generates conversation digests for voice sessions and chat text buckets.

Triggered:
  - voice/router.py on voice session end (heartbeat timeout 30s OR explicit
    hangup) → generate_voice_session_digest as background asyncio task
  - chat/service.py:save_chat_message after commit → maybe_generate_chat_text_digest
"""

from sqlalchemy.ext.asyncio import AsyncSession
from core.llm_provider import get_mistral_client

DIGEST_MODEL = "mistral-small-2603"
DIGEST_MAX_OUTPUT_CHARS = 800
CHAT_TEXT_BUCKET_SIZE = 20


async def generate_voice_session_digest(
    db: AsyncSession, voice_session_id: str
) -> None:
    """Generate and persist a 2-3 bullet digest of a voice session.

    Idempotent : skip if digest_generated_at IS NOT NULL.
    Idempotency guard via row-level UPDATE … WHERE digest_generated_at IS NULL.
    Failure is non-fatal, logged via Sentry.
    """


async def maybe_generate_chat_text_digest(
    db: AsyncSession, summary_id: int, user_id: int
) -> None:
    """If there are 20+ ungested text messages on this summary for this user,
    fetch the next bucket of 20, generate a 2-3 bullet digest, write a row
    to chat_text_digests with first_message_id / last_message_id pointers.

    'Ungested' = chat_messages where source='text' and id > MAX(last_message_id)
    of any existing digest for (summary_id, user_id).
    """
```

**Prompt système digest (FR)** :

```
Tu es un digest writer concis. On te donne un échange (voice ou texte) entre
un utilisateur et l'assistant DeepSight à propos d'une vidéo YouTube. Produis
2 à 3 puces très courtes (max 80 caractères chacune) résumant : (1) ce que
l'utilisateur a demandé, (2) ce que tu as répondu / les conclusions clés.

Format strict :
- [puce 1]
- [puce 2]
- [puce 3 si nécessaire]

Aucune introduction, aucun commentaire, aucune phrase complète. Pas de markdown
autre que les puces.
```

### d. Branchement consumers

**`backend/src/voice/router.py`** — au démarrage de chaque session voice (`POST /voice/session`) :

```python
# AVANT (à remplacer)
chat_history = await get_chat_history(db, summary_id, user.id)
history_block = _build_chat_history_block_for_voice(chat_history, lang=lang)
system_prompt += "\n\n" + history_block

# APRÈS
from voice.context_builder import build_unified_context_block
history_block = await build_unified_context_block(
    db,
    summary_id=summary_id,
    user_id=user.id,
    lang=lang,
    target="voice",
    exclude_voice_session_id=new_session_id,  # session qu'on vient de créer
)
system_prompt += "\n\n" + history_block
```

Et au heartbeat timeout / explicit hangup → enqueue `generate_voice_session_digest(session_id)` via FastAPI `BackgroundTasks` (préféré pour les chemins synchronisés à une requête HTTP) ou `asyncio.create_task` détaché (pour les triggers internes type heartbeat watcher). Les deux mécanismes utilisent une nouvelle session DB indépendante (pas la session liée à la requête appelante) pour éviter les fuites de transaction. Voir `backend/src/voice/streaming_orchestrator.py` pour le pattern existant à dupliquer.

**`backend/src/chat/service.py`** — dans `build_chat_prompt` :

```python
# AVANT (à remplacer)
history_text = ""
if chat_history:
    for msg in chat_history[-6:]:
        role = "Utilisateur" if msg["role"] == "user" else "Assistant"
        history_text += f"\n{role}: {msg['content']}"

# APRÈS
from voice.context_builder import build_unified_context_block
history_text = await build_unified_context_block(
    db,
    summary_id=summary_id,
    user_id=user_id,
    lang=lang,
    target="chat",
    exclude_voice_session_id=None,  # chat texte n'a pas de session active
)
```

Et dans `chat/service.py:save_chat_message` après commit → enqueue `maybe_generate_chat_text_digest(summary_id, user_id)` via FastAPI `BackgroundTasks` (passé en dépendance dans le route handler `chat/router.py:ask` et `chat/router.py:ask_stream`, puis transmis à `save_chat_message`).

### e. Endpoint clear unifié

`backend/src/chat/router.py` — étendre `DELETE /api/chat/history/{summary_id}` avec query param `include_voice` (default `true`) :

```python
@router.delete("/history/{summary_id}")
async def clear_chat_history_endpoint(
    summary_id: int,
    include_voice: bool = Query(default=True),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Efface l'historique conversationnel d'une vidéo.

    Default include_voice=True : efface chat texte + voice transcripts +
    voice_sessions digests + chat_text_digests pour cette (summary_id, user_id).
    """
    deleted = await clear_chat_history_unified(
        db, summary_id, user.id, include_voice=include_voice
    )
    return {"deleted": deleted}
```

`chat/service.py:clear_chat_history_unified` (NEW) — efface en cascade :

1. `chat_messages` où `summary_id=… AND user_id=…` (toutes sources si `include_voice=True`, sinon seulement `source='text'`)
2. `chat_text_digests` où `summary_id=… AND user_id=…`
3. `voice_sessions` digest fields reset (`digest_text=NULL`, `digest_generated_at=NULL`) — la row session elle-même reste pour audit billing
4. Note : si `include_voice=False`, on ne touche que les `source='text'` rows et `chat_text_digests`

## Spec #2 — Frontend (web + extension + mobile)

**Zéro changement structurel.** Le bloc unifié est produit côté backend, transparent pour les API consumers.

**Seul ajustement UI** : bouton "Effacer chat" (icône corbeille) sur les 3 surfaces doit :

1. Passer le query param `?include_voice=true` (default)
2. Afficher une confirm modale FR/EN :
   - FR : « Effacer cette conversation ? Cela efface le chat texte ET les transcripts d'appels vocaux pour cette vidéo. Action irréversible. »
   - EN : « Clear this conversation? This deletes both text chat and voice call transcripts for this video. Irreversible. »

**Web** : `frontend/src/services/api.ts` — `clearChatHistory(summaryId)` ajoute `?include_voice=true`. `frontend/src/components/chat/ChatHeader.tsx` — modale de confirm.

**Extension** : `extension/src/popup/components/ChatDrawer.tsx` — idem.

**Mobile** : `mobile/src/services/api.ts` + `mobile/src/components/chat/ChatHeader.tsx` — idem.

## Spec #3 — Migration data (one-shot)

Script Python `scripts/backfill_voice_session_digests.py` à exécuter une fois après deploy :

```python
# Pour chaque voice_session existante (digest_text IS NULL) ayant des
# chat_messages associés (source='voice', voice_session_id=…),
# génère le digest via Mistral-small et persiste.
# Batch par 50 sessions, sleep 1s entre batches pour rate-limit.
```

Idem pour les chat texte existants : `scripts/backfill_chat_text_digests.py` itère par `(summary_id, user_id)` et bucketise en tranches de 20.

Ces scripts sont **optionnels** : si non exécutés, le `context_builder` fonctionnera quand même (il y aura simplement moins de digests anciens à injecter, mais le verbatim récent suffit pour la plupart des cas). À programmer en task background une fois post-deploy stable.

## Tests

### Backend pytest (~12 nouveaux tests)

**`tests/voice/test_context_builder.py`** :

- ordre chronologique digests + verbatim
- `exclude_voice_session_id` filtre bien la session active
- format `[VOCAL • il y a Xj • user]` / `[TEXTE • il y a Xh • toi]` correct FR + EN
- cap dur 12 KB respecté pour `target='voice'` (truncation depuis les digests les plus anciens)
- cap doux 30 KB pour `target='chat'`
- `lang='en'` produit headers anglais
- empty case : aucune digest, aucun message → retourne `""`

**`tests/voice/test_context_digest.py`** :

- digest généré 1× et 1× seulement (idempotence via guard `digest_generated_at IS NULL`)
- bucket de 20 chat texte : 19 messages → pas de digest, 20e message → digest créé
- fallback gracieux si Mistral fail (retry 1×, log Sentry, ne lève pas)
- format de sortie : 2-3 puces, max 80 chars chacune

**`tests/voice/test_router_recall.py`** :

- nouvelle session voice sur `summary_id` avec 2 voice sessions précédentes terminées + digests → bloc inclut les 2 digests + verbatim
- `exclude_voice_session_id` exclut bien la session courante

**`tests/chat/test_router_with_voice_history.py`** :

- message chat sur vidéo avec voice rows en historique → bloc inclut digests voice + verbatim mixte
- format étiquetté correctement

**`tests/chat/test_clear_unified.py`** :

- `DELETE /api/chat/history/{id}?include_voice=true` cascade sur chat_messages + voice digests + chat_text_digests
- `?include_voice=false` ne touche que `source='text'` + chat_text_digests

### E2E Playwright (web)

Fichier : `frontend/e2e/voice-chat-symbiosis.spec.ts`

1. **« Voice → Chat »** : user analyse vidéo → fait voice call 2 min sur question X → ferme call → ouvre chat IA → tape question Y qui réfère à X → réponse Mistral mentionne ce qui a été dit en voice
2. **« Voice → Voice rappel »** : user fait voice call 1 sur question X → ferme → 5 min plus tard fait voice call 2 sur même vidéo → l'agent référence ce qui a été dit dans call 1
3. **« Clear unifié »** : user a chat texte + voice transcripts → click corbeille → confirm modale → tout disparaît (texte + voice timeline + digests)

## Phasage

```
Phase 1 — Backend (~3-4 j, séquentiel par dépendances)
  1.1  Migration 010 + ChatTextDigest model dans db/database.py
  1.2  context_builder.py + tests unit
  1.3  context_digest.py + tests unit
  1.4  Branchement voice/router.py (remplace _build_chat_history_block_for_voice)
  1.5  Branchement chat/service.py (remplace [-6:] limit)
  1.6  Endpoint DELETE /api/chat/history/{id}?include_voice=true
  1.7  Hook end-of-session voice (background asyncio task)
  1.8  Hook chat texte bucket (background asyncio task)

Phase 2 — Frontend tri-plateforme (~1-2 j, parallélisable 3 sous-agents)
  2.1  Web : api.ts param include_voice + ChatHeader confirm modale
  2.2  Extension : api + ChatDrawer confirm modale
  2.3  Mobile : api + ChatHeader confirm modale

Phase 3 — E2E + déploiement (~1 j)
  3.1  E2E Playwright voice-chat-symbiosis.spec.ts
  3.2  Deploy Hetzner (push → SSH → docker rebuild) + migration auto via
       entrypoint.sh RUN_MIGRATIONS=true (cf. PR #189)
  3.3  Smoke test prod : 1 voice call + 1 message chat sur vidéo de test

Phase 4 — Backfill optionnel (~asynchrone, 1 j en background)
  4.1  scripts/backfill_voice_session_digests.py
  4.2  scripts/backfill_chat_text_digests.py
```

## Risques et mitigations

| Risque                                                  | Mitigation                                                                                                                                               |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Digest Mistral-small produit du bruit ou hallucinations | Prompt système strict (format puces, max 80 chars), cap output 800 chars, tests sur 20 conversations gold avant prod                                     |
| Bucket de 20 perd l'info récente du chat texte          | Le builder mixe digests anciens + 30 derniers messages verbatim → recouvrement assuré (les 20 derniers texte sont dans le verbatim, pas encore digérés)  |
| Coût Mistral-small explose                              | Mistral-small ≈ 0.0001€/digest × est. 5k sessions/mois = 0.50€/mois. Acceptable. Alerte Sentry si dépassement budget mensuel                             |
| Limite ElevenLabs `system_prompt` dépassée              | Cap dur 12 KB côté `_truncate_to_cap` ; tests qui valident size byte-exact                                                                               |
| Race condition end-of-session digest généré 2×          | UPDATE … WHERE `digest_generated_at IS NULL` (atomic guard) ; deuxième tentative no-op                                                                   |
| RGPD : user clear → digests doivent disparaître aussi   | `DELETE include_voice=true` cascade sur `chat_messages` + reset `voice_sessions.digest_text/digest_generated_at` + delete `chat_text_digests`            |
| Voice session interrompue (tab close, network drop)     | Heartbeat backend 30s timeout → fin de session implicite → enqueue digest. Si Mistral fail, log + retry async 1× sans bloquer l'utilisateur.             |
| Verbatim de 30 msgs trop volumineux pour ElevenLabs     | Cap par message à 600 chars via `PER_MESSAGE_MAX_CHARS` (réutilise le cap existant `_CHAT_HISTORY_MAX_CHARS_PER_MSG`) ; truncation depuis le plus ancien |
| Sessions voice multiples concurrentes (rare)            | `exclude_voice_session_id` exclut uniquement la session active. Les autres sessions concurrentes n'ont pas encore de digest → ignorées par le SELECT.    |

## Métriques de succès (PostHog)

- `unified_context_built` (segmenté par target='voice' vs 'chat', size_bytes, n_voice_digests, n_chat_digests, n_recent)
- `voice_session_digest_generated` (duration_seconds, success/fail, mistral_latency_ms)
- `chat_text_digest_generated` (msg_count, mistral_latency_ms)
- `chat_history_cleared` (include_voice, n_text_deleted, n_voice_deleted)
- **KPI primary** : taux de réutilisation = % de sessions voice où l'agent référence explicitement un échange précédent (eval qualitative sur 50 sessions, à mesurer 2 semaines post-deploy)

## Décisions ouvertes (à valider en review)

| #   | Décision                                                  | Défaut proposé                                                               |
| --- | --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Localisation `context_builder.py`                         | Sous `voice/` (initiateur). Alternative : `core/conversation/`               |
| 2   | Bucket size chat texte                                    | 20 messages. Tunable via env var `CHAT_TEXT_BUCKET_SIZE`                     |
| 3   | TTL des digests (auto-régénération si vieux)              | NON V1. À considérer si user revient 6 mois après et le digest est obsolète. |
| 4   | Inclure les rows `voice_speaker='agent'` dans le verbatim | OUI (sinon on perd la moitié du dialogue)                                    |
| 5   | Visualisation digest côté UI                              | NON V1. Pure backend. UI pourra montrer "8 sessions précédentes" plus tard.  |

## Méga-plan d'implémentation

Le découpage en sous-agents Opus 4.7 sera produit par invocation de la skill `writing-plans` après approbation de ce spec. Vue macro envisagée :

- **Agent A — Backend Phase 1.1-1.3** : migration 010 + context_builder + context_digest avec tests unit
- **Agent B — Backend Phase 1.4-1.6** : branchement voice/router + chat/service + clear endpoint
- **Agent C — Backend Phase 1.7-1.8** : hooks asyncio end-of-session + bucket chat texte
- **Agent D — Frontend Phase 2.1** : web (api + ChatHeader confirm)
- **Agent E — Frontend Phase 2.2** : extension Chrome (api + ChatDrawer confirm)
- **Agent F — Frontend Phase 2.3** : mobile Expo (api + ChatHeader confirm)
- **Agent G — E2E Phase 3** : Playwright voice-chat-symbiosis + deploy Hetzner + smoke test prod
- **Agent H — Backfill Phase 4** (asynchrone, post-deploy stable) : scripts backfill voice + chat

A bloque B et C. B bloque G. D, E, F en parallèle après A. H peut démarrer après G stable.

**Toutes les invocations Agent doivent utiliser model: claude-opus-4-7[1m]** (règle perma de mémoire utilisateur).
