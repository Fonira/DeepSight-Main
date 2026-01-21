"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  💬 WEBSOCKET CHAT SERVICE v2.0 — Chat Temps Réel avec Perplexity                  ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  FONCTIONNALITÉS:                                                                  ║
║  • 🔌 WebSocket bidirectionnel                                                     ║
║  • 📝 Streaming token par token                                                    ║
║  • 🌐 Enrichissement web Perplexity                                                ║
║  • 💾 Persistance des messages                                                     ║
║  • 🔄 Reconnexion automatique                                                      ║
║  • 📊 Typing indicators                                                            ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import json
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional, List, Set
from dataclasses import dataclass, field
from enum import Enum
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.websockets import WebSocketState
from pydantic import BaseModel

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 TYPES & ENUMS
# ═══════════════════════════════════════════════════════════════════════════════

class MessageType(str, Enum):
    # Client -> Server
    CHAT_MESSAGE = "chat_message"
    TYPING_START = "typing_start"
    TYPING_STOP = "typing_stop"
    PING = "ping"
    
    # Server -> Client
    CHAT_RESPONSE = "chat_response"
    CHAT_TOKEN = "chat_token"
    CHAT_COMPLETE = "chat_complete"
    CHAT_ERROR = "chat_error"
    TYPING_INDICATOR = "typing_indicator"
    PONG = "pong"
    CONNECTED = "connected"
    SOURCE_CITATION = "source_citation"


class EnrichmentLevel(str, Enum):
    NONE = "none"
    LIGHT = "light"
    FULL = "full"
    DEEP = "deep"


@dataclass
class ChatMessage:
    """Message de chat"""
    id: str
    role: str  # "user" | "assistant"
    content: str
    created_at: datetime
    sources: List[Dict[str, Any]] = field(default_factory=list)
    enrichment_level: EnrichmentLevel = EnrichmentLevel.NONE
    tokens_used: int = 0


@dataclass
class ChatSession:
    """Session de chat pour un utilisateur"""
    session_id: str
    user_id: int
    summary_id: int
    websocket: WebSocket
    messages: List[ChatMessage] = field(default_factory=list)
    is_typing: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_activity: datetime = field(default_factory=datetime.utcnow)
    
    def update_activity(self):
        self.last_activity = datetime.utcnow()


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONNECTION MANAGER
# ═══════════════════════════════════════════════════════════════════════════════

