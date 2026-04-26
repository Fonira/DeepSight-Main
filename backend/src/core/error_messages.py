"""
Traduction des messages d'erreur HTTP en français.

Utilisé par les exception handlers de main.py pour renvoyer des erreurs
localisées quand le header Accept-Language contient "fr".
"""


from fastapi import Request


# ═══════════════════════════════════════════════════════════════════════════════
# Dictionnaire de traductions EN → FR
# ═══════════════════════════════════════════════════════════════════════════════

ERROR_TRANSLATIONS_FR: dict[str, str] = {
    # --- Erreurs serveur génériques ---
    "Internal server error": "Erreur interne du serveur",
    "An unexpected error occurred": "Une erreur inattendue s'est produite",
    "Service temporarily unavailable": "Service temporairement indisponible",

    # --- Base de données ---
    "Database temporarily unavailable": "Base de données temporairement indisponible",
    "Database connection error. Please try again later.": "Erreur de connexion à la base de données. Veuillez réessayer plus tard.",
    "Request timed out. Please try again.": "La requête a expiré. Veuillez réessayer.",

    # --- Rate limiting ---
    "Rate limit exceeded": "Limite de requêtes dépassée",
    "Too many requests": "Trop de requêtes",
    "Too many requests. Please slow down.": "Trop de requêtes. Veuillez ralentir.",

    # --- Authentification ---
    "Not authenticated": "Non authentifié",
    "Could not validate credentials": "Impossible de valider les identifiants",
    "Invalid token": "Jeton invalide",
    "Token expired": "Jeton expiré",
    "Token has expired": "Le jeton a expiré",
    "Invalid or expired token": "Jeton invalide ou expiré",
    "Invalid refresh token": "Jeton de rafraîchissement invalide",
    "Refresh token expired": "Jeton de rafraîchissement expiré",
    "Invalid credentials": "Identifiants invalides",
    "Incorrect email or password": "Email ou mot de passe incorrect",
    "Email already registered": "Email déjà enregistré",
    "Email not verified": "Email non vérifié",
    "Account disabled": "Compte désactivé",
    "Invalid verification code": "Code de vérification invalide",
    "Verification code expired": "Code de vérification expiré",

    # --- Autorisation ---
    "Not authorized": "Non autorisé",
    "Forbidden": "Accès interdit",
    "Access denied": "Accès refusé",
    "Admin only": "Réservé aux administrateurs",
    "Insufficient permissions": "Permissions insuffisantes",
    "This feature requires a higher plan": "Cette fonctionnalité nécessite un abonnement supérieur",

    # --- Crédits & Quotas ---
    "Insufficient credits": "Crédits insuffisants",
    "Monthly analysis limit reached": "Limite d'analyses mensuelles atteinte",
    "Daily limit reached": "Limite quotidienne atteinte",
    "Credit limit exceeded": "Limite de crédits dépassée",
    "Not enough credits": "Pas assez de crédits",

    # --- Ressources ---
    "Not found": "Ressource introuvable",
    "Video not found": "Vidéo introuvable",
    "Summary not found": "Synthèse introuvable",
    "User not found": "Utilisateur introuvable",
    "Playlist not found": "Playlist introuvable",
    "Batch not found": "Lot introuvable",
    "Analysis not found": "Analyse introuvable",

    # --- Validation ---
    "Invalid URL": "URL invalide",
    "Invalid YouTube URL": "URL YouTube invalide",
    "Invalid video URL": "URL de vidéo invalide",
    "Video too long": "Vidéo trop longue",
    "Invalid request": "Requête invalide",
    "Missing required field": "Champ obligatoire manquant",
    "Invalid format": "Format invalide",

    # --- Billing / Stripe ---
    "Stripe not enabled": "Paiement Stripe non activé",
    "Stripe not configured": "Stripe non configuré",
    "No Stripe customer": "Aucun client Stripe associé",
    "No active subscription": "Aucun abonnement actif",
    "Subscription not found": "Abonnement introuvable",
    "Subscription is not active": "L'abonnement n'est pas actif",
    "No subscription found": "Aucun abonnement trouvé",
    "Pro plan not configured": "Le plan Pro n'est pas configuré",
    "Missing stripe-signature header": "En-tête stripe-signature manquant",
    "Invalid signature": "Signature invalide",
    "Session does not belong to current user": "La session n'appartient pas à l'utilisateur actuel",
    "Webhook secret not configured": "Secret du webhook non configuré",

    # --- Exports ---
    "Export failed": "Échec de l'export",
    "Unsupported export format": "Format d'export non pris en charge",

    # --- Chat ---
    "Chat not available": "Chat non disponible",
    "Message too long": "Message trop long",

    # --- Divers ---
    "Method not allowed": "Méthode non autorisée",
    "Conflict": "Conflit",
    "Request entity too large": "Requête trop volumineuse",
    "Unsupported media type": "Type de média non pris en charge",
    "Contact support with this error_id": "Contactez le support avec cet identifiant d'erreur",
}

