"""Jinja2 HTML rendering for aggregator pages (channel + category).

Produces standalone styled pages indexable by AI bots and Google. Uses the
shared `templates/share/base.html` layout for visual consistency with the
share pages, plus dedicated `templates/aggregate/*.html` content blocks.
"""

from __future__ import annotations

import os
from typing import Sequence

from jinja2 import Environment, FileSystemLoader, select_autoescape

from aggregate.queries import (
    AnalysisRef,
    CategoryInfo,
    ChannelInfo,
)


_TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")

_env = Environment(
    loader=FileSystemLoader(_TEMPLATES_DIR),
    autoescape=select_autoescape(["html", "htm", "xml"]),
    trim_blocks=True,
    lstrip_blocks=True,
)


_FRONTEND_URL = "https://www.deepsightsynthesis.com"


def render_channel_page(
    channel: ChannelInfo,
    analyses: Sequence[AnalysisRef],
) -> str:
    """Render the HTML page for `/c/<slug>/page`."""
    canonical = f"{_FRONTEND_URL}/chaine/{channel.slug}"
    description = (
        f"{channel.analyses_count} analyses IA de vidéos de la chaîne "
        f"{channel.name} sur DeepSight. Synthèses sourcées, fact-checking, "
        f"flashcards. {channel.total_views} vues cumulées."
    )[:300]
    title = f"Analyses de la chaîne {channel.name} | DeepSight"

    template = _env.get_template("aggregate/channel.html")
    return template.render(
        page_title=title,
        page_description=description,
        canonical_url=canonical,
        frontend_url=_FRONTEND_URL,
        channel=channel,
        analyses=analyses,
        analyses_count=len(analyses),
        breadcrumb=[
            {"name": "Accueil", "url": f"{_FRONTEND_URL}/"},
            {"name": "Chaînes", "url": f"{_FRONTEND_URL}/chaines"},
            {"name": channel.name, "url": canonical},
        ],
    )


def render_category_page(
    category: CategoryInfo,
    analyses: Sequence[AnalysisRef],
) -> str:
    """Render the HTML page for `/cat/<slug>/page`."""
    canonical = f"{_FRONTEND_URL}/categorie/{category.slug}"
    description = (
        f"{category.analyses_count} analyses IA de vidéos de la catégorie "
        f"{category.name} sur DeepSight. Synthèses sourcées, fact-checking, "
        f"flashcards. {category.total_views} vues cumulées."
    )[:300]
    title = f"Analyses de la catégorie {category.name} | DeepSight"

    template = _env.get_template("aggregate/category.html")
    return template.render(
        page_title=title,
        page_description=description,
        canonical_url=canonical,
        frontend_url=_FRONTEND_URL,
        category=category,
        analyses=analyses,
        analyses_count=len(analyses),
        breadcrumb=[
            {"name": "Accueil", "url": f"{_FRONTEND_URL}/"},
            {"name": "Catégories", "url": f"{_FRONTEND_URL}/categories"},
            {"name": category.name, "url": canonical},
        ],
    )


def render_channels_index(channels: Sequence[ChannelInfo]) -> str:
    """Render the index page for `/chaines`."""
    canonical = f"{_FRONTEND_URL}/chaines"
    template = _env.get_template("aggregate/channels_index.html")
    return template.render(
        page_title="Toutes les chaînes analysées sur DeepSight",
        page_description=(
            "Explorez les analyses IA de DeepSight regroupées par chaîne YouTube "
            f"ou TikTok. {len(channels)} chaînes avec analyses publiques, classées "
            "par popularité."
        ),
        canonical_url=canonical,
        frontend_url=_FRONTEND_URL,
        channels=channels,
    )


def render_categories_index(categories: Sequence[CategoryInfo]) -> str:
    canonical = f"{_FRONTEND_URL}/categories"
    template = _env.get_template("aggregate/categories_index.html")
    return template.render(
        page_title="Toutes les catégories d'analyses sur DeepSight",
        page_description=(
            f"Explorez {len(categories)} catégories d'analyses IA de vidéos sur "
            "DeepSight. Sciences, économie, politique, philosophie, et plus."
        ),
        canonical_url=canonical,
        frontend_url=_FRONTEND_URL,
        categories=categories,
    )