class ConnectionManager:
    """
    Gestionnaire de connexions WebSocket.
    Gère les sessions de chat et la communication.
    """
    
    def __init__(self):
        # session_id -> ChatSession
        self.sessions: Dict[str, ChatSession] = {}
        # user_id -> Set[session_id]
        self.user_sessions: Dict[int, Set[str]] = {}
        # summary_id -> Set[session_id] (pour les sessions partagées)
        self.summary_sessions: Dict[int, Set[str]] = {}
        # Lock pour les opérations concurrentes
        self._lock = asyncio.Lock()
    
    async def connect(
        self, 
        websocket: WebSocket, 
        user_id: int, 
        summary_id: int
    ) -> ChatSession:
        """Connecte un nouveau client WebSocket"""
        await websocket.accept()
        
        session_id = str(uuid.uuid4())
        session = ChatSession(
            session_id=session_id,
            user_id=user_id,
            summary_id=summary_id,
            websocket=websocket,
        )
        
        async with self._lock:
            self.sessions[session_id] = session
            
            if user_id not in self.user_sessions:
                self.user_sessions[user_id] = set()
            self.user_sessions[user_id].add(session_id)
            
            if summary_id not in self.summary_sessions:
                self.summary_sessions[summary_id] = set()
            self.summary_sessions[summary_id].add(session_id)
        
        # Envoyer confirmation de connexion
        await self.send_message(session_id, {
            "type": MessageType.CONNECTED,
            "session_id": session_id,
            "timestamp": datetime.utcnow().isoformat(),
        })
        
        print(f"🔌 [WS] Connected: user={user_id}, summary={summary_id}, session={session_id}", flush=True)
        return session
    
    async def disconnect(self, session_id: str):
        """Déconnecte un client WebSocket"""
        async with self._lock:
            session = self.sessions.pop(session_id, None)
            if session:
                # Nettoyer les références
                if session.user_id in self.user_sessions:
                    self.user_sessions[session.user_id].discard(session_id)
                    if not self.user_sessions[session.user_id]:
                        del self.user_sessions[session.user_id]
                
                if session.summary_id in self.summary_sessions:
                    self.summary_sessions[session.summary_id].discard(session_id)
                    if not self.summary_sessions[session.summary_id]:
                        del self.summary_sessions[session.summary_id]
                
                print(f"🔌 [WS] Disconnected: session={session_id}", flush=True)
    
    async def send_message(self, session_id: str, message: Dict[str, Any]):
        """Envoie un message à une session spécifique"""
        session = self.sessions.get(session_id)
        if session and session.websocket.client_state == WebSocketState.CONNECTED:
            try:
                await session.websocket.send_json(message)
                session.update_activity()
            except Exception as e:
                print(f"❌ [WS] Send error: {e}", flush=True)
                await self.disconnect(session_id)
    
    async def send_token(self, session_id: str, token: str, message_id: str):
        """Envoie un token de streaming"""
        await self.send_message(session_id, {
            "type": MessageType.CHAT_TOKEN,
            "message_id": message_id,
            "token": token,
            "timestamp": datetime.utcnow().isoformat(),
        })
    
    async def broadcast_to_summary(
        self, 
        summary_id: int, 
        message: Dict[str, Any],
        exclude_session: Optional[str] = None
    ):
        """Broadcast un message à toutes les sessions d'un résumé"""
        session_ids = self.summary_sessions.get(summary_id, set()).copy()
        for session_id in session_ids:
            if session_id != exclude_session:
                await self.send_message(session_id, message)
    
    def get_session(self, session_id: str) -> Optional[ChatSession]:
        """Récupère une session"""
        return self.sessions.get(session_id)
    
    def get_active_sessions_count(self) -> int:
        """Nombre de sessions actives"""
        return len(self.sessions)
    
    async def cleanup_stale_sessions(self, max_age_seconds: int = 3600):
        """Nettoie les sessions inactives"""
        now = datetime.utcnow()
        stale_sessions = []
        
        for session_id, session in self.sessions.items():
            age = (now - session.last_activity).total_seconds()
            if age > max_age_seconds:
                stale_sessions.append(session_id)
        
        for session_id in stale_sessions:
            await self.disconnect(session_id)
        
        if stale_sessions:
            print(f"🧹 [WS] Cleaned {len(stale_sessions)} stale sessions", flush=True)


# Singleton
manager = ConnectionManager()

# ═══════════════════════════════════════════════════════════════════════════════
# 🤖 CHAT SERVICE
# ═══════════════════════════════════════════════════════════════════════════════

