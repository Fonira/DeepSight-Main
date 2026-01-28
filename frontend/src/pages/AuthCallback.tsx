/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🔐 AUTH CALLBACK v6.0 — Support tokens directs + code                             ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  FLUX SUPPORTÉS:                                                                   ║
 * ║  ✅ Tokens directs: /auth/callback?access_token=...&refresh_token=...              ║
 * ║  ✅ Code à échanger: /auth/callback?code=...&state=...                             ║
 * ║  ✅ Protection contre double exécution (React Strict Mode)                         ║
 * ║  ✅ Gestion 429 avec retry intelligent                                             ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setTokens, authApi, clearTokens } from '../services/api';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type CallbackStatus = 
  | 'initializing'
  | 'processing_tokens'
  | 'exchanging_code'
  | 'storing_tokens'
  | 'loading_profile'
  | 'success'
  | 'error'
  | 'rate_limited';

interface StatusMessage {
  title: string;
  description: string;
  icon: string;
}

const STATUS_MESSAGES: Record<CallbackStatus, StatusMessage> = {
  initializing: {
    title: 'Initialisation...',
    description: 'Préparation de la connexion',
    icon: '🔄'
  },
  processing_tokens: {
    title: 'Traitement...',
    description: 'Validation des tokens',
    icon: '🔐'
  },
  exchanging_code: {
    title: 'Authentification en cours...',
    description: 'Échange du code avec Google',
    icon: '🔐'
  },
  storing_tokens: {
    title: 'Sécurisation...',
    description: 'Enregistrement de votre session',
    icon: '💾'
  },
  loading_profile: {
    title: 'Chargement du profil...',
    description: 'Récupération de vos informations',
    icon: '👤'
  },
  success: {
    title: 'Connexion réussie!',
    description: 'Redirection en cours...',
    icon: '✅'
  },
  error: {
    title: 'Erreur de connexion',
    description: 'Veuillez réessayer',
    icon: '❌'
  },
  rate_limited: {
    title: 'Trop de requêtes',
    description: 'Nouvelle tentative...',
    icon: '⏳'
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
  } as React.CSSProperties,
  card: {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    padding: '48px',
    textAlign: 'center',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
  } as React.CSSProperties,
  icon: {
    fontSize: '48px',
    marginBottom: '16px'
  } as React.CSSProperties,
  title: {
    color: '#fff',
    fontSize: '24px',
    fontWeight: 600,
    margin: '0 0 8px 0'
  } as React.CSSProperties,
  description: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '14px',
    margin: 0
  } as React.CSSProperties,
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(255, 255, 255, 0.1)',
    borderTopColor: '#3498db',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '24px auto 0'
  } as React.CSSProperties,
  errorButton: {
    marginTop: '24px',
    padding: '12px 24px',
    background: '#3498db',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.2s'
  } as React.CSSProperties
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎬 COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [status, setStatus] = useState<CallbackStatus>('initializing');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Protection contre double exécution
  const hasProcessedRef = useRef(false);
  const retryCountRef = useRef(0);
  
  useEffect(() => {
    // Éviter double exécution (React Strict Mode)
    if (hasProcessedRef.current) {
      return;
    }
    hasProcessedRef.current = true;
    
    processCallback();
    
    async function processCallback() {
      try {
        // ═══════════════════════════════════════════════════════════════════
        // 📥 RÉCUPÉRER LES PARAMÈTRES
        // ═══════════════════════════════════════════════════════════════════
        
        // Tokens directs (envoyés par le backend après OAuth)
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        
        // Code à échanger (flux alternatif)
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        
        // Erreur OAuth
        const error = searchParams.get('error');
        
        // ═══════════════════════════════════════════════════════════════════
        // ❌ GESTION DES ERREURS
        // ═══════════════════════════════════════════════════════════════════
        
        if (error) {
          console.error('[AuthCallback] OAuth error:', error);
          setStatus('error');
          const errorMessages: Record<string, string> = {
            access_denied: 'Accès refusé. Veuillez autoriser l\'application.',
            database_error: 'Service temporairement indisponible. Veuillez réessayer.',
            token_exchange_failed: 'Échec de l\'authentification Google. Veuillez réessayer.',
            userinfo_failed: 'Impossible de récupérer vos informations Google.',
            auth_failed: 'Échec de la connexion. Veuillez réessayer.',
          };
          setErrorMessage(errorMessages[error] || `Erreur OAuth: ${error}`);
          return;
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // 🔑 FLUX 1: TOKENS DIRECTS (prioritaire)
        // Le backend a déjà échangé le code et envoie les tokens
        // ═══════════════════════════════════════════════════════════════════
        
        if (accessToken) {
          console.log('[AuthCallback] Processing direct tokens');
          setStatus('processing_tokens');
          
          // Stocker les tokens
          setStatus('storing_tokens');
          setTokens(accessToken, refreshToken || '');
          
          // Petit délai pour s'assurer que les tokens sont bien stockés
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Charger le profil
          setStatus('loading_profile');
          
          try {
            await loadProfileWithRetry();
          } catch (profileError) {
            console.warn('[AuthCallback] Profile load failed, proceeding anyway:', profileError);
          }
          
          // Succès!
          setStatus('success');
          window.dispatchEvent(new CustomEvent('auth:success'));
          
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 800);
          
          return;
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // 🔄 FLUX 2: CODE À ÉCHANGER
        // Le frontend doit échanger le code contre des tokens
        // ═══════════════════════════════════════════════════════════════════
        
        if (code) {
          console.log('[AuthCallback] Exchanging code for tokens');
          setStatus('exchanging_code');
          
          const tokens = await authApi.googleCallback(code, state || undefined);
          
          // Stocker les tokens
          setStatus('storing_tokens');
          setTokens(tokens.access_token, tokens.refresh_token);
          
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Charger le profil
          setStatus('loading_profile');
          
          try {
            await loadProfileWithRetry();
          } catch (profileError) {
            console.warn('[AuthCallback] Profile load failed, proceeding anyway:', profileError);
          }
          
          // Succès!
          setStatus('success');
          window.dispatchEvent(new CustomEvent('auth:success'));
          
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 800);
          
          return;
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // ❓ AUCUN PARAMÈTRE VALIDE
        // ═══════════════════════════════════════════════════════════════════
        
        console.error('[AuthCallback] No valid parameters found');
        setStatus('error');
        setErrorMessage('Paramètres d\'authentification manquants');
        
      } catch (err) {
        console.error('[AuthCallback] Error:', err);
        
        // Nettoyer les tokens en cas d'erreur
        clearTokens();
        
        setStatus('error');
        setErrorMessage(
          err instanceof Error 
            ? err.message 
            : 'Erreur lors de la connexion'
        );
      }
    }
    
    async function loadProfileWithRetry(): Promise<void> {
      const maxRetries = 3;
      
      while (retryCountRef.current < maxRetries) {
        try {
          await authApi.me({ skipCache: true });
          return;
        } catch (error: unknown) {
          const apiError = error as { status?: number; data?: { retry_after?: number } };
          
          if (apiError.status === 429) {
            retryCountRef.current++;
            setStatus('rate_limited');
            
            const retryAfter = apiError.data?.retry_after || 5;
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            
            setStatus('loading_profile');
            continue;
          }
          
          throw error;
        }
      }
      
      throw new Error('Échec après plusieurs tentatives');
    }
    
    return () => {
      hasProcessedRef.current = false;
    };
  }, [searchParams, navigate]);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎨 RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  
  const currentStatus = STATUS_MESSAGES[status];
  const isLoading = !['success', 'error'].includes(status);
  
  return (
    <>
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .auth-callback-btn:hover {
            background: #2980b9 !important;
          }
        `}
      </style>
      
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.icon}>
            {currentStatus.icon}
          </div>
          
          <h1 style={styles.title}>
            {currentStatus.title}
          </h1>
          
          <p style={styles.description}>
            {errorMessage || currentStatus.description}
          </p>
          
          {isLoading && (
            <div style={styles.spinner} />
          )}
          
          {status === 'error' && (
            <button 
              style={styles.errorButton}
              className="auth-callback-btn"
              onClick={() => navigate('/login', { replace: true })}
            >
              Retour à la connexion
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export default AuthCallback;
