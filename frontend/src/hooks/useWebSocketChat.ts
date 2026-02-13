/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  💬 useWebSocketChat — Hook React pour Chat Temps Réel                             ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  FONCTIONNALITÉS:                                                                  ║
 * ║  • 🔌 Connexion WebSocket avec reconnexion auto                                   ║
 * ║  • 📝 Streaming token par token                                                   ║
 * ║  • 💾 Historique des messages                                                     ║
 * ║  • 📊 Typing indicators                                                           ║
 * ║  • 🔄 Optimistic updates                                                          ║
 * ║  • ♿ Accessible                                                                   ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export type EnrichmentLevel = 'none' | 'light' | 'full' | 'deep';

export interface ChatSource {
  url: string;
  title: string;
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  sources?: ChatSource[];
  enrichmentLevel?: EnrichmentLevel;
  createdAt: Date;
  error?: string;
}

export interface WebSocketChatState {
  status: ConnectionStatus;
  sessionId: string | null;
  messages: ChatMessage[];
  isTyping: boolean;
  remoteTyping: boolean;
  currentStreamingMessage: string | null;
  error: string | null;
}

export interface WebSocketChatActions {
  sendMessage: (content: string, enrichment?: EnrichmentLevel) => void;
  startTyping: () => void;
  stopTyping: () => void;
  reconnect: () => void;
  clearMessages: () => void;
  disconnect: () => void;
}