class ChatService:
    """
    Service de chat avec streaming et enrichissement web.
    """
    
    def __init__(self):
        self.manager = manager
    
    async def process_message(
        self,
        session: ChatSession,
        content: str,
        enrichment_level: EnrichmentLevel = EnrichmentLevel.LIGHT,
    ) -> str:
        """
        Traite un message utilisateur et génère une réponse en streaming.
        
        Args:
            session: Session de chat
            content: Message de l'utilisateur
            enrichment_level: Niveau d'enrichissement web
            
        Returns:
            ID du message de réponse
        """
        message_id = str(uuid.uuid4())
        
        try:
            # 1. Sauvegarder le message utilisateur
            user_message = ChatMessage(
                id=str(uuid.uuid4()),
                role="user",
                content=content,
                created_at=datetime.utcnow(),
            )
            session.messages.append(user_message)
            
            # 2. Notifier que l'assistant tape
            await self.manager.send_message(session.session_id, {
                "type": MessageType.TYPING_INDICATOR,
                "is_typing": True,
            })
            
            # 3. Construire le contexte
            context = await self._build_context(session)
            
            # 4. Enrichissement web si demandé
            web_context = None
            sources = []
            
            if enrichment_level != EnrichmentLevel.NONE:
                web_result = await self._enrich_with_web(
                    query=content,
                    level=enrichment_level,
                )
                if web_result:
                    web_context = web_result.get("context", "")
                    sources = web_result.get("sources", [])
                    
                    # Envoyer les sources
                    if sources:
                        await self.manager.send_message(session.session_id, {
                            "type": MessageType.SOURCE_CITATION,
                            "message_id": message_id,
                            "sources": sources,
                        })
            
            # 5. Générer la réponse en streaming
            full_response = ""
            
            async for token in self._generate_response_stream(
                context=context,
                user_message=content,
                web_context=web_context,
            ):
                full_response += token
                await self.manager.send_token(session.session_id, token, message_id)
            
            # 6. Sauvegarder la réponse
            assistant_message = ChatMessage(
                id=message_id,
                role="assistant",
                content=full_response,
                created_at=datetime.utcnow(),
                sources=sources,
                enrichment_level=enrichment_level,
            )
            session.messages.append(assistant_message)
            
            # 7. Notifier la fin
            await self.manager.send_message(session.session_id, {
                "type": MessageType.CHAT_COMPLETE,
                "message_id": message_id,
                "content": full_response,
                "sources": sources,
                "tokens_used": len(full_response.split()),
            })
            
            await self.manager.send_message(session.session_id, {
                "type": MessageType.TYPING_INDICATOR,
                "is_typing": False,
            })
            
            # 8. Persister dans la DB (async)
            asyncio.create_task(self._persist_messages(session, [user_message, assistant_message]))
            
            return message_id
            
        except Exception as e:
            print(f"❌ [CHAT] Error: {e}", flush=True)
            
            await self.manager.send_message(session.session_id, {
                "type": MessageType.CHAT_ERROR,
                "message_id": message_id,
                "error": str(e),
            })
            
            await self.manager.send_message(session.session_id, {
                "type": MessageType.TYPING_INDICATOR,
                "is_typing": False,
            })
            
            raise
    
    async def _build_context(self, session: ChatSession) -> str:
        """Construit le contexte pour la génération"""
        # Récupérer le résumé de la vidéo
        from db.database import Summary
        from sqlalchemy import select
        from db.database import async_session_maker
        
        async with async_session_maker() as db:
            result = await db.execute(
                select(Summary).where(Summary.id == session.summary_id)
            )
            summary = result.scalar_one_or_none()
        
        if not summary:
            return ""
        
        # Construire le contexte avec l'historique récent
        context_parts = [
            f"# Contexte de la vidéo",
            f"Titre: {summary.video_title}",
            f"Chaîne: {summary.video_channel}",
            f"",
            f"## Résumé",
            summary.summary_content[:3000],
            f"",
            f"## Historique de conversation récent",
        ]
        
        # Ajouter les 10 derniers messages
        recent_messages = session.messages[-10:]
        for msg in recent_messages:
            role_label = "Utilisateur" if msg.role == "user" else "Assistant"
            context_parts.append(f"{role_label}: {msg.content[:500]}")
        
        return "\n".join(context_parts)
    
    async def _enrich_with_web(
        self, 
        query: str, 
        level: EnrichmentLevel
    ) -> Optional[Dict[str, Any]]:
        """Enrichit la réponse avec une recherche web via Perplexity"""
        import httpx
        import os
        
        api_key = os.environ.get("PERPLEXITY_API_KEY")
        if not api_key:
            return None
        
        # Configurer le niveau de recherche
        search_config = {
            EnrichmentLevel.LIGHT: {"search_domain_filter": [], "search_recency_filter": "week"},
            EnrichmentLevel.FULL: {"search_domain_filter": [], "search_recency_filter": "month"},
            EnrichmentLevel.DEEP: {"search_domain_filter": [], "search_recency_filter": "year"},
        }
        
        config = search_config.get(level, search_config[EnrichmentLevel.LIGHT])
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.perplexity.ai/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "llama-3.1-sonar-small-128k-online",
                        "messages": [
                            {
                                "role": "system",
                                "content": "Tu es un assistant de recherche. Fournis des informations factuelles et cite tes sources."
                            },
                            {
                                "role": "user",
                                "content": query
                            }
                        ],
                        "return_citations": True,
                        **config,
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    citations = data.get("citations", [])
                    
                    return {
                        "context": content,
                        "sources": [
                            {"url": c, "title": c.split("/")[-1] if "/" in c else c}
                            for c in citations[:5]
                        ],
                    }
        except Exception as e:
            print(f"⚠️ [CHAT] Web enrichment failed: {e}", flush=True)
        
        return None
    
    async def _generate_response_stream(
        self,
        context: str,
        user_message: str,
        web_context: Optional[str] = None,
    ):
        """Génère une réponse en streaming via Mistral"""
        import httpx
        import os
        
        api_key = os.environ.get("MISTRAL_API_KEY")
        if not api_key:
            yield "Erreur: API Mistral non configurée"
            return
        
        # Construire le prompt
        system_prompt = """Tu es un assistant intelligent qui aide à comprendre et analyser des vidéos YouTube.
Tu réponds de manière concise, précise et utile.
Si tu cites des informations web, mentionne-le clairement."""
        
        messages = [
            {"role": "system", "content": system_prompt},
        ]
        
        if context:
            messages.append({"role": "user", "content": f"Contexte:\n{context}"})
            messages.append({"role": "assistant", "content": "J'ai bien compris le contexte. Comment puis-je vous aider?"})
        
        if web_context:
            user_message = f"{user_message}\n\nInformations web récentes:\n{web_context}"
        
        messages.append({"role": "user", "content": user_message})
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST",
                    "https://api.mistral.ai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "mistral-small-latest",
                        "messages": messages,
                        "stream": True,
                        "max_tokens": 2000,
                        "temperature": 0.7,
                    }
                ) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            if data == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data)
                                token = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                if token:
                                    yield token
                            except json.JSONDecodeError:
                                continue
        except Exception as e:
            print(f"❌ [CHAT] Generation error: {e}", flush=True)
            yield f"\n\n[Erreur de génération: {str(e)}]"
    
    async def _persist_messages(self, session: ChatSession, messages: List[ChatMessage]):
        """Persiste les messages dans la base de données"""
        from db.database import ChatMessage as DBChatMessage
        from db.database import async_session_maker
        
        try:
            async with async_session_maker() as db:
                for msg in messages:
                    db_msg = DBChatMessage(
                        summary_id=session.summary_id,
                        user_id=session.user_id,
                        role=msg.role,
                        content=msg.content,
                        sources_json=json.dumps(msg.sources) if msg.sources else None,
                        enrichment_level=msg.enrichment_level.value,
                    )
                    db.add(db_msg)
                await db.commit()
        except Exception as e:
            print(f"⚠️ [CHAT] Persist error: {e}", flush=True)