# Codes HTTP standards
HTTP_STATUS_TRANSLATIONS_FR: dict[int, str] = {
    400: "Requête invalide",
    401: "Non authentifié",
    403: "Accès interdit",
    404: "Ressource introuvable",
    405: "Méthode non autorisée",
    408: "Délai d'attente dépassé",
    409: "Conflit",
    413: "Requête trop volumineuse",
    415: "Type de média non pris en charge",
    422: "Erreur de validation",
    429: "Trop de requêtes",
    500: "Erreur interne du serveur",
    502: "Erreur de passerelle",
    503: "Service temporairement indisponible",
    504: "Délai de passerelle dépassé",
}

# Pydantic / validation
VALIDATION_TRANSLATIONS_FR: dict[str, str] = {
    "value_error.missing": "Champ obligatoire",
    "value_error.any_str.min_length": "Valeur trop courte",
    "value_error.any_str.max_length": "Valeur trop longue",
    "value_error.email": "Adresse email invalide",
    "value_error.url": "URL invalide",
    "type_error.integer": "Un entier est requis",
    "type_error.float": "Un nombre est requis",
    "type_error.string": "Une chaîne de caractères est requise",
    "type_error.bool": "Un booléen est requis",
    "type_error.none.not_allowed": "La valeur ne peut pas être nulle",
    # Pydantic v2 error types
    "missing": "Champ obligatoire",
    "string_type": "Une chaîne de caractères est requise",
    "int_type": "Un entier est requis",
    "float_type": "Un nombre est requis",
    "bool_type": "Un booléen est requis",
    "url_type": "URL invalide",
    "string_too_short": "Valeur trop courte",
    "string_too_long": "Valeur trop longue",
    "value_error": "Valeur invalide",
    "json_invalid": "JSON invalide",
    "enum": "Valeur non autorisée",
    "literal_error": "Valeur non autorisée",
}


# ═══════════════════════════════════════════════════════════════════════════════
# Fonctions utilitaires
# ═══════════════════════════════════════════════════════════════════════════════

def wants_french(request: Request) -> bool:
    """Vérifie si le client préfère le français via Accept-Language."""
    accept_lang = request.headers.get("accept-language", "")
    return "fr" in accept_lang.lower()


def translate_error(message: str, lang: str = "en") -> str:
    """
    Traduit un message d'erreur si la langue est 'fr'.
    Retourne le message original pour toute autre langue.
    """
    if lang != "fr":
        return message
    return ERROR_TRANSLATIONS_FR.get(message, message)


def translate_http_status(status_code: int, lang: str = "en") -> str:
    """Retourne le message HTTP standard traduit pour un code de statut."""
    if lang != "fr":
        return ""
    return HTTP_STATUS_TRANSLATIONS_FR.get(status_code, "")


def translate_validation_error(error_type: str, lang: str = "en") -> str:
    """Traduit un type d'erreur de validation Pydantic."""
    if lang != "fr":
        return ""
    return VALIDATION_TRANSLATIONS_FR.get(error_type, "")


def get_lang(request: Request) -> str:
    """Extrait la langue préférée depuis la requête."""
    return "fr" if wants_french(request) else "en"


def translate_detail(detail: str | dict | list, lang: str) -> str | dict | list:
    """
    Traduit le champ 'detail' d'une HTTPException.
    Gère les cas où detail est une string, un dict, ou une liste (validation).
    """
    if lang != "fr":
        return detail

    if isinstance(detail, str):
        return ERROR_TRANSLATIONS_FR.get(detail, detail)

    if isinstance(detail, list):
        # Erreurs de validation Pydantic (liste de dicts)
        translated = []
        for err in detail:
            if isinstance(err, dict):
                new_err = dict(err)
                err_type = err.get("type", "")
                fr_msg = VALIDATION_TRANSLATIONS_FR.get(err_type)
                if fr_msg:
                    new_err["msg"] = fr_msg
                translated.append(new_err)
            else:
                translated.append(err)
        return translated

    if isinstance(detail, dict):
        new_detail = dict(detail)
        if "message" in new_detail and isinstance(new_detail["message"], str):
            new_detail["message"] = ERROR_TRANSLATIONS_FR.get(
                new_detail["message"], new_detail["message"]
            )
        return new_detail

    return detail
