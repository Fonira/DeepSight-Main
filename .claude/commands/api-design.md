---
description: "Conventions obligatoires pour l'API FastAPI DeepSight (endpoints, réponses, erreurs, auth). TOUJOURS consulter cette skill avant de créer ou modifier un endpoint, un modèle Pydantic, une route, ou un schéma de réponse API."
---

Conventions API DeepSight — FastAPI Backend
Structure des endpoints
Nommage des routes
/api/v1/{ressource} # Collection
/api/v1/{ressource}/{id} # Item unique
/api/v1/{ressource}/{id}/{action} # Action spécifique
Exemples :
GET /api/v1/analyses # Liste des analyses de l'utilisateur
POST /api/v1/analyses # Lancer une nouvelle analyse
GET /api/v1/analyses/{id} # Détail d'une analyse
POST /api/v1/analyses/{id}/share # Partager une analyse
GET /api/v1/user/subscription # Souscription courante
POST /api/v1/auth/login # Connexion
POST /api/v1/auth/register # Inscription
POST /api/v1/auth/refresh # Rafraîchir le JWT
Règles :

Noms de ressources au pluriel et en anglais
snake_case dans les URLs
Verbes HTTP sémantiques : GET (lire), POST (créer/action), PUT (remplacer), PATCH (modifier), DELETE (supprimer)

Format de réponse standard
Toutes les réponses suivent ce format :
python# Succès
{
"status": "success",
"data": { ... }, # Payload principal
"message": "Analysis created successfully" # Optionnel
}

# Erreur

{
"status": "error",
"error": {
"code": "INSUFFICIENT_PLAN",
"message": "Cette fonctionnalité nécessite le plan Pro",
"details": {} # Optionnel, contexte supplémentaire
}
}

# Liste paginée

{
"status": "success",
"data": [ ... ],
"pagination": {
"page": 1,
"per_page": 20,
"total": 142,
"total_pages": 8
}
}
Codes d'erreur applicatifs
CodeHTTPSignificationVALIDATION_ERROR422Données invalides (Pydantic)NOT_FOUND404Ressource introuvableUNAUTHORIZED401Token manquant ou expiréFORBIDDEN403Pas les droitsINSUFFICIENT_PLAN403Feature non disponible pour ce planRATE_LIMITED429Trop de requêtesANALYSIS_FAILED500Erreur lors de l'analyse Mistral/PerplexityPAYMENT_REQUIRED402Problème de paiement StripeCONFLICT409Ressource déjà existanteSERVICE_UNAVAILABLE503Service externe down (Mistral, Perplexity)
Modèles Pydantic
pythonfrom pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

# Convention : suffixer Request/Response

class AnalysisCreateRequest(BaseModel):
video_url: str = Field(..., description="URL YouTube à analyser")
mode: str = Field(default="standard", description="accessible|standard|expert")
language: str = Field(default="fr")

class AnalysisResponse(BaseModel):
id: str
video_url: str
title: str
status: str # pending, processing, completed, failed
created_at: datetime
synthesis: Optional[str] = None

# Réponse wrapper

class APIResponse(BaseModel):
status: str = "success"
data: Optional[dict] = None
message: Optional[str] = None
Authentification

JWT Bearer token dans le header Authorization: Bearer <token>
Access token : durée courte (15-30 min)
Refresh token : durée longue (7-30 jours), stocké httpOnly côté web, SecureStore côté mobile
Dependency FastAPI réutilisable :

pythonasync def get_current_user(token: str = Depends(oauth2_scheme)) -> User: # Décoder, vérifier, retourner l'utilisateur
...
Vérification des features (souscription)
TOUJOURS vérifier côté backend, jamais faire confiance au client :
pythonfrom app.subscriptions import is_feature_available

@router.post("/api/v1/analyses")
async def create_analysis(
request: AnalysisCreateRequest,
user: User = Depends(get_current_user)
):
if not is_feature_available(user.plan, "create_analysis", platform="web"):
raise HTTPException(
status_code=403,
detail={"code": "INSUFFICIENT_PLAN", "message": "..."}
)
...
Compatibilité multi-plateforme
Quand tu crées/modifies un endpoint, TOUJOURS vérifier :

Le frontend Web l'appelle-t-il ? → Mettre à jour le service/hook correspondant
Le mobile l'appelle-t-il ? → Mettre à jour le service API mobile
L'extension l'appelle-t-elle ? → Vérifier la compatibilité
Les noms de champs sont-ils en snake_case dans la réponse JSON ? (le frontend convertit en camelCase côté client)

Webhooks Stripe
python@router.post("/api/v1/webhooks/stripe")
async def stripe_webhook(request: Request):
payload = await request.body()
sig_header = request.headers.get("stripe-signature") # Vérifier la signature AVANT tout traitement
event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
...
Événements à gérer : checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed
