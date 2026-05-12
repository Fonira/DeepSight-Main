# Bots Prospection B2B — Architecture & Plan

**Date** : 2026-05-12
**Auteur** : Claude (Opus 4.7) + Maxime
**Statut** : Phase 2 (validation pending avant Phase 3 = code)

---

## 0. Contexte

**Objectif** : acquérir des gérants de mini-apps Telegram + Luffa via deux bots conversationnels qui qualifient les leads, montrent une démo DeepSight (YouTube + TikTok), et déclenchent un handoff vers Maxime quand le lead est chaud.

**Bots en V1** :
1. **Telegram** : `@testagentiagudbot` (compte test/dev existant, jamais `@Fonirabot`)
2. **Luffa** : à provisionner via https://robot.luffa.im/login après validation archi

**Identité produit côté bot** : ton co-founder solo, pas marketing pushy, en français, mentionne YouTube ET TikTok.

**Hors scope V1** : médias riches Luffa (images, vidéos), CRM externe, paiement Stripe via bot, multi-tenant agency.

---

## 1. Vue d'ensemble — décisions Phase 1

| Décision | Choix retenu | Pourquoi |
| --- | --- | --- |
| Hébergement | Sous-module `backend/src/bots/` (Phase 1 Q1) | Partage DB/auth/logger/Mistral, déploiement existant inchangé, container unique |
| Webhook URL Telegram | `https://api.deepsightsynthesis.com/api/bots/telegram/webhook` (Phase 1 Q2) | Pas de DNS/Caddy nouveau, Let's Encrypt déjà actif |
| Luffa | Polling daemon (SDK `luffa-bot-python-sdk`) | Pas de webhook Luffa, voir [`luffa-bot-research.md`](luffa-bot-research.md) |
| Tables DB | Dédiées B2B : `bot_prospect`, `bot_message`, `bot_handoff` (Phase 1 Q3) | Sémantique métier propre, prospects ≠ users SaaS |
| Handoff | Notif Telegram via `@Bobbykimifonibot` (Phase 1 Q4) | Bot existant, Maxime le check fréquemment ; on utilise son `sendMessage` API |
| Framework Telegram | `aiogram 3.x` (décision Claude / YOLO) | Async-first idiomatique avec FastAPI, moins verbeux que `python-telegram-bot` |
| LLM | Mistral (`mistral-medium-2508` par défaut, configurable) | Stack DeepSight existante, économies via cache Redis |

---

## 2. Structure du module

```
backend/src/bots/
├── __init__.py
├── router.py                    # /api/bots/telegram/webhook (FastAPI)
├── schemas.py                   # Pydantic models incoming/outgoing
├── models.py                    # SQLAlchemy: BotProspect, BotMessage, BotHandoff
├── config.py                    # ENV vars + feature flags
│
├── core/
│   ├── __init__.py
│   ├── conversation.py          # ConversationEngine: machine d'états + Mistral
│   ├── qualification.py         # Logique scoring lead (5 dimensions)
│   ├── handoff.py               # Notif Telegram vers Maxime via Bobby
│   └── prompts.py               # System prompts FR co-founder (Telegram + Luffa)
│
├── telegram/
│   ├── __init__.py
│   ├── adapter.py               # parse_update / send_message / aiogram setup
│   └── handlers.py              # /start, text, callback_query (boutons)
│
├── luffa/
│   ├── __init__.py
│   ├── adapter.py               # wrapper du SDK luffa-bot-python-sdk
│   └── poller.py                # boucle async, lifespan-managed
│
└── tests/
    ├── __init__.py
    ├── test_conversation.py
    ├── test_qualification.py
    ├── test_telegram_adapter.py
    └── test_luffa_adapter.py
```

