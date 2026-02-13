"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🛡️ SANITIZATION UTILITIES — Protection XSS et injection                          ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Fonctions pour nettoyer les entrées utilisateur avant stockage                   ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import re
import html
from typing import Optional


def sanitize_html(text: Optional[str], max_length: int = 10000) -> str:
    """
    Nettoie un texte pour empêcher les attaques XSS.

    - Échappe les caractères HTML dangereux
    - Supprime les balises script
    - Limite la longueur

    Args:
        text: Texte à nettoyer
        max_length: Longueur maximale autorisée

    Returns:
        Texte nettoyé
    """
    if not text:
        return ""

    # Limiter la longueur
    text = text[:max_length]

    # Supprimer les balises script et leur contenu
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.IGNORECASE | re.DOTALL)

    # Supprimer les event handlers (onclick, onerror, etc.)
    text = re.sub(r'\s+on\w+\s*=\s*["\'][^"\']*["\']', '', text, flags=re.IGNORECASE)

    # Supprimer les urls javascript:
    text = re.sub(r'javascript:', '', text, flags=re.IGNORECASE)

    # Supprimer les data: urls potentiellement dangereux
    text = re.sub(r'data:text/html', '', text, flags=re.IGNORECASE)

    # Échapper les caractères HTML
    text = html.escape(text)

    return text


def sanitize_text(text: Optional[str], max_length: int = 5000) -> str:
    """
    Nettoie un texte simple (notes, tags, etc.).

    Moins strict que sanitize_html car ces champs ne sont pas
    rendus comme HTML dans le frontend.

    Args:
        text: Texte à nettoyer
        max_length: Longueur maximale

    Returns:
        Texte nettoyé
    """
    if not text:
        return ""

    # Limiter la longueur
    text = text[:max_length]

    # Supprimer les caractères de contrôle (sauf newlines et tabs)
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)

    # Normaliser les sauts de ligne
    text = text.replace('\r\n', '\n').replace('\r', '\n')

    return text.strip()


def sanitize_username(username: str) -> str:
    """
    Nettoie un nom d'utilisateur.

    - Supprime les caractères non alphanumériques (sauf _ et -)
    - Convertit en minuscules
    - Limite à 50 caractères
    """
    if not username:
        return ""

    # Garder seulement lettres, chiffres, underscores et tirets
    username = re.sub(r'[^a-zA-Z0-9_-]', '', username)

    # Convertir en minuscules
    username = username.lower()

    # Limiter la longueur
    return username[:50]


def sanitize_email(email: str) -> str:
    """
    Nettoie une adresse email.

    - Supprime les espaces
    - Convertit en minuscules
    - Vérifie le format basique
    """
    if not email:
        return ""

    email = email.strip().lower()

    # Validation basique du format
    if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
        return ""

    return email[:255]


def sanitize_url(url: str) -> str:
    """
    Nettoie une URL.

    - Supprime les protocoles dangereux (javascript:, data:)
    - Vérifie que c'est une URL http(s) ou youtube
    """
    if not url:
        return ""

    url = url.strip()

    # Supprimer les espaces encodés
    url = url.replace('%20', ' ').strip()

    # Vérifier le protocole
    url_lower = url.lower()
    if url_lower.startswith('javascript:') or url_lower.startswith('data:'):
        return ""

    # Autoriser http, https, et les URLs relatives
    if not (url_lower.startswith('http://') or
            url_lower.startswith('https://') or
            url_lower.startswith('/')):
        # Ajouter https:// par défaut si c'est une URL YouTube
        if 'youtube.com' in url_lower or 'youtu.be' in url_lower:
            url = 'https://' + url

    return url[:2000]


def sanitize_json_string(text: Optional[str], max_length: int = 50000) -> str:
    """
    Nettoie une chaîne destinée à être stockée en JSON.

    - Échappe les caractères spéciaux JSON
    - Supprime les caractères de contrôle
    """
    if not text:
        return ""

    text = text[:max_length]

    # Supprimer les caractères de contrôle problématiques pour JSON
    text = re.sub(r'[\x00-\x1f\x7f]', lambda m: f'\\u{ord(m.group()):04x}', text)

    return text
