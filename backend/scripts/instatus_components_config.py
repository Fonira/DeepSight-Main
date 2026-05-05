"""Configuration des composants Instatus pour la status page publique DeepSight.

Source de vérité unique pour les 5 composants à monitorer publiquement sur
``status.deepsightsynthesis.com``. Importé par ``setup_instatus_components.py``.

Chaque composant correspond à une plateforme/service surveillé. ``health_url``
est l'endpoint utilisé par les uptime checks (Instatus monitors externes ou
UptimeRobot/Better Stack en complément). Pour Mobile/Extension, pas de
``health_url`` direct (apps client) → status maintenu manuellement ou via
webhook depuis CI.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class InstatusComponent:
    """Définition d'un composant à upserter sur Instatus.

    Attributes:
        name: Nom unique (clé de matching pour idempotence).
        description: Texte affiché sous le nom sur la status page.
        group: Groupe d'affichage (None = pas de groupe).
        health_url: URL HTTPS health check (None si client app sans endpoint).
        order: Ordre d'affichage (plus petit = en haut).
        showcase: Si True, le composant compte dans le statut global affiché en
            haut de la status page.
    """

    name: str
    description: str
    group: Optional[str] = None
    health_url: Optional[str] = None
    order: int = 0
    showcase: bool = True


# ───────────────────────────────────────────────────────────────────────────
# 5 composants à monitorer (free tier Instatus = 5 max)
# ───────────────────────────────────────────────────────────────────────────

COMPONENTS: list[InstatusComponent] = [
    InstatusComponent(
        name="API",
        description="API publique DeepSight (api.deepsightsynthesis.com)",
        group="Backend",
        health_url="https://api.deepsightsynthesis.com/health",
        order=1,
        showcase=True,
    ),
    InstatusComponent(
        name="Web",
        description="Application web (www.deepsightsynthesis.com)",
        group="Frontend",
        health_url="https://www.deepsightsynthesis.com",
        order=2,
        showcase=True,
    ),
    InstatusComponent(
        name="Mobile App",
        description="Application iOS et Android (App Store / Play Store)",
        group="Frontend",
        health_url=None,  # Pas d'endpoint direct — status manuel ou via crash reports
        order=3,
        showcase=True,
    ),
    InstatusComponent(
        name="Extension Chrome",
        description="Extension Chrome (Chrome Web Store)",
        group="Frontend",
        health_url=None,  # Pas d'endpoint direct — status manuel
        order=4,
        showcase=True,
    ),
    InstatusComponent(
        name="Database",
        description="Base de données PostgreSQL (Hetzner)",
        group="Backend",
        health_url="https://api.deepsightsynthesis.com/health/deep",
        order=5,
        showcase=True,
    ),
]


# Métadonnées partagées appliquées sur tous les composants à la création.
DEFAULT_METADATA: dict[str, str] = {
    "managed_by": "setup_instatus_components",
}


def get_component_by_name(name: str) -> Optional[InstatusComponent]:
    """Retourne le composant correspondant au nom donné (None sinon)."""
    for component in COMPONENTS:
        if component.name == name:
            return component
    return None
