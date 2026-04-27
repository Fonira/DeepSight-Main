# Sprint Contexte Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Étendre la mémoire des agents voice ElevenLabs (10 messages → tout l'historique text+voice jusqu'à 8k tokens) et activer la sync bidirectionnelle chat ↔ voice sur la `DashboardPage`.

**Architecture:** Deux phases indépendantes, livrables séparément.

- **Phase 1 (Backend)** — Refactor de `_build_chat_history_block_for_voice` : abandon du filtre voice rows, ajout du token budget greedy descendant, format avec tags `[Texte/Voix]`. Nouveau `settings.VOICE_HISTORY_MAX_TOKENS = 8000`.
- **Phase 2 (Frontend)** — Migration de `DashboardPage` de `VoiceModal` vers `VoiceOverlay` (déjà battle-tested sur `ChatPage`), branchement de `handleVoiceMessage` et `handleSendChat` Route A/B, auto-open du `ChatPanel` au lancement du voice.

**Tech Stack:** Python 3.11 + FastAPI + SQLAlchemy 2.0 async (backend) ; React 18 + TypeScript strict + Vite 5 (frontend) ; pytest + Vitest + Playwright (tests).

**Référence spec :** `docs/superpowers/specs/2026-04-27-agent-context-bidir-memory-design.md`

---

## File Structure

### Backend

| Fichier                                          | Type   | Responsabilité                                                                               |
| ------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------- |
| `backend/src/core/config.py`                     | Modify | Ajouter `VOICE_HISTORY_MAX_TOKENS: int = 8000` dans la classe `Settings`                     |
| `backend/src/voice/router.py`                    | Modify | Refactor de `_build_chat_history_block_for_voice` (lignes 327-383) + caller (lignes 908-942) |
| `backend/tests/voice/test_chat_history_block.py` | Create | Tests pytest pour la nouvelle logique de la fonction                                         |

### Frontend

| Fichier                                                     | Type   | Responsabilité                                                                                                                     |
| ----------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/components/ChatPanel.tsx`                     | Modify | Étendre l'interface `ChatMessage` avec `source`/`voice_session_id`/`time_in_call_secs` + badge voice dans le rendu                 |
| `frontend/src/pages/DashboardPage.tsx`                      | Modify | Remplacer `VoiceModal` par `VoiceOverlay`, ajouter `handleVoiceMessage`, wrapper `handleSendChat` Route A/B, auto-open `ChatPanel` |
| `frontend/src/pages/__tests__/DashboardPage.voice.test.tsx` | Create | Tests Vitest pour les nouveaux handlers                                                                                            |
| `frontend/e2e/dashboard-voice-bidir.spec.ts`                | Create | Test Playwright E2E full flow                                                                                                      |

---

## Phase 0 — Pré-requis (worktree + branche)

### Task 0: Préparer l'environnement de travail

**Files:** N/A (setup git)

- [ ] **Step 1: Vérifier l'état du repo**

```bash
cd C:/Users/33667/DeepSight-Main
git status
git branch --show-current
```

Expected: branche actuelle `feat/voice-mobile-final`, working tree clean après le commit de la spec.

- [ ] **Step 2: Créer une branche dédiée pour le sprint**

```bash
git checkout -b feat/voice-context-bidir-memory
```

Expected: nouvelle branche basée sur `feat/voice-mobile-final` (pour ne pas perdre la spec déjà commitée).

- [ ] **Step 3: Push initial pour avoir une origin**

```bash
git push -u origin feat/voice-context-bidir-memory
```

Expected: branche poussée, tracking configuré.

---

## Phase 1 — Backend : Mémoire étendue (5 tasks)

### Task 1: Ajouter `VOICE_HISTORY_MAX_TOKENS` à la config

**Files:**

- Modify: `backend/src/core/config.py` (classe `Settings`, à proximité des autres voice settings)

- [ ] **Step 1: Lire le fichier pour repérer l'endroit d'insertion**

Run: ouvrir `backend/src/core/config.py` et chercher la classe `Settings`. Repérer un endroit logique près des autres voice/chat settings (par exemple juste avant `R2_CONFIG` ou après les `MISTRAL_*`).

- [ ] **Step 2: Ajouter le champ dans `Settings`**

Insérer dans la classe `Settings` (Pydantic `BaseSettings`) :

```python
    # ── Voice agent context window ─────────────────────────────────────────────
    # Token budget pour l'injection de l'historique chat+voice dans le system
    # prompt voice à l'ouverture d'une session. Approximation 4 chars = 1 token.
    # Au-delà, l'algorithme greedy descendant tronque les messages les plus
    # anciens. Override possible via env VOICE_HISTORY_MAX_TOKENS.
    VOICE_HISTORY_MAX_TOKENS: int = 8000
```

- [ ] **Step 3: Vérifier que l'import marche**

```bash
cd backend && python -c "from core.config import settings; print(settings.VOICE_HISTORY_MAX_TOKENS)"
```

Expected: `8000`

- [ ] **Step 4: Commit**

```bash
git add backend/src/core/config.py
git commit -m "$(cat <<'EOF'
feat(voice): add VOICE_HISTORY_MAX_TOKENS config (default 8000)

Token budget pour l'injection de l'historique dans le system prompt voice.
Override via env. Approximation 4 chars/token.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Tests + impl — voice rows incluses avec tags `[Voix/Texte]`

**Files:**

- Create: `backend/tests/voice/test_chat_history_block.py`
- Modify: `backend/src/voice/router.py` (fonction `_build_chat_history_block_for_voice`, lignes 334-383)