export interface UseWebSocketChatOptions {
  summaryId: number;
  autoConnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  onMessage?: (message: ChatMessage) => void;
  onError?: (error: string) => void;
  onConnect?: (sessionId: string) => void;
  onDisconnect?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 
  `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

const MESSAGE_TYPES = {
  // Client -> Server
  CHAT_MESSAGE: 'chat_message',
  TYPING_START: 'typing_start',
  TYPING_STOP: 'typing_stop',
  PING: 'ping',
  
  // Server -> Client
  CONNECTED: 'connected',
  CHAT_TOKEN: 'chat_token',
  CHAT_COMPLETE: 'chat_complete',
  CHAT_ERROR: 'chat_error',
  TYPING_INDICATOR: 'typing_indicator',
  SOURCE_CITATION: 'source_citation',
  PONG: 'pong',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useWebSocketChat(
  options: UseWebSocketChatOptions
): [WebSocketChatState, WebSocketChatActions] {
  const {
    summaryId,
    autoConnect = true,
    maxReconnectAttempts = 5,
    reconnectInterval = 3000,
    onMessage,
    onError,
    onConnect,
    onDisconnect,
  } = options;
  
  // State
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamingContentRef = useRef<Map<string, string>>(new Map());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔌 CONNECTION
  // ═══════════════════════════════════════════════════════════════════════════
  
  const connect = useCallback(() => {
    // Nettoyer la connexion existante
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus('connecting');
    setError(null);

    // Récupérer le JWT pour l'authentification WebSocket
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      setStatus('error');
      setError('Non authentifié. Veuillez vous reconnecter.');
      onError?.('Non authentifié. Veuillez vous reconnecter.');
      return;
    }

    const wsUrl = `${WS_BASE_URL}/ws/chat/${summaryId}?token=${encodeURIComponent(accessToken)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      setStatus('connected');
      reconnectAttemptsRef.current = 0;
      
      // Démarrer le ping/pong
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: MESSAGE_TYPES.PING }));
        }
      }, 30000);
    };
    
    ws.onclose = (event) => {
      setStatus('disconnected');
      setSessionId(null);

      // Nettoyer les intervals
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }

      onDisconnect?.();

      // Ne PAS reconnecter si erreur d'authentification (4001, 4003)
      const isAuthError = event.code === 4001 || event.code === 4003;
      if (isAuthError) {
        setStatus('error');
        setError(event.reason || 'Erreur d\'authentification WebSocket');
        onError?.(event.reason || 'Erreur d\'authentification WebSocket');
        return;
      }

      // Reconnexion automatique si pas fermé volontairement
      if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, reconnectInterval * reconnectAttemptsRef.current);
      }
    };
    
    ws.onerror = (event) => {
      console.error('❌ [WS] Error:', event);
      setStatus('error');
      setError('Erreur de connexion WebSocket');
      onError?.('Erreur de connexion WebSocket');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMessage(data);
      } catch (e) {
        console.error('❌ [WS] Parse error:', e);
      }
    };
  }, [summaryId, maxReconnectAttempts, reconnectInterval, onDisconnect, onError]);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 📨 MESSAGE HANDLING
  // ═══════════════════════════════════════════════════════════════════════════
  
  const handleMessage = useCallback((data: any) => {
    switch (data.type) {
      case MESSAGE_TYPES.CONNECTED:
        setSessionId(data.session_id);
        onConnect?.(data.session_id);
        break;
      
      case MESSAGE_TYPES.CHAT_TOKEN: {
        const { message_id, token } = data;
        
        // Accumuler le contenu du streaming
        const currentContent = streamingContentRef.current.get(message_id) || '';
        const newContent = currentContent + token;
        streamingContentRef.current.set(message_id, newContent);
        
        setCurrentStreamingMessage(message_id);
        
        // Mettre à jour le message en streaming
        setMessages(prev => {
          const existingIndex = prev.findIndex(m => m.id === message_id);
          
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              content: newContent,
            };
            return updated;
          }
          
          // Créer un nouveau message assistant
          return [...prev, {
            id: message_id,
            role: 'assistant',
            content: newContent,
            isStreaming: true,
            createdAt: new Date(),
          }];
        });
        break;
      }
      
      case MESSAGE_TYPES.CHAT_COMPLETE: {
        const { message_id, content, sources } = data;
        
        streamingContentRef.current.delete(message_id);
        setCurrentStreamingMessage(null);
        
        setMessages(prev => {
          const existingIndex = prev.findIndex(m => m.id === message_id);
          
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              content,
              isStreaming: false,
              sources,
            };
            
            onMessage?.(updated[existingIndex]);
            return updated;
          }
          
          const newMessage: ChatMessage = {
            id: message_id,
            role: 'assistant',
            content,
            isStreaming: false,
            sources,
            createdAt: new Date(),
          };
          
          onMessage?.(newMessage);
          return [...prev, newMessage];
        });
        break;
      }
      
      case MESSAGE_TYPES.CHAT_ERROR: {
        const { message_id, error: errorMsg } = data;
        
        streamingContentRef.current.delete(message_id);
        setCurrentStreamingMessage(null);
        
        setMessages(prev => {
          const existingIndex = prev.findIndex(m => m.id === message_id);
          
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              isStreaming: false,
              error: errorMsg,
            };
            return updated;
          }
          
          return [...prev, {
            id: message_id,
            role: 'assistant',
            content: '',
            isStreaming: false,
            error: errorMsg,
            createdAt: new Date(),
          }];
        });
        
        setError(errorMsg);
        onError?.(errorMsg);
        break;
      }
      
      case MESSAGE_TYPES.SOURCE_CITATION: {
        const { message_id, sources } = data;
        
        setMessages(prev => {
          const existingIndex = prev.findIndex(m => m.id === message_id);
          
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              sources,
            };
            return updated;
          }
          
          return prev;
        });
        break;
      }
      
      case MESSAGE_TYPES.TYPING_INDICATOR:
        setRemoteTyping(data.is_typing);
        break;
      
      case MESSAGE_TYPES.PONG:
        // Heartbeat reçu
        break;
      
      default:
        break;
    }
  }, [onConnect, onMessage, onError]);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 📤 ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  
  const sendMessage = useCallback((content: string, enrichment: EnrichmentLevel = 'light') => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Non connecté au serveur');
      return;
    }
    
    const trimmedContent = content.trim();
    if (!trimmedContent) return;
    
    // Ajouter le message utilisateur immédiatement (optimistic update)
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedContent,
      enrichmentLevel: enrichment,
      createdAt: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(false);
    
    // Envoyer au serveur
    wsRef.current.send(JSON.stringify({
      type: MESSAGE_TYPES.CHAT_MESSAGE,
      content: trimmedContent,
      enrichment,
    }));
  }, []);
  
  const startTyping = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    if (!isTyping) {
      setIsTyping(true);
      wsRef.current.send(JSON.stringify({ type: MESSAGE_TYPES.TYPING_START }));
    }
    
    // Reset du timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [isTyping]);
  
  const stopTyping = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    if (isTyping) {
      setIsTyping(false);
      wsRef.current.send(JSON.stringify({ type: MESSAGE_TYPES.TYPING_STOP }));
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [isTyping]);
  
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);
  
  const clearMessages = useCallback(() => {
    setMessages([]);
    streamingContentRef.current.clear();
    setCurrentStreamingMessage(null);
  }, []);
  
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect');
      wsRef.current = null;
    }
    
    setStatus('disconnected');
  }, []);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔄 LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [autoConnect, summaryId]); // Reconnecter si summaryId change
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 📦 RETURN
  // ═══════════════════════════════════════════════════════════════════════════
  
  const state: WebSocketChatState = useMemo(() => ({
    status,
    sessionId,
    messages,
    isTyping,
    remoteTyping,
    currentStreamingMessage,
    error,
  }), [status, sessionId, messages, isTyping, remoteTyping, currentStreamingMessage, error]);
  
  const actions: WebSocketChatActions = useMemo(() => ({
    sendMessage,
    startTyping,
    stopTyping,
    reconnect,
    clearMessages,
    disconnect,
  }), [sendMessage, startTyping, stopTyping, reconnect, clearMessages, disconnect]);
  
  return [state, actions];
}

export default useWebSocketChat;

// ═══════════════════════════════════════════════════════════════════════════════
// 🧩 UTILITY HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook pour afficher le statut de connexion avec un texte localisé
 */
export function useConnectionStatusText(
  status: ConnectionStatus,
  lang: 'fr' | 'en' = 'fr'
): { text: string; color: string } {
  return useMemo(() => {
    const texts: Record<ConnectionStatus, { fr: string; en: string; color: string }> = {
      connecting: { fr: 'Connexion...', en: 'Connecting...', color: 'text-yellow-500' },
      connected: { fr: 'Connecté', en: 'Connected', color: 'text-green-500' },
      disconnected: { fr: 'Déconnecté', en: 'Disconnected', color: 'text-gray-500' },
      error: { fr: 'Erreur', en: 'Error', color: 'text-red-500' },
    };
    
    const config = texts[status];
    return {
      text: config[lang],
      color: config.color,
    };
  }, [status, lang]);
}

/**
 * Hook pour scroll automatique vers le dernier message
 */
export function useAutoScroll(
  messages: ChatMessage[],
  containerRef: React.RefObject<HTMLElement>
) {
  useEffect(() => {
    if (containerRef.current && messages.length > 0) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages.length, containerRef]);
}