# Singleton
chat_service = ChatService()

# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 ROUTER
# ═══════════════════════════════════════════════════════════════════════════════

router = APIRouter(prefix="/ws", tags=["websocket"])


@router.websocket("/chat/{summary_id}")
async def websocket_chat(
    websocket: WebSocket,
    summary_id: int,
):
    """
    WebSocket endpoint pour le chat en temps réel.
    
    Messages client -> serveur:
    - {"type": "chat_message", "content": "...", "enrichment": "none|light|full|deep"}
    - {"type": "typing_start"}
    - {"type": "typing_stop"}
    - {"type": "ping"}
    
    Messages serveur -> client:
    - {"type": "connected", "session_id": "..."}
    - {"type": "chat_token", "message_id": "...", "token": "..."}
    - {"type": "chat_complete", "message_id": "...", "content": "...", "sources": [...]}
    - {"type": "chat_error", "message_id": "...", "error": "..."}
    - {"type": "typing_indicator", "is_typing": true|false}
    - {"type": "source_citation", "message_id": "...", "sources": [...]}
    - {"type": "pong"}
    """
    # TODO: Extraire user_id du token JWT
    user_id = 1  # Placeholder
    
    session = await manager.connect(websocket, user_id, summary_id)
    
    try:
        while True:
            # Recevoir un message
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == MessageType.CHAT_MESSAGE:
                content = data.get("content", "").strip()
                if content:
                    enrichment = EnrichmentLevel(data.get("enrichment", "light"))
                    await chat_service.process_message(session, content, enrichment)
            
            elif msg_type == MessageType.TYPING_START:
                # Broadcast aux autres sessions du même résumé
                await manager.broadcast_to_summary(
                    summary_id,
                    {"type": MessageType.TYPING_INDICATOR, "user_id": user_id, "is_typing": True},
                    exclude_session=session.session_id,
                )
            
            elif msg_type == MessageType.TYPING_STOP:
                await manager.broadcast_to_summary(
                    summary_id,
                    {"type": MessageType.TYPING_INDICATOR, "user_id": user_id, "is_typing": False},
                    exclude_session=session.session_id,
                )
            
            elif msg_type == MessageType.PING:
                await manager.send_message(session.session_id, {"type": MessageType.PONG})
            
            session.update_activity()
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"❌ [WS] Error: {e}", flush=True)
    finally:
        await manager.disconnect(session.session_id)


@router.get("/sessions/count")
async def get_sessions_count():
    """Retourne le nombre de sessions WebSocket actives"""
    return {"active_sessions": manager.get_active_sessions_count()}