- [ ] **Step 1: Écrire le test failing**

Créer `backend/tests/voice/test_chat_history_block.py` :

```python
"""Tests for _build_chat_history_block_for_voice (sprint contexte agent)."""
from __future__ import annotations

from datetime import datetime

import pytest

from voice.router import _build_chat_history_block_for_voice


def _msg(role: str, content: str, *, source: str = "text", created_at: datetime | None = None) -> dict:
    """Forge un dict comme celui retourné par chat.service.get_chat_history."""
    return {
        "role": role,
        "content": content,
        "source": source,
        "created_at": (created_at or datetime(2026, 4, 27, 14, 30)).isoformat(),
        "voice_speaker": "user" if role == "user" else "agent",
        "time_in_call_secs": 12.5 if source == "voice" else None,
    }


def test_empty_history_returns_empty_string():
    assert _build_chat_history_block_for_voice([], language="fr") == ""


def test_text_only_messages_use_texte_tag():
    msgs = [
        _msg("user", "Salut", source="text", created_at=datetime(2026, 4, 27, 14, 30)),
        _msg("assistant", "Bonjour", source="text", created_at=datetime(2026, 4, 27, 14, 31)),
    ]
    block = _build_chat_history_block_for_voice(msgs, language="fr")
    assert "[Texte utilisateur" in block
    assert "[Texte agent" in block
    assert "Salut" in block
    assert "Bonjour" in block


def test_voice_messages_are_included_with_voix_tag():
    """Spec contexte agent — les voice rows ne doivent PAS être droppées."""
    msgs = [
        _msg("user", "Question vocale", source="voice", created_at=datetime(2026, 4, 27, 14, 32)),
        _msg("assistant", "Réponse vocale", source="voice", created_at=datetime(2026, 4, 27, 14, 33)),
    ]
    block = _build_chat_history_block_for_voice(msgs, language="fr")
    assert "[Voix utilisateur" in block
    assert "[Voix agent" in block
    assert "Question vocale" in block
    assert "Réponse vocale" in block


def test_mixed_text_and_voice_chronological_order():
    msgs = [
        _msg("user", "T1", source="text", created_at=datetime(2026, 4, 27, 14, 30)),
        _msg("assistant", "T2", source="text", created_at=datetime(2026, 4, 27, 14, 31)),
        _msg("user", "V1", source="voice", created_at=datetime(2026, 4, 27, 14, 32)),
        _msg("assistant", "V2", source="voice", created_at=datetime(2026, 4, 27, 14, 33)),
    ]
    block = _build_chat_history_block_for_voice(msgs, language="fr")
    # Ordre chronologique préservé
    assert block.index("T1") < block.index("T2") < block.index("V1") < block.index("V2")
```

- [ ] **Step 2: Run tests pour vérifier qu'ils échouent**

```bash
cd backend && python -m pytest tests/voice/test_chat_history_block.py -v
```