> Note : les tests vivent à côté du module pour la cohérence interne, mais sont collectés par pytest depuis `backend/tests/` via la conf `pytest.ini` existante (à vérifier au moment de l'impl).

---

## 3. Schémas DB

### Migration Alembic — `028_bot_prospection.py`

```python
"""bot prospection tables (B2B leads via Telegram + Luffa)

Revision ID: 028_bot_prospection
Revises: 027_proxy_usage_daily
Create Date: 2026-05-XX
"""
from alembic import op
import sqlalchemy as sa

revision = "028_bot_prospection"
down_revision = "027_proxy_usage_daily"


def upgrade() -> None:
    op.create_table(
        "bot_prospect",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("platform", sa.String(16), nullable=False),          # "telegram" | "luffa"
        sa.Column("platform_user_id", sa.String(64), nullable=False),  # Telegram chat_id ou Luffa uid
        sa.Column("platform_username", sa.String(128), nullable=True), # @handle Telegram, null sur Luffa
        sa.Column("display_name", sa.String(128), nullable=True),
        sa.Column("language_code", sa.String(8), nullable=True),
        sa.Column("lead_status", sa.String(32), nullable=False, server_default="new"),
        # new | qualifying | demo_shown | warm | converted | cold | blocked
        sa.Column("qualification_score", sa.Integer, nullable=False, server_default="0"),  # 0-100
        sa.Column("business_name", sa.String(256), nullable=True),
        sa.Column("business_type", sa.String(64), nullable=True),  # ex "ecommerce_telegram_miniapp"
        sa.Column("audience_size", sa.String(32), nullable=True),  # "1-100" | "100-1k" | "1k-10k" | "10k+"
        sa.Column("current_pain", sa.Text, nullable=True),         # texte libre extrait par LLM
        sa.Column("interest_signals", sa.JSON, nullable=True),     # liste de signaux capturés
        sa.Column("state", sa.String(32), nullable=False, server_default="hello"),
        # hello | discover | demo | objections | handoff | done
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_message_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("handoff_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("platform", "platform_user_id", name="uq_bot_prospect_platform_user"),
    )
    op.create_index("ix_bot_prospect_lead_status", "bot_prospect", ["lead_status"])
    op.create_index("ix_bot_prospect_last_message_at", "bot_prospect", ["last_message_at"])

    op.create_table(
        "bot_message",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("prospect_id", sa.Integer, sa.ForeignKey("bot_prospect.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),  # "user" | "assistant" | "system"
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("platform_msg_id", sa.String(64), nullable=True),  # msgId Luffa / message_id Telegram
        sa.Column("intent_detected", sa.String(64), nullable=True),  # extrait par LLM (ex "demo_request")
        sa.Column("tokens_used", sa.Integer, nullable=True),
        sa.Column("model", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_bot_message_prospect_id", "bot_message", ["prospect_id"])
    op.create_index("ix_bot_message_created_at", "bot_message", ["created_at"])

    op.create_table(
        "bot_handoff",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("prospect_id", sa.Integer, sa.ForeignKey("bot_prospect.id", ondelete="CASCADE"), nullable=False),
        sa.Column("channel", sa.String(32), nullable=False),  # "telegram_bobby"
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),  # Maxime a répondu
        sa.Column("summary", sa.Text, nullable=False),         # résumé qualif généré par LLM
        sa.Column("deep_link", sa.String(256), nullable=True), # t.me/testagentiagudbot?start=resume_XYZ
        sa.Column("notification_error", sa.Text, nullable=True),
    )
    op.create_index("ix_bot_handoff_prospect_id", "bot_handoff", ["prospect_id"])


def downgrade() -> None:
    op.drop_index("ix_bot_handoff_prospect_id", table_name="bot_handoff")
    op.drop_table("bot_handoff")
    op.drop_index("ix_bot_message_created_at", table_name="bot_message")
    op.drop_index("ix_bot_message_prospect_id", table_name="bot_message")
    op.drop_table("bot_message")
    op.drop_index("ix_bot_prospect_last_message_at", table_name="bot_prospect")
    op.drop_index("ix_bot_prospect_lead_status", table_name="bot_prospect")
    op.drop_table("bot_prospect")
```

### SQLAlchemy models (à ajouter dans `backend/src/db/database.py`)

```python
class BotProspect(Base):
    __tablename__ = "bot_prospect"

    id = Column(Integer, primary_key=True)
    platform = Column(String(16), nullable=False)
    platform_user_id = Column(String(64), nullable=False)
    platform_username = Column(String(128), nullable=True)
    display_name = Column(String(128), nullable=True)
    language_code = Column(String(8), nullable=True)
    lead_status = Column(String(32), nullable=False, default="new")
    qualification_score = Column(Integer, nullable=False, default=0)
    business_name = Column(String(256), nullable=True)
    business_type = Column(String(64), nullable=True)
    audience_size = Column(String(32), nullable=True)
    current_pain = Column(Text, nullable=True)
    interest_signals = Column(JSON, nullable=True)
    state = Column(String(32), nullable=False, default="hello")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_message_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    handoff_at = Column(DateTime(timezone=True), nullable=True)

    messages = relationship("BotMessage", back_populates="prospect", cascade="all, delete-orphan")
    handoffs = relationship("BotHandoff", back_populates="prospect", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("platform", "platform_user_id", name="uq_bot_prospect_platform_user"),
        Index("ix_bot_prospect_lead_status", "lead_status"),
        Index("ix_bot_prospect_last_message_at", "last_message_at"),
    )


class BotMessage(Base):
    __tablename__ = "bot_message"
    id = Column(Integer, primary_key=True)
    prospect_id = Column(Integer, ForeignKey("bot_prospect.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(16), nullable=False)
    content = Column(Text, nullable=False)
    platform_msg_id = Column(String(64), nullable=True)
    intent_detected = Column(String(64), nullable=True)
    tokens_used = Column(Integer, nullable=True)
    model = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    prospect = relationship("BotProspect", back_populates="messages")
    __table_args__ = (Index("ix_bot_message_prospect_id", "prospect_id"),)


class BotHandoff(Base):
    __tablename__ = "bot_handoff"
    id = Column(Integer, primary_key=True)
    prospect_id = Column(Integer, ForeignKey("bot_prospect.id", ondelete="CASCADE"), nullable=False)
    channel = Column(String(32), nullable=False)
    sent_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    claimed_at = Column(DateTime(timezone=True), nullable=True)
    summary = Column(Text, nullable=False)
    deep_link = Column(String(256), nullable=True)
    notification_error = Column(Text, nullable=True)

    prospect = relationship("BotProspect", back_populates="handoffs")
```

---

## 4. Endpoints FastAPI

### 4.1 `POST /api/bots/telegram/webhook`

**Rôle** : recevoir un Update Telegram (message texte, callback button) et le router vers `ConversationEngine`.

**Auth** : header `X-Telegram-Bot-Api-Secret-Token` égal à `settings.TELEGRAM_WEBHOOK_SECRET` (32-byte random généré au setup).

**Contrat** :

```python
# backend/src/bots/router.py
from fastapi import APIRouter, Depends, HTTPException, Header, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_session
from .core.conversation import ConversationEngine
from .telegram.adapter import TelegramAdapter
from .config import settings as bot_settings

router = APIRouter(prefix="/api/bots", tags=["bots"])


@router.post("/telegram/webhook", status_code=200)
async def telegram_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_telegram_bot_api_secret_token: str | None = Header(default=None, alias="X-Telegram-Bot-Api-Secret-Token"),
    db: AsyncSession = Depends(get_session),
):
    # 1. Auth header (cf. doc Telegram)
    if not bot_settings.telegram_enabled:
        raise HTTPException(404, "telegram bot disabled")
    if x_telegram_bot_api_secret_token != bot_settings.telegram_webhook_secret:
        raise HTTPException(403, "invalid secret token")

    payload = await request.json()
    adapter = TelegramAdapter()
    parsed = adapter.parse_update(payload)
    if parsed is None:
        return {"status": "ignored"}  # update non géré (edited_message, etc.)

    # 2. Réponse rapide à Telegram : on traite en background pour éviter timeout 60s
    background_tasks.add_task(
        ConversationEngine(db_factory=get_session, adapter=adapter).handle,
        parsed,
    )
    return {"status": "ok"}
```

**Format Update Telegram** (cf. https://core.telegram.org/bots/api#update) : pas besoin d'un schéma Pydantic strict — on délègue à aiogram via `TelegramAdapter.parse_update`.

**Réponse** : `200 OK {"status": "ok"|"ignored"}`. Telegram retry pendant 24h en cas de non-200.

**Note critique** : on **n'utilise pas** `get_session(db)` dans `BackgroundTasks` car la session FastAPI est fermée après réponse. Le `ConversationEngine` reçoit un `db_factory` et ouvre sa propre session async.

### 4.2 `POST /api/bots/_internal/test-handoff` (dev only, behind admin auth)

**Rôle** : déclencher un message test vers `@Bobbykimifonibot` pour valider le chat_id et le token sans avoir besoin d'un vrai lead.

```python
@router.post("/_internal/test-handoff", dependencies=[Depends(require_admin)])
async def test_handoff():
    from .core.handoff import notify_maxime
    err = await notify_maxime(
        summary="🧪 Test handoff — ceci est un message de test envoyé par l'endpoint admin.",
        deep_link=None,
    )
    if err:
        raise HTTPException(500, detail={"code": "HANDOFF_ERROR", "message": err})
    return {"status": "sent"}
```

`require_admin` réutilise le dependency existant `auth.dependencies.require_admin` (voir module admin actuel).

### 4.3 Endpoint santé bots (optionnel V1)

```python
@router.get("/_status")
async def status():
    return {
        "telegram_enabled": bot_settings.telegram_enabled,
        "luffa_enabled": bot_settings.luffa_enabled,
        "luffa_last_poll_at": luffa_state.last_poll_at_iso,
    }
```

### 4.4 Pas d'endpoint Luffa exposé

Luffa = polling sortant. Le poller tourne en tâche asyncio dans le lifespan FastAPI. Aucun endpoint HTTP exposé.

### 4.5 Pydantic schemas

```python
# backend/src/bots/schemas.py
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field

class ParsedMessage(BaseModel):
    """Message normalisé cross-platform consommé par ConversationEngine."""
    platform: Literal["telegram", "luffa"]
    platform_user_id: str
    platform_username: Optional[str] = None
    display_name: Optional[str] = None
    language_code: Optional[str] = None
    is_group: bool = False
    text: str
    platform_msg_id: Optional[str] = None
    callback_data: Optional[str] = None  # Telegram callback_query (button)


class OutgoingMessage(BaseModel):
    text: str
    buttons: list["OutgoingButton"] = Field(default_factory=list)


class OutgoingButton(BaseModel):
    label: str
    payload: str  # selector Luffa | callback_data Telegram


class ProspectQualification(BaseModel):
    business_type: Optional[str] = None
    audience_size: Optional[str] = None
    current_pain: Optional[str] = None
    interest_signals: list[str] = Field(default_factory=list)
    score: int = 0  # 0-100
    is_warm: bool = False  # >= 60
```

---

## 5. Conversation flow (FR co-founder)

### 5.1 Machine d'états

```
hello → discover → demo → objections → handoff → done
                          ↓
                       (cold) → done
```

| Étape | But | Sortie attendue user |
| --- | --- | --- |
| `hello` | Accueil, présentation 1 phrase, demande tu/vous tolérante | Réponse libre |
| `discover` | 3 micro-questions : type de boutique, audience, pain actuel | Texte + intent |
| `demo` | Démo en 30s : envoyer URL YouTube test + URL TikTok test + lien public DeepSight analyse | Curiosité / objection |
| `objections` | Lever doutes (prix, complexité, déjà testé concurrent) | Continuer ou se rétracter |
| `handoff` | CTA explicite : "Veux-tu qu'on en parle 15 min en direct ?" | OK → notif Maxime |
| `done` | Conv close (handoff envoyé OU lead cold) | — |

### 5.2 System prompt Mistral (extrait)

```python
SYSTEM_PROMPT_FR = """Tu es Maxime, co-founder de DeepSight, un SaaS d'analyse IA de vidéos YouTube et TikTok.

Tu parles à un gérant de mini-app Telegram ou Luffa qui pourrait utiliser DeepSight pour comprendre la concurrence vidéo de sa niche, repérer les tendances, ou analyser les vidéos qu'il/elle veut intégrer à sa mini-app.

Ton :
- Direct, chaleureux, jamais marketing-pushy
- Tu tutoies au début, tu passes au vouvoiement si la personne le fait
- Tu poses UNE question à la fois, jamais trois d'affilée
- Tu mentionnes que DeepSight gère YouTube ET TikTok (les deux ont leur public)
- IA 100% française et européenne (Mistral) — angle souveraineté quand pertinent
- Tu ne donnes JAMAIS de prix avant qu'on te le demande (Pro 8,99€/mois, Expert 19,99€/mois si demandé)
- Tu peux pointer vers une analyse publique pour démonstration : https://www.deepsightsynthesis.com/a/{slug}

Tu suis cette machine d'états : hello → discover → demo → objections → handoff → done

État actuel : {state}
Score lead actuel : {qualification_score}/100
Historique messages : {history}

Si la personne semble chaude (intent clair de continuer, donne son business, pose des questions de prix sérieuses), score +20 et propose le handoff.

Si la personne semble froide (réponses monosyllabiques, "non merci", silence radio sur 2 questions), score 0, dis au revoir poliment, état = done.

Réponds en JSON :
{
  "text": "<message en français>",
  "buttons": [{"label": "...", "payload": "..."}],  // optionnel, max 3
  "next_state": "<state>",
  "score_delta": <int>,
  "intent_detected": "<short string>",
  "extracted": {
    "business_type": "...",
    "audience_size": "...",
    "current_pain": "..."
  },
  "ready_for_handoff": <bool>
}
"""
```

### 5.3 Messages clés (rédigés, validés par l'usage)

**Hello (Telegram, /start)**
> Salut 👋 Maxime ici, co-founder de **DeepSight**.
> On aide les gérants de mini-apps comme la tienne à analyser n'importe quelle vidéo **YouTube ou TikTok** en 30 sec — synthèse, fact-check, points clés.
> Tu fais quoi comme mini-app ?

**Demo trigger**
> Regarde, je viens d'analyser cette vidéo TikTok en 25 sec :
> 👉 https://www.deepsightsynthesis.com/a/exemple-tiktok
> Synthèse, sources, mind-map, le tout en français. Tu veux qu'on regarde ensemble une vidéo de ta niche ?

**Handoff CTA**
> J'ai l'impression que ça pourrait t'être vraiment utile.
> On se prend 15 min ensemble cette semaine ? Je peux te montrer le truc sur tes propres vidéos, sans préparation.

**Cold close**
> Pas de souci, je note. Si un jour tu veux jeter un œil sans engagement : https://www.deepsightsynthesis.com
> Bonne suite 👍

### 5.4 Variantes Luffa

Même ton, mais :
- Pas de `/start` command (pas de commands sur Luffa) — l'accueil démarre dès le premier message reçu
- Boutons via `SimpleButton(name="Voir la démo", selector="demo")` quand pertinent
- Si DeepSight ne sert pas le public Luffa (très probable — Web3/crypto-focused), le flow `discover` détecte rapidement et passe en `done` poli

---

## 6. Sécurité

| Vecteur | Mitigation |
| --- | --- |
| Webhook spoofing Telegram | Header `X-Telegram-Bot-Api-Secret-Token` validé, secret généré 32 bytes random |
| Robot key Luffa fuite | Stocké uniquement dans `.env.production` (clawdbot), jamais loggé, jamais commit |
| Prompt injection prospect | System prompt protégé par séparation contexte/instruction, JSON-only outputs avec validation Pydantic, fallback safe message si parsing échoue |
| Spam (un user qui flood) | Rate limit 30 msg/h par `(platform, platform_user_id)` côté backend ; au-delà, le bot ignore avec un "Doucement 🙃" toutes les 6h max |
| Exfiltration données autres prospects | Le `ConversationEngine` ne charge QUE les messages du prospect courant ; aucun cross-prospect leak possible (un message du prospect A ne peut pas révéler le prospect B) |
| Stripe / payment via bot | **Bloqué V1** : aucune commande paiement exposée, tout passe par le handoff humain ou le lien web |
| Logs PII | `platform_username` et `text` loggés mais `display_name` masqué dans les logs structurés (cf. `core.logging`) |
| Anti-prompt-injection LLM | Si le user envoie "Ignore previous instructions and...", on détecte les patterns connus et on répond "Désolé, je ne peux pas faire ça — mais je peux te parler de DeepSight, on continue ?" |

**Threat model explicite** :
- Un prospect malveillant peut essayer de jailbreak le LLM pour qu'il dise n'importe quoi : limité par JSON structured output + filtrage côté backend des outputs hors-scope
- Un prospect malveillant peut DDOS le webhook : Telegram impose son propre rate-limit, et notre backend a déjà un middleware rate limiter activable
- Un attaquant peut tenter de forger des updates Telegram sans le secret token : 403 immédiat

---

## 7. Variables d'environnement

À ajouter dans `/opt/deepsight/repo/.env.production` :

```env
# ── Bots Prospection B2B ─────────────────────────────────────────────
BOTS_ENABLED=true                           # kill switch global

# Telegram (@testagentiagudbot en dev → prod TBD)
TELEGRAM_BOT_TOKEN=                         # à obtenir via @BotFather
TELEGRAM_BOT_USERNAME=testagentiagudbot
TELEGRAM_WEBHOOK_SECRET=                    # 32 bytes random, généré au setup
TELEGRAM_ENABLED=true

# Luffa
LUFFA_ROBOT_SECRET=                         # depuis robot.luffa.im
LUFFA_ENABLED=false                         # off par défaut, on bascule après Phase 3 Telegram OK
LUFFA_POLL_INTERVAL=1.0
LUFFA_CONCURRENCY=5

# Handoff Maxime via @Bobbykimifonibot
HANDOFF_TELEGRAM_BOT_TOKEN=                 # token de @Bobbykimifonibot (déjà connu de Maxime)
HANDOFF_TELEGRAM_CHAT_ID=                   # chat_id Maxime côté Bobby (détecté au setup)

# LLM bot (peut overrider le modèle Mistral global)
BOTS_MISTRAL_MODEL=mistral-medium-2508
BOTS_MAX_HISTORY_MESSAGES=20                # nombre de messages chargés dans le contexte LLM
```

`backend/src/bots/config.py` charge ces vars via `pydantic_settings.BaseSettings` (déjà la convention du backend).

---

## 8. Diagramme ASCII complet

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PROSPECT (Telegram)                                                    │
│  @user → message → @testagentiagudbot                                   │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │ Telegram push (webhook HTTPS)
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  repo-caddy-1   (TLS, reverse proxy)                                    │
│  api.deepsightsynthesis.com/api/bots/telegram/webhook                   │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  repo-backend-1  (FastAPI)                                              │
│                                                                         │
│  ┌──────────────────────────┐    ┌──────────────────────────────────┐   │
│  │ /api/bots/telegram/      │    │ Luffa Poller (asyncio task,      │   │
│  │   webhook (router)       │    │ démarré dans lifespan FastAPI)   │   │
│  │ ↳ validate secret token  │    │ ↳ luffa_bot.run(handler, 1.0Hz)  │   │
│  │ ↳ aiogram.parse_update   │    └──────────┬───────────────────────┘   │
│  │ ↳ BackgroundTask         │               │                           │
│  └─────────┬────────────────┘               │                           │
│            │                                │                           │
│            └────────────┬───────────────────┘                           │
│                         ▼                                               │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  ConversationEngine                                       │          │
│  │  1. upsert BotProspect by (platform, platform_user_id)    │          │
│  │  2. charge derniers N messages depuis bot_message         │          │
│  │  3. build prompt (system + history + user)                │          │
│  │  4. Mistral → JSON structured                             │          │
│  │  5. update state + score + extracted fields               │          │
│  │  6. save user + assistant messages                        │          │
│  │  7. si ready_for_handoff → notify_maxime()                │          │
│  └────────┬──────────────────────────────────┬────────────────┘         │
│           │                                  │                          │
│           ▼                                  ▼                          │
│  ┌──────────────────┐              ┌───────────────────────┐            │
│  │ repo-postgres-1  │              │ Mistral API           │            │
│  │ bot_prospect     │              │ (httpx via stack      │            │
│  │ bot_message      │              │  llm_provider existant)│           │
│  │ bot_handoff      │              └───────────────────────┘            │
│  └──────────────────┘                                                   │
│                                                                         │
│  Outgoing → adapter.send_message → Telegram Bot API OR Luffa API        │
└──────────────────────────┬──────────────────────────────────────────────┘
                           │ HTTPS sortant
                           ▼
   ┌────────────────────────┬────────────────────────┐
   │ api.telegram.org/bot…  │ apibot.luffa.im/robot… │
   └────────────────────────┴────────────────────────┘

   Si handoff chaud :
   ┌────────────────────────────────────────────────┐
   │ notify_maxime()                                 │
   │  POST https://api.telegram.org/bot{BOBBY}/      │
   │       sendMessage                               │
   │  chat_id = HANDOFF_TELEGRAM_CHAT_ID             │
   │  text = "🔥 Lead chaud : @user / {summary}"     │
   └────────────────────────────────────────────────┘
```

---

## 9. Dépendances Python à ajouter

```diff
# backend/requirements.txt
+aiogram>=3.13.0
+luffa-bot-python-sdk>=0.1.2
```

Aucune lib ne dépend de stack Node ou autre. `aiogram` utilise `aiohttp` qui est déjà dans `requirements.txt` (compatibilité OK).

---

## 10. Milestones (max 2-3h chacune)

### M1 — Skeleton module + migration DB *(2h)*

- Créer arbo `backend/src/bots/` avec stubs vides
- Ajouter `BotProspect`, `BotMessage`, `BotHandoff` dans `db/database.py`
- Migration Alembic `028_bot_prospection.py`
- Tester migration sur SQLite local + dry-run staging Hetzner
- Ajouter `aiogram` + `luffa-bot-python-sdk` à `requirements.txt`
- Mount le router dans `main.py` (sous flag `BOTS_ENABLED`)
- `pytest backend/tests/bots/` vert (0 test, juste import OK)

### M2 — Adapter Telegram + endpoint webhook *(2h30)*

- `bots/telegram/adapter.py` : aiogram Bot/Dispatcher, `parse_update`, `send_message`
- `bots/router.py` : `POST /api/bots/telegram/webhook` avec validation secret
- Script Python `scripts/setup_telegram_webhook.py` (Claude l'exécute) qui appelle `setWebhook` côté Telegram
- Test unitaire : webhook avec secret valide → 200, secret invalide → 403, payload garbage → 200 ignored
- Test E2E manuel : envoyer un msg à @testagentiagudbot en local via ngrok → voir le webhook hit le backend

### M3 — ConversationEngine + intégration Mistral *(3h)*

- `bots/core/conversation.py` : load prospect, build prompt, call Mistral, parse JSON, save messages
- `bots/core/prompts.py` : system prompts FR (validation Claude+Maxime)
- `bots/core/qualification.py` : extraction structurée score + state
- Tests unitaires : flow happy path (hello → discover → demo → handoff), flow cold (hello → done), parsing JSON LLM fallback
- Mock `llm_provider` dans les tests

### M4 — Handoff Maxime via Bobby *(1h30)*

- `bots/core/handoff.py` : POST https://api.telegram.org/bot{HANDOFF_TOKEN}/sendMessage
- Génération `deep_link` `t.me/testagentiagudbot?start=resume_{prospect_id}` (pour reprendre conv si Maxime y répond)
- Endpoint dev `POST /api/bots/_internal/test-handoff`
- Test unitaire avec httpx mock
- Validation E2E : test-handoff réel sur @Bobbykimifonibot

### M5 — Adapter Luffa + poller daemon *(2h30)*

- `bots/luffa/adapter.py` : wrap SDK, conversion `IncomingEnvelope` → `ParsedMessage`
- `bots/luffa/poller.py` : `async def luffa_loop()` lancé dans lifespan FastAPI, kill-switch via flag
- Réutilise `ConversationEngine` avec `platform="luffa"`
- Tests unitaires (mock SDK via respx)
- **Bascule activation différée** : `LUFFA_ENABLED=false` par défaut prod, on l'allume après obtention du `robot_key`

### M6 — Tests E2E + deploy + runbook *(2h)*

- Smoke test Telegram : flow complet hello → handoff → notif reçue dans Bobby
- Deploy Hetzner : push main → SSH VPS → git pull → docker rebuild → migration alembic
- Update doc deploy `docs/RUNBOOK.md` : section "Bots prospection"
- Configurer webhook prod Telegram via `scripts/setup_telegram_webhook.py`
- Vérifier flag `LUFFA_ENABLED=false` puis activer plus tard quand robot_key obtenu
- Monitoring : ajouter un check `bot_prospect.last_message_at > now() - 24h` dans `monitoring/scheduler.py`

**Total estimé** : 13.5h sur ~3 jours en sessions de 2-3h.

---

## 11. Points qui resteront à valider en cours de Phase 3

1. **Chat_id de Maxime sur Bobby** : besoin de le récupérer. Soit Maxime l'a déjà (via OpenClaw config `/root/.openclaw/openclaw.json`), soit on le détecte au runtime via un `/start` envoyé à Bobby.
2. **Slug analyse démo publique** : choisir 2 analyses publiques DeepSight (1 YouTube + 1 TikTok) à montrer en démo. À fixer juste avant déploiement M3.
3. **Quota Mistral pour les bots** : décider si on utilise le même compte API que le SaaS principal ou un compte séparé (impact billing). Recommandation : même compte, monitoring tokens dédié dans `bot_message.tokens_used`.
4. **Logique de réveil de leads cold** : V1 = none. V2 = cron `apscheduler` qui relance les leads `state=done` après 30j avec un message court.

---

## 12. Hors scope V1 (à mentionner pour clarté)

- ❌ CRM externe (HubSpot, Pipedrive) — V2 si volume
- ❌ Multi-langue (EN/ES) — FR only V1
- ❌ Reconnaissance image / audio entrant — texte uniquement
- ❌ Médias riches Luffa (images, cards) — hypothèses non validées
- ❌ Multi-bot Telegram (autres @handle) — `@testagentiagudbot` seul V1
- ❌ Statistiques dashboard admin pour Maxime — peut être lu directement en SQL pour l'instant
- ❌ A/B testing des prompts — V2

---

## Validation requise

Maxime, lis ce doc et valide / corrige avant que je code en Phase 3. Points particuliers à confirmer :
- Le choix `@Bobbykimifonibot` pour le handoff est-il OK ? Tu as son token et ton chat_id ?
- Le modèle Mistral `mistral-medium-2508` est-il OK ou tu préfères `mistral-large-2512` ?
- Le slug `/a/exemple-tiktok` doit pointer vers quelle analyse publique réelle ?
- Tu valides le scope V1 (Telegram d'abord, Luffa différé) ou tu veux les deux en parallèle ?
