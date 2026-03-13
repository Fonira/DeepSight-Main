/**
 * Traduction des messages d'erreur backend (anglais) vers le français.
 * Utilisé dans l'intercepteur API pour que les toasts soient toujours en FR.
 */

const ERROR_MAP: Record<string, string> = {
  // Database / Infra
  'database temporarily unavailable': 'Base de données temporairement indisponible. Réessayez dans quelques instants.',
  'internal server error': 'Erreur interne du serveur',
  'service unavailable': 'Service temporairement indisponible',

  // Rate limiting
  'rate limit exceeded': 'Trop de requêtes, veuillez patienter',
  'too many requests': 'Trop de requêtes, veuillez patienter',

  // Auth
  'unauthorized': 'Session expirée, veuillez vous reconnecter',
  'not authenticated': 'Session expirée, veuillez vous reconnecter',
  'invalid credentials': 'Identifiants invalides',
  'invalid email or password': 'Email ou mot de passe incorrect',
  'email already registered': 'Cet email est déjà utilisé',
  'email not verified': 'Veuillez vérifier votre email avant de vous connecter',
  'invalid verification code': 'Code de vérification invalide',
  'verification code expired': 'Code de vérification expiré',

  // Not found
  'not found': 'Ressource introuvable',

  // Network
  'network error': 'Erreur de connexion réseau',
  'failed to fetch': 'Erreur de connexion réseau',
  'request timeout': 'Délai de connexion dépassé',
  'load failed': 'Erreur de connexion réseau',

  // Credits / Plans
  'insufficient credits': 'Crédits insuffisants',
  'not enough credits': 'Crédits insuffisants',
  'credits exhausted': 'Crédits épuisés',

  // Video analysis
  'video too long': 'Vidéo trop longue pour votre plan',
  'video not found': 'Vidéo introuvable',
  'analysis failed': "L'analyse a échoué, veuillez réessayer",
  'transcript not available': 'Transcription indisponible pour cette vidéo',
  'no transcript found': 'Aucune transcription trouvée pour cette vidéo',
  'transcript extraction failed': "Impossible d'extraire la transcription",

  // Export
  'export failed': "L'export a échoué, veuillez réessayer",

  // Generic
  'forbidden': 'Accès refusé',
  'bad request': 'Requête invalide',
};

/**
 * Traduit un message d'erreur API anglais en français.
 * Matching insensible à la casse. Retourne le message original si aucun match.
 */
export function translateApiError(message: string): string {
  if (!message) return message;

  const normalized = message.toLowerCase().trim();

  // Exact match
  if (ERROR_MAP[normalized]) {
    return ERROR_MAP[normalized];
  }

  // Partial match — cherche si le message contient une clé connue
  for (const [key, translation] of Object.entries(ERROR_MAP)) {
    if (normalized.includes(key)) {
      return translation;
    }
  }

  // HTTP status prefix pattern: "HTTP 500", "HTTP 503" etc.
  if (/^http \d{3}$/.test(normalized)) {
    const code = parseInt(normalized.split(' ')[1], 10);
    if (code >= 500) return 'Erreur serveur, veuillez réessayer';
    if (code === 429) return 'Trop de requêtes, veuillez patienter';
    if (code === 404) return 'Ressource introuvable';
    if (code === 403) return 'Accès refusé';
    if (code === 401) return 'Session expirée, veuillez vous reconnecter';
    if (code === 400) return 'Requête invalide';
  }

  return message;
}