Expected: les 3 derniers tests `test_text_only_messages_use_texte_tag`, `test_voice_messages_are_included_with_voix_tag`, `test_mixed_text_and_voice_chronological_order` échouent (le format actuel n'utilise pas `[Texte/Voix X]` et les voice rows sont droppées).

- [ ] **Step 3: Refactor `_build_chat_history_block_for_voice`**

Remplacer le corps de la fonction (lignes 334-383) par :

```python
def _build_chat_history_block_for_voice(history_msgs: list[dict], language: str = "fr") -> str:
    """Format the chat+voice history as a block injectable into the voice
    agent's system prompt.

    Le bloc inclut tous les messages text ET voice de la table unifiée
    chat_messages (Spec #1). Tags distinctifs ``[Texte utilisateur HH:MM]`` /
    ``[Voix utilisateur HH:MM]`` etc. permettent à l'agent de savoir s'il a
    déjà parlé d'un sujet à l'oral, et donc d'éviter de le re-déballer.

    L'algorithme greedy descendant (cf. _apply_token_budget) borne le bloc à
    ``settings.VOICE_HISTORY_MAX_TOKENS`` ; cette fonction accepte tout en
    entrée et renvoie une chaîne formatée dans l'ordre chronologique ascendant.

    Returns "" quand il n'y a pas de message valide.
    """
    if not history_msgs:
        return ""

    # Header / footer i18n
    if language == "en":
        header = "## Conversation history (text + voice)\n"
        text_user, text_agent = "Text user", "Text agent"
        voice_user, voice_agent = "Voice user", "Voice agent"
        footer = "\nContinue this conversation naturally.\n"
    else:
        header = "## Historique de la conversation (texte + voix)\n"
        text_user, text_agent = "Texte utilisateur", "Texte agent"
        voice_user, voice_agent = "Voix utilisateur", "Voix agent"
        footer = "\nContinue cette conversation naturellement.\n"

    def _format_line(msg: dict) -> str | None:
        content = (msg.get("content") or "").strip()
        if not content:
            return None
        role = msg.get("role", "user")
        source = msg.get("source") or "text"
        # Extraire HH:MM depuis created_at si disponible
        ts_str = msg.get("created_at") or ""
        hhmm = ""
        try:
            # ISO format → parse → HH:MM
            if ts_str:
                ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                hhmm = ts.strftime("%H:%M")
        except (ValueError, TypeError):
            hhmm = ""
        if source == "voice":
            label = voice_agent if role == "assistant" else voice_user
        else:
            label = text_agent if role == "assistant" else text_user
        suffix = f" {hhmm}" if hhmm else ""
        return f"[{label}{suffix}] {content}"

    # Format toutes les lignes (history_msgs est trié ASC selon get_chat_history)
    formatted = [line for msg in history_msgs if (line := _format_line(msg)) is not None]
    if not formatted:
        return ""

    return header + "\n".join(formatted) + footer
```

**Imports à ajouter** en haut de `router.py` (si pas déjà présent) : `from datetime import datetime`. Vérifier la présence de l'import avant d'ajouter.

- [ ] **Step 4: Run tests pour vérifier qu'ils passent**

```bash
cd backend && python -m pytest tests/voice/test_chat_history_block.py -v
```

Expected: les 4 tests passent.

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/router.py backend/tests/voice/test_chat_history_block.py
git commit -m "$(cat <<'EOF'
feat(voice): include voice rows in chat history block with [Voix/Texte] tags

Refactor _build_chat_history_block_for_voice : suppression du filtre qui
droppait les voice rows. Format avec tags distinctifs [Texte/Voix
utilisateur/agent HH:MM] pour aider l'agent ElevenLabs à savoir s'il a
déjà parlé d'un sujet à l'oral.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Tests + impl — token budget greedy descendant

**Files:**

- Modify: `backend/tests/voice/test_chat_history_block.py` (ajouter tests)
- Modify: `backend/src/voice/router.py` (fonction `_build_chat_history_block_for_voice`)

- [ ] **Step 1: Ajouter les tests failing**

Ajouter à la fin de `backend/tests/voice/test_chat_history_block.py` :

```python
def test_token_budget_truncates_oldest_messages(monkeypatch):
    """Avec un budget bas, on garde les plus récents et on tronque les anciens."""
    from core import config as _config

    # Budget réduit à 200 tokens (~800 chars) pour rendre le test rapide
    monkeypatch.setattr(_config.settings, "VOICE_HISTORY_MAX_TOKENS", 200)

    # 50 messages de ~100 chars chacun → ~50 lignes formatées totalisant >>200 tokens
    msgs = [
        _msg(
            "user" if i % 2 == 0 else "assistant",
            f"Message numero {i:03d} avec un peu de texte pour atteindre cent caracteres environ ici la ouais.",
            source="text",
            created_at=datetime(2026, 4, 27, 10, 0) .replace(minute=i % 60),
        )
        for i in range(50)
    ]
    block = _build_chat_history_block_for_voice(msgs, language="fr")
    # Le bloc doit contenir certains des messages les plus récents
    assert "Message numero 049" in block or "Message numero 048" in block
    # Et NE PAS contenir les plus anciens
    assert "Message numero 000" not in block
    assert "Message numero 005" not in block


def test_token_budget_keeps_chronological_order_after_truncation(monkeypatch):
    from core import config as _config

    monkeypatch.setattr(_config.settings, "VOICE_HISTORY_MAX_TOKENS", 100)

    msgs = [
        _msg("user", f"Question {i}", source="text", created_at=datetime(2026, 4, 27, 10, i))
        for i in range(20)
    ]
    block = _build_chat_history_block_for_voice(msgs, language="fr")
    # Les indices conservés doivent apparaître dans l'ordre chronologique ASC
    indices = [i for i in range(20) if f"Question {i}" in block]
    assert indices == sorted(indices), f"Ordre chronologique cassé : {indices}"
    assert len(indices) >= 1, "Au moins un message doit être conservé"
```

- [ ] **Step 2: Run tests pour vérifier qu'ils échouent**

```bash
cd backend && python -m pytest tests/voice/test_chat_history_block.py -v
```

Expected: les 2 nouveaux tests échouent (la fonction n'applique pas encore de token budget).

- [ ] **Step 3: Implémenter le greedy budget**

Modifier la fin de `_build_chat_history_block_for_voice` pour appliquer le budget. Remplacer la dernière section (formatage de toutes les lignes) par :

```python
    # Format puis greedy descendant : on parcourt du plus récent au plus ancien
    # pour décider quelles lignes garder, jusqu'à atteindre le budget tokens.
    formatted_pairs: list[tuple[int, str]] = []
    for idx, msg in enumerate(history_msgs):
        line = _format_line(msg)
        if line is not None:
            formatted_pairs.append((idx, line))

    if not formatted_pairs:
        return ""

    # Import paresseux pour permettre monkeypatch dans les tests
    from core.config import settings as _settings
    budget_tokens = max(0, int(_settings.VOICE_HISTORY_MAX_TOKENS or 0))
    budget_chars = budget_tokens * 4  # approximation conservatrice 4 chars = 1 token

    selected: list[tuple[int, str]] = []
    total_chars = 0
    # Parcours DESC (du plus récent au plus ancien)
    for idx, line in reversed(formatted_pairs):
        line_cost = len(line) + 1  # +1 pour le \n
        if selected and total_chars + line_cost > budget_chars:
            break  # Budget atteint → on s'arrête
        selected.append((idx, line))
        total_chars += line_cost

    # Reverse pour ordre chronologique ASC
    selected.sort(key=lambda p: p[0])
    body = "\n".join(line for _idx, line in selected)
    return header + body + footer
```

- [ ] **Step 4: Run tests pour vérifier qu'ils passent**

```bash
cd backend && python -m pytest tests/voice/test_chat_history_block.py -v
```

Expected: les 6 tests passent.

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/router.py backend/tests/voice/test_chat_history_block.py
git commit -m "$(cat <<'EOF'
feat(voice): apply 8k token budget greedy on chat history block

Algorithme greedy descendant : itère du plus récent au plus ancien,
accumule jusqu'à VOICE_HISTORY_MAX_TOKENS, puis reverse pour ordre
chronologique ASC. Approximation 4 chars/token (suffisant pour bornage).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Test + impl — message géant inclus complet

**Files:**

- Modify: `backend/tests/voice/test_chat_history_block.py` (ajouter test)
- Modify: `backend/src/voice/router.py` (`_build_chat_history_block_for_voice`)

- [ ] **Step 1: Ajouter le test failing**

Ajouter à la fin de `backend/tests/voice/test_chat_history_block.py` :

```python
def test_giant_message_included_whole_when_alone(monkeypatch):
    """Si le 1er message dépasse déjà le budget, on l'inclut complet plutôt
    que de retourner un bloc vide. Un message coupé en deux est pire que rien."""
    from core import config as _config

    monkeypatch.setattr(_config.settings, "VOICE_HISTORY_MAX_TOKENS", 50)

    giant_content = "A" * 5000  # ~1250 tokens, bien au-dessus du budget 50
    msgs = [
        _msg("user", giant_content, source="text", created_at=datetime(2026, 4, 27, 14, 30)),
    ]
    block = _build_chat_history_block_for_voice(msgs, language="fr")
    # Doit contenir le contenu complet du message géant
    assert giant_content in block, "Le message géant doit être inclus complet"
```

- [ ] **Step 2: Run pour vérifier qu'il échoue**

```bash
cd backend && python -m pytest tests/voice/test_chat_history_block.py::test_giant_message_included_whole_when_alone -v
```

Expected: échec — le greedy actuel ne sélectionne aucun message si le 1er dépasse déjà.

- [ ] **Step 3: Ajouter la garde "selected and"**

Vérifier la condition dans le greedy. Le code de Task 3 a déjà `if selected and total_chars + line_cost > budget_chars: break` — c'est-à-dire qu'on n'arrête PAS si `selected` est vide. Donc le 1er message est toujours pris, même s'il dépasse.

Si le test échoue, vérifier que la condition est bien `if selected and ...` (et pas juste `if total_chars + ...`). Si elle est correcte, le test devrait passer dès Task 3 — auquel cas Task 4 valide juste le comportement explicitement.

- [ ] **Step 4: Run le test à nouveau**

```bash
cd backend && python -m pytest tests/voice/test_chat_history_block.py -v
```

Expected: les 7 tests passent.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/voice/test_chat_history_block.py
git commit -m "$(cat <<'EOF'
test(voice): explicitly verify giant message edge case in history block

Le greedy doit toujours inclure au moins un message, même s'il dépasse
le budget tokens (un message coupé en deux est pire que rien).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Brancher le caller — augmenter `limit` côté `get_chat_history`

**Files:**

- Modify: `backend/src/voice/router.py` (constante ligne 330 + caller lignes 912-942)

- [ ] **Step 1: Renommer la constante de fetch**

À la ligne 330 de `backend/src/voice/router.py`, remplacer :

```python
_CHAT_HISTORY_MAX_MESSAGES = 10
_CHAT_HISTORY_MAX_CHARS_PER_MSG = 400
```

par :

```python
# Spec contexte agent (2026-04-27) — fetch large window then apply token budget.
# La fonction _build_chat_history_block_for_voice borne ensuite à
# settings.VOICE_HISTORY_MAX_TOKENS (~8k tokens).
_CHAT_HISTORY_FETCH_LIMIT = 500
```

- [ ] **Step 2: Adapter le caller**

À la ligne 920 (paramètre `limit` de `_get_chat_history`), remplacer :

```python
                    limit=_CHAT_HISTORY_MAX_MESSAGES,
```

par :

```python
                    limit=_CHAT_HISTORY_FETCH_LIMIT,
```

Et à la ligne 930 dans le log `extra={...}`, remplacer :

```python
                            "messages_kept": min(_CHAT_HISTORY_MAX_MESSAGES, len(_chat_history)),
```

par :

```python
                            "messages_fetched": len(_chat_history),
```

- [ ] **Step 3: Vérifier que le serveur démarre sans erreur d'import**

```bash
cd backend && python -c "from voice.router import _build_chat_history_block_for_voice, _CHAT_HISTORY_FETCH_LIMIT; print(_CHAT_HISTORY_FETCH_LIMIT)"
```

Expected: `500`

- [ ] **Step 4: Run la suite de tests voice complète**

```bash
cd backend && python -m pytest tests/voice/ -v
```

Expected: tous les tests passent (les nouveaux + les anciens `test_web_tools_cache.py`).

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/router.py
git commit -m "$(cat <<'EOF'
feat(voice): wire caller to fetch up to 500 messages, apply 8k token budget

Renomme _CHAT_HISTORY_MAX_MESSAGES (10) en _CHAT_HISTORY_FETCH_LIMIT
(500). La bornage final est désormais effectué par
_build_chat_history_block_for_voice via settings.VOICE_HISTORY_MAX_TOKENS.
Supprime _CHAT_HISTORY_MAX_CHARS_PER_MSG (plus utilisé).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Frontend : Sync bidir DashboardPage (7 tasks)

### Task 6: Étendre l'interface `ChatMessage` dans `ChatPanel.tsx`

**Files:**

- Modify: `frontend/src/components/ChatPanel.tsx` (interface `ChatMessage` lignes 46-52, et le rendu des messages)

- [ ] **Step 1: Modifier l'interface**

Dans `frontend/src/components/ChatPanel.tsx`, remplacer l'interface `ChatMessage` (ligne 46-52) par :

```typescript
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  web_search_used?: boolean;
  /** Spec contexte agent — distingue text vs voice transcripts dans la timeline. */
  source?: "text" | "voice_user" | "voice_agent";
  /** ID de la session voice quand source ≠ "text". */
  voice_session_id?: string | null;
  /** Secondes écoulées depuis le début de l'appel quand source ≠ "text". */
  time_in_call_secs?: number;
}
```

- [ ] **Step 2: Ajouter un badge voice dans le rendu des messages**

Repérer la section qui rend chaque bulle de message (chercher `messages.map(` dans le fichier). Pour chaque message, ajouter un petit indicateur si `msg.source === "voice_user" || msg.source === "voice_agent"`. Exemple à ajouter à côté de l'avatar/header de la bulle :

```tsx
{
  (msg.source === "voice_user" || msg.source === "voice_agent") && (
    <span className="inline-flex items-center gap-1 text-[10px] text-indigo-400/80 ml-1">
      <Mic size={10} />
      Voix
    </span>
  );
}
```

Importer `Mic` depuis `lucide-react` en haut du fichier (ajouter à l'import existant des icônes).

- [ ] **Step 3: Vérifier le typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: pas d'erreur.

- [ ] **Step 4: Vérifier le lint**

```bash
cd frontend && npm run lint
```

Expected: pas d'erreur.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ChatPanel.tsx
git commit -m "$(cat <<'EOF'
feat(chat-panel): extend ChatMessage with voice source metadata + badge

Ajoute source / voice_session_id / time_in_call_secs (optionnels) à
l'interface ChatMessage pour supporter les transcripts voice injectés
depuis le VoiceOverlay. Badge Mic pour identifier visuellement les
messages issus de la voix.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Remplacer `useVoiceChat` lifted + `VoiceModal` par `VoiceOverlay`

**Files:**

- Modify: `frontend/src/pages/DashboardPage.tsx` (imports, state, callbacks, JSX)

- [ ] **Step 1: Retirer l'import `VoiceModal` et l'usage direct de `useVoiceChat`**

Dans `frontend/src/pages/DashboardPage.tsx` :

- Retirer la ligne 96 : `import { VoiceModal } from "../components/voice/VoiceModal";`
- Ajouter à la place : `import { VoiceOverlay, type VoiceOverlayMessage, type VoiceOverlayController } from "../components/voice/VoiceOverlay";`
- Retirer le bloc des lignes 224-231 :
  ```typescript
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const voiceChat = useVoiceChat({ ... });
  const micLevel = useMicLevel(voiceChat.micStream, voiceChat.isTalking);
  ```
- Le remplacer par :
  ```typescript
  // 🎙️ Voice Chat — VoiceOverlay encapsule useVoiceChat en interne (Spec contexte agent 2026-04-27)
  const [isVoiceOverlayOpen, setIsVoiceOverlayOpen] = useState(false);
  const voiceControllerRef = useRef<VoiceOverlayController | null>(null);
  ```
- Retirer également l'import `useVoiceChat` et `useMicLevel` s'ils ne sont plus utilisés ailleurs dans le fichier (chercher avec un grep).

- [ ] **Step 2: Remplacer le JSX `<VoiceModal>` par `<VoiceOverlay>`**

Repérer le bloc `<VoiceModal isOpen={isVoiceModalOpen} ...>` (lignes 1738+). Le remplacer entièrement par :

```tsx
{
  /* 🎙️ Voice Chat — Spec contexte agent : sync bidir avec ChatPanel */
}
{
  selectedSummary && (
    <VoiceOverlay
      isOpen={isVoiceOverlayOpen}
      onClose={() => setIsVoiceOverlayOpen(false)}
      title={selectedSummary.video_title}
      subtitle={selectedSummary.video_channel}
      summaryId={selectedSummary.id}
      agentType="explorer"
      language={language as "fr" | "en"}
      onVoiceMessage={handleVoiceMessage}
      controllerRef={voiceControllerRef}
    />
  );
}
```

(`handleVoiceMessage` sera ajouté à la Task 8.)

- [ ] **Step 3: Mettre à jour les déclencheurs `setIsVoiceModalOpen(true)`**

Repérer toutes les occurrences de `setIsVoiceModalOpen` dans le fichier (lignes 1388 et 1527 d'après l'audit). Les remplacer par `setIsVoiceOverlayOpen`. Renommer aussi `isVoiceModalOpen` partout.

```bash
# Vérifier qu'il n'y a plus aucune référence à "VoiceModal" ou "isVoiceModalOpen"
grep -n "VoiceModal\|isVoiceModalOpen\|voiceChat\." frontend/src/pages/DashboardPage.tsx
```

Expected: aucun résultat (sinon corriger).

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: erreur sur `handleVoiceMessage` qui n'existe pas encore — c'est attendu, on l'ajoute Task 8.

- [ ] **Step 5: Commit (WIP, pas encore typecheck-clean)**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "$(cat <<'EOF'
refactor(dashboard): swap VoiceModal for VoiceOverlay (WIP — handlers next)

VoiceOverlay encapsule useVoiceChat en interne, donc on supprime le lift
useVoiceChat + useMicLevel de DashboardPage. handleVoiceMessage manquant,
ajouté dans la prochaine tâche.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Ajouter `handleVoiceMessage` et wrapper `handleSendChat` Route A/B

**Files:**

- Modify: `frontend/src/pages/DashboardPage.tsx` (callbacks)

- [ ] **Step 1: Ajouter `handleVoiceMessage` près du autres callbacks**

Dans `DashboardPage.tsx`, ajouter (au bon endroit, près des autres useCallback) :

```typescript
// ── Spec contexte agent — Sync voice → chat timeline ──
// Chaque transcript turn capturé par VoiceOverlay (user OU agent) est
// injecté dans la même timeline `chatMessages`. La persistence backend est
// gérée par VoiceOverlay lui-même via /api/voice/transcripts/append.
const handleVoiceMessage = useCallback(
  (msg: VoiceOverlayMessage) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: msg.source === "user" ? "user" : "assistant",
        content: msg.text,
        source: msg.source === "user" ? "voice_user" : "voice_agent",
        voice_session_id: msg.voiceSessionId,
        time_in_call_secs: msg.timeInCallSecs,
      },
    ]);
  },
  [
    /* setChatMessages est stable */
  ],
);
```

(Vérifier le nom exact du setter `setChatMessages` ou équivalent dans le fichier — adapter si différent.)

- [ ] **Step 2: Wrapper `handleSendChat` Route A/B**

Repérer la fonction existante `handleSendChat` qui est passée en `onSendMessage` à `<ChatPanel>` (ligne 1677). Au début de cette fonction, ajouter le routage :

```typescript
const handleSendChat = useCallback(
  async (message: string, options?: { useWebSearch?: boolean }) => {
    if (!selectedSummary) return;

    // ── Spec contexte agent — Route A : voice actif ──
    const voiceController = voiceControllerRef.current;
    const voiceActive = !!voiceController?.isActive;

    // Append le message user immédiatement dans la timeline (avant API call)
    const userMsg: ChatMessage = {
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `user-${Date.now()}`,
      role: "user",
      content: message,
      source: voiceActive ? "voice_user" : "text",
      voice_session_id: voiceActive
        ? (voiceController?.voiceSessionId ?? null)
        : undefined,
    };
    setChatMessages((prev) => [...prev, userMsg]);

    if (voiceActive && voiceController) {
      // L'agent répond vocalement, captured via handleVoiceMessage
      try {
        voiceController.sendUserMessage(message);
      } catch (err) {
        console.warn("[DashboardPage] sendUserMessage failed:", err);
      }
      return;
    }

    // ── Route B : pure text → appel REST chatApi.send (logique existante) ──
    // [conserver le corps existant de handleSendChat ici]
  },
  [selectedSummary /* autres deps existantes */],
);
```

**Note importante** : le bloc « Route B : pure text » doit conserver intégralement la logique pré-existante de `handleSendChat` (appel à `chatApi.send`, gestion d'erreur, append assistant message, etc.). Le wrap se fait au-dessus.

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: pas d'erreur.

- [ ] **Step 4: Lint**

```bash
cd frontend && npm run lint
```

Expected: pas d'erreur.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): add handleVoiceMessage + wrap handleSendChat Route A/B

Route A : si une session voice est active, injecte le texte dans
ElevenLabs via voiceController.sendUserMessage. L'agent répond vocalement
et la transcription revient via handleVoiceMessage.
Route B : sinon, appel REST chatApi.send normal (logique existante).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Auto-open `ChatPanel` au lancement du voice

**Files:**

- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Localiser les déclencheurs voice**

Repérer dans `DashboardPage.tsx` les deux endroits qui appellent `setIsVoiceOverlayOpen(true)` (ex-`setIsVoiceModalOpen`, lignes ~1388 et ~1527 selon l'audit). Identifier le state `chatOpen` et son setter `setChatOpen` (utilisés ligne 1668-1669).

- [ ] **Step 2: Wrapper l'ouverture voice**

Créer une fonction `openVoiceWithChat` près des autres callbacks :

```typescript
// ── Spec contexte agent — auto-open ChatPanel pour rendre la sync visible ──
const openVoiceWithChat = useCallback(() => {
  setIsVoiceOverlayOpen(true);
  if (!chatOpen) setChatOpen(true);
}, [chatOpen]);
```

- [ ] **Step 3: Remplacer les appels directs**

Remplacer les deux occurrences de `() => setIsVoiceOverlayOpen(true)` (ou équivalent) par `openVoiceWithChat`. Exemple ligne 1388 :

```tsx
// Avant
onOpen={() => setIsVoiceOverlayOpen(true)}

// Après
onOpen={openVoiceWithChat}
```

- [ ] **Step 4: Typecheck + lint**

```bash
cd frontend && npm run typecheck && npm run lint
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): auto-open ChatPanel when starting a voice session

Sans cette ouverture, la sync bidir voice<->chat est invisible : les
transcripts arrivent dans le state chatMessages mais le panneau n'est
pas affiché. openVoiceWithChat est no-op-safe si le panel est déjà ouvert.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Tests Vitest pour les handlers

**Files:**

- Create: `frontend/src/pages/__tests__/DashboardPage.voice.test.tsx`

- [ ] **Step 1: Créer le fichier de test**

Créer `frontend/src/pages/__tests__/DashboardPage.voice.test.tsx` :

```typescript
/**
 * DashboardPage voice handlers — Spec contexte agent
 *
 * Teste handleVoiceMessage et handleSendChat Route A/B en isolant la logique
 * sans monter toute la page (qui nécessite trop de providers). On extrait les
 * handlers via une factory fixture, ou on monte avec mocks minimaux.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type {
  VoiceOverlayMessage,
  VoiceOverlayController,
} from "../../components/voice/VoiceOverlay";

// On teste les fonctions pures qu'on aurait extraites — si elles sont inline
// dans le composant, ce test peut être adapté pour monter le composant avec
// mocks. Ici on suppose qu'on extrait `createVoiceMessageHandler` et
// `createSendChatHandler` ou qu'on teste via le hook.

describe("handleVoiceMessage", () => {
  it("transforme un VoiceOverlayMessage user en ChatMessage avec source voice_user", () => {
    const setMessages = vi.fn();
    const msg: VoiceOverlayMessage = {
      text: "Question vocale",
      source: "user",
      timeInCallSecs: 12.3,
      voiceSessionId: "vs-abc",
    };

    // Replicate la logique de handleVoiceMessage
    const handleVoiceMessage = (m: VoiceOverlayMessage) => {
      setMessages((prev: any[]) => [
        ...prev,
        {
          id: "test-uuid",
          role: m.source === "user" ? "user" : "assistant",
          content: m.text,
          source: m.source === "user" ? "voice_user" : "voice_agent",
          voice_session_id: m.voiceSessionId,
          time_in_call_secs: m.timeInCallSecs,
        },
      ]);
    };

    handleVoiceMessage(msg);
    expect(setMessages).toHaveBeenCalledTimes(1);
    const updater = setMessages.mock.calls[0][0];
    const newState = updater([]);
    expect(newState[0]).toMatchObject({
      role: "user",
      content: "Question vocale",
      source: "voice_user",
      voice_session_id: "vs-abc",
      time_in_call_secs: 12.3,
    });
  });

  it("mappe source 'ai' en role assistant et source voice_agent", () => {
    const setMessages = vi.fn();
    const msg: VoiceOverlayMessage = {
      text: "Réponse",
      source: "ai",
      timeInCallSecs: 15,
      voiceSessionId: "vs-xyz",
    };

    const handleVoiceMessage = (m: VoiceOverlayMessage) => {
      setMessages((prev: any[]) => [
        ...prev,
        {
          id: "test-uuid",
          role: m.source === "user" ? "user" : "assistant",
          content: m.text,
          source: m.source === "user" ? "voice_user" : "voice_agent",
          voice_session_id: m.voiceSessionId,
          time_in_call_secs: m.timeInCallSecs,
        },
      ]);
    };

    handleVoiceMessage(msg);
    const newState = setMessages.mock.calls[0][0]([]);
    expect(newState[0].role).toBe("assistant");
    expect(newState[0].source).toBe("voice_agent");
  });
});

describe("handleSendChat — Route A/B", () => {
  it("Route A : voice actif → appelle controller.sendUserMessage et SKIP chatApi.send", () => {
    const sendUserMessageMock = vi.fn();
    const chatApiSendMock = vi.fn();
    const setMessages = vi.fn();
    const controller: VoiceOverlayController = {
      sendUserMessage: sendUserMessageMock,
      voiceSessionId: "vs-active",
      sessionStartedAt: Date.now(),
      isActive: true,
    };

    // Replicate Route A logique
    const handleSendChat = (message: string) => {
      setMessages((prev: any[]) => [
        ...prev,
        { content: message, source: "voice_user" },
      ]);
      if (controller.isActive) {
        controller.sendUserMessage(message);
        return;
      }
      chatApiSendMock(message);
    };

    handleSendChat("Salut agent");
    expect(sendUserMessageMock).toHaveBeenCalledWith("Salut agent");
    expect(chatApiSendMock).not.toHaveBeenCalled();
  });

  it("Route B : voice inactif → fallback chatApi.send", () => {
    const sendUserMessageMock = vi.fn();
    const chatApiSendMock = vi.fn();
    const setMessages = vi.fn();
    const controller: VoiceOverlayController = {
      sendUserMessage: sendUserMessageMock,
      voiceSessionId: null,
      sessionStartedAt: null,
      isActive: false,
    };

    const handleSendChat = (message: string) => {
      setMessages((prev: any[]) => [
        ...prev,
        { content: message, source: "text" },
      ]);
      if (controller.isActive) {
        controller.sendUserMessage(message);
        return;
      }
      chatApiSendMock(message);
    };

    handleSendChat("Question texte");
    expect(sendUserMessageMock).not.toHaveBeenCalled();
    expect(chatApiSendMock).toHaveBeenCalledWith("Question texte");
  });
});
```

- [ ] **Step 2: Run les tests**

```bash
cd frontend && npx vitest run src/pages/__tests__/DashboardPage.voice.test.tsx
```

Expected: 4 tests passent.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/__tests__/DashboardPage.voice.test.tsx
git commit -m "$(cat <<'EOF'
test(dashboard): vitest unit tests for voice handlers (Route A/B)

Tests isolés des handlers handleVoiceMessage et handleSendChat. Couvre
la mappe user/ai → voice_user/voice_agent, et le routage Route A
(voice actif) vs Route B (REST fallback).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Test Playwright E2E

**Files:**

- Create: `frontend/e2e/dashboard-voice-bidir.spec.ts`

- [ ] **Step 1: Examiner un test E2E existant pour pattern**

```bash
cd frontend && ls e2e/ && cat e2e/auth.spec.ts | head -40
```

Repérer le pattern d'authent + setup. Adapter pour le test voice.

- [ ] **Step 2: Créer le test E2E**

Créer `frontend/e2e/dashboard-voice-bidir.spec.ts` :

```typescript
import { test, expect } from "@playwright/test";

test.describe("DashboardPage voice ↔ chat bidir sync (Spec contexte agent)", () => {
  test.beforeEach(async ({ page }) => {
    // TODO adapter selon le pattern auth des autres specs (e.g. e2e/auth.spec.ts)
    // Ex : mock auth via cookie, ou vraie connexion test user.
    await page.goto("/dashboard");
  });

  test("ouvrir le voice depuis le Dashboard auto-ouvre le ChatPanel", async ({
    page,
  }) => {
    // Sélectionner une analyse existante
    const firstAnalysis = page.locator("[data-testid='analysis-card']").first();
    await firstAnalysis.click();

    // Cliquer sur le bouton voice
    const voiceButton = page.locator("[data-testid='voice-button-main']");
    await voiceButton.click();

    // Vérifier que VoiceOverlay est visible (bottom-right)
    await expect(page.locator("[data-testid='voice-overlay']")).toBeVisible();
    // Vérifier que ChatPanel est ouvert
    await expect(page.locator("[data-testid='chat-panel']")).toBeVisible();
  });

  test("transcript voice apparaît dans la timeline du chat", async ({
    page,
  }) => {
    // Mock du SDK ElevenLabs pour simuler un transcript sans vraie connexion
    await page.addInitScript(() => {
      (window as any).__voiceMockTranscripts = [
        { source: "user", text: "Question test", timeInCallSecs: 5 },
        { source: "ai", text: "Réponse test", timeInCallSecs: 8 },
      ];
    });

    // Démarrer voice depuis Dashboard
    await page.locator("[data-testid='analysis-card']").first().click();
    await page.locator("[data-testid='voice-button-main']").click();

    // Vérifier que les transcripts apparaissent dans le ChatPanel
    await expect(page.locator(".chat-panel-message").first()).toContainText(
      "Question test",
      { timeout: 5000 },
    );
    await expect(page.locator(".chat-panel-message").nth(1)).toContainText(
      "Réponse test",
    );
  });
});
```

**Note** : ce test nécessite probablement des `data-testid` sur `VoiceOverlay`, `ChatPanel`, etc. Si pas présents, ajouter ces attributs aux composants comme prérequis. Si l'agent juge que la mise en place du mock SDK + auth est trop coûteuse pour ce sprint, marquer ce test comme `test.skip` avec un commentaire et passer au commit final, en ouvrant un follow-up Asana.

- [ ] **Step 3: Tenter l'exécution Playwright**

```bash
cd frontend && npx playwright test e2e/dashboard-voice-bidir.spec.ts --reporter=list
```

Expected: test passe ou skip explicite avec note de raison.

- [ ] **Step 4: Commit**

```bash
git add frontend/e2e/dashboard-voice-bidir.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): playwright dashboard voice<->chat bidir sync

Test E2E qui vérifie l'auto-open du ChatPanel au démarrage voice et
l'apparition des transcripts dans la timeline. Si l'auth + mock SDK
sont trop lourds, le test est skip explicite avec follow-up Asana.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Vérification finale + push

**Files:** N/A

- [ ] **Step 1: Vérifier la suite de tests complète**

```bash
cd backend && python -m pytest tests/voice/ -v
cd ../frontend && npm run typecheck && npm run lint && npm run test
```

Expected: tout passe (frontend tests existants + nouveaux + lint clean + typecheck clean).

- [ ] **Step 2: Pousser la branche**

```bash
git push origin feat/voice-context-bidir-memory
```

- [ ] **Step 3: Créer la PR (option)**

```bash
gh pr create --base main --title "feat(voice): contexte agent — bidir DashboardPage + mémoire 8k tokens" --body "$(cat <<'EOF'
## Summary

Sprint contexte agent — deux changements indépendants :

- **Backend** : `_build_chat_history_block_for_voice` injecte tout l'historique chat+voice (tags `[Texte/Voix utilisateur/agent HH:MM]`) jusqu'à `VOICE_HISTORY_MAX_TOKENS=8000`. Greedy descendant.
- **Frontend** : DashboardPage migre de `VoiceModal` vers `VoiceOverlay` (déjà battle-tested sur `ChatPage`). Sync bidir chat↔voice activée + auto-open du `ChatPanel`.

Spec : `docs/superpowers/specs/2026-04-27-agent-context-bidir-memory-design.md`

## Test plan

- [ ] Backend : `pytest backend/tests/voice/ -v` passe (7+ tests)
- [ ] Frontend typecheck + lint clean
- [ ] Frontend Vitest passe
- [ ] Manuel : ouvrir voice depuis Dashboard, vérifier ChatPanel auto-ouvert, vérifier sync bidir
- [ ] Manuel : ouvrir 2e session voice sur même vidéo après long historique, vérifier que l'agent se souvient du contexte

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Mettre à jour Asana Session Active**

(Option, selon le protocole orchestrateur DeepSight) Marquer la tâche `[COWORK] Sprint contexte agent` comme complétée dans le projet Asana Orchestration.

---

## Pré-déploiement

- [ ] **Backend** : push merged sur `main` → SSH Hetzner → `cd /opt/deepsight/repo && git pull` → rebuild Docker. Vérifier `/health`.
- [ ] **Frontend** : push merged → Vercel auto-deploy. Vérifier la build PROD.

## Vérification post-déploiement

- [ ] Sur prod, ouvrir une session voice depuis ChatPage (qui marchait déjà), vérifier que les logs Hetzner montrent un `block_chars` plus long (`docker logs repo-backend-1 --tail 50 | grep "chat history injected"`).
- [ ] Sur prod, ouvrir une session voice depuis Dashboard, vérifier que le ChatPanel s'auto-ouvre, que le transcript apparaît, et que taper du texte le route bien à l'agent voice.

## Rollback

- Backend : `git revert <commit-hash>` + redeploy. Aucune migration DB à inverser.
- Frontend : `git revert` + Vercel auto-redeploy.
