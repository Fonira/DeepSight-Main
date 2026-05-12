# Luffa Bot Platform — Recherche autonome

**Date** : 2026-05-12
**Auteur** : Claude (Opus 4.7)
**Objectif** : reconstituer la doc de l'API Bot Luffa pour intégration DeepSight prospection B2B, sans aucun contact externe.

---

## TL;DR

L'API Bot Luffa est **polling-based** (pas webhook), avec 3 endpoints HTTP POST sur `https://apibot.luffa.im/robot`. Auth via une `secret` (robot_key) passée dans le body JSON. Existence confirmée par un SDK Python officiel publié sur PyPI (`luffa-bot-python-sdk` v0.1.2, mars 2026) par l'équipe luffa.im. Le code source du SDK révèle tous les endpoints, payloads, et conventions.

**Implication archi** : pas de sous-domaine webhook nécessaire pour Luffa. Il faut un **worker daemon** qui poll `/robot/receive` en boucle. C'est asymétrique avec Telegram (webhook push).

---

## Sources consultées (toutes publiques, aucun contact externe)

1. https://userguide.luffa.im/bot/what-is-a-bot — doc officielle, contenu minimal
2. https://userguide.luffa.im/bot/key-features-of-bots — doc officielle, capacités haut-niveau
3. https://robot.luffa.im/login — portail dev (login requis, ECONNREFUSED via WebFetch)
4. https://robot.luffa.im/docManagement/operationGuide — référencé mais inaccessible publiquement
5. Recherches GitHub + Google : faux amis (`phodal/luffa`, `calabash/luffa`, `2gourds/luffa` = autre projet React 2019)
6. **🎯 https://pypi.org/project/luffa-bot-python-sdk** — SDK officiel
7. **🎯 https://github.com/sabma-labs/luffa-bot-python-sdk** — source du SDK
8. https://cointelegraph.com/press-releases/endless-web3-genesis-cloud-and-stability-ai-enhance-luffa-app-to-accelerate-decentralized-ai-adoption — contexte plateforme
9. https://www.bee.com/68291.html — intégration Luffa × OpenClaw (anecdotique)

---

## Identité Luffa

- **Produit** : messenger E2EE Web3, équivalent Signal/Telegram avec couche blockchain (protocole Endless)
- **OS** : iOS + Android + Web
- **Modèle économique** : freemium ; bots probablement gratuits (pas confirmé)
- **Position FR/EU** : pas confirmée (équipe semble UK/asiatique — `niraj.kulkarni@luffa.im`, University of Surrey)
- **Encryption** : E2EE entre humains, **clear text côté API bot** (les bots n'ont pas la clé privée des users)

---

## API HTTP

### Base URL

```
https://apibot.luffa.im/robot
```

### Endpoints

| Endpoint | Méthode | Rôle |
| --- | --- | --- |
| `/receive` | POST | Polling — récupère les messages entrants depuis le dernier appel |
| `/send` | POST | Envoyer un message texte ou structuré à un utilisateur (DM) |
| `/sendGroup` | POST | Envoyer un message à un groupe |

### Authentification

Pas de header Authorization. Le secret est dans le **body JSON** sous la clé `secret` (appelé `robot_key` dans le SDK). Sourcé depuis la variable env `LUFFA_ROBOT_SECRET` côté SDK.

Chaque bot a son propre `robot_key` distribué par le portail `robot.luffa.im` (login requis pour obtenir le secret — étape humaine à faire une fois).

### Format des requêtes

#### `POST /robot/receive`

```http
POST https://apibot.luffa.im/robot/receive
Content-Type: application/json

{"secret": "<ROBOT_SECRET>"}
```

**Réponse 200** (forme observée dans le SDK) :

```json
{
  "data": [
    {
      "uid": "<USER_OR_GROUP_ID>",
      "count": 1,
      "type": 0,
      "message": [
        {
          "atList": [],
          "text": "Bonjour",
          "urlLink": null,
          "msgId": "abc123",
          "uid": "<SENDER_ID_FOR_GROUP_ONLY>"
        }
      ]
    }
  ]
}
```

> NB : `data` peut être absent (le SDK fallback sur la racine). Les éléments du tableau peuvent être des dicts ou des strings JSON encodées (le SDK gère le double-decode défensivement).

`type` :
- `0` = DM (chat privé) — `uid` = ID de l'utilisateur
- `1` = group chat — `uid` = ID du groupe, le sender est dans `message[].uid`

Le client est responsable de la **déduplication** par `msgId` (FIFO, eviction sur taille max). Le SDK le fait pour nous.

#### `POST /robot/send` (DM)

```http
POST https://apibot.luffa.im/robot/send
Content-Type: application/json

{
  "secret": "<ROBOT_SECRET>",
  "uid": "<USER_ID>",
  "msg": "{\"text\":\"Hello world\"}"
}
```

`msg` est un **JSON string** (sérialisé une fois, pas un objet brut).

#### `POST /robot/sendGroup`

```http
POST https://apibot.luffa.im/robot/sendGroup
Content-Type: application/json

{
  "secret": "<ROBOT_SECRET>",
  "uid": "<GROUP_ID>",
  "msg": "{\"text\":\"Hello group\",\"button\":[{\"name\":\"Démo\",\"selector\":\"demo\"}]}",
  "type": "2"
}
```

`type` (en string, oui c'est moche) :
- `"1"` = message texte simple
- `"2"` = message avancé avec boutons / confirms / mentions

---

## Schémas de messages (depuis `models.py` du SDK)

### Outgoing

```python
@dataclass
class TextMessagePayload:
    text: str
    atList: Optional[List[Dict[str, Any]]] = None

@dataclass
class SimpleButton:
    name: str          # libellé visible
    selector: str      # ID retourné quand cliqué
    isHidden: Literal[0, 1] = 0

@dataclass
class ConfirmButton:
    name: str
    selector: str
    type: Literal["destructive", "default"] = "default"
    isHidden: Literal[0, 1] = 0

@dataclass
class AtMention:
    name: str
    did: str           # DID = decentralized identifier (Endless)
    length: int
    location: int
    userType: Literal[0] = 0

@dataclass
class GroupMessagePayload(TextMessagePayload):
    confirm: Optional[List[ConfirmButton]] = None
    button: Optional[List[SimpleButton]] = None
    dismissType: Optional[Literal["select", "dismiss"]] = None
```

**Règle métier** : `confirm` et `button` sont **mutuellement exclusifs** dans un GroupMessagePayload.

### Incoming

```python
@dataclass
class IncomingMessage:
    atList: List[Dict[str, Any]]
    text: str
    urlLink: Optional[str]
    msgId: str
    uid: Optional[str] = None      # sender id en mode group

@dataclass
class IncomingEnvelope:
    uid: str                       # user OR group id selon type
    count: int
    messages: List[IncomingMessage]
    type: Literal[0, 1]            # 0 = DM, 1 = group
```

Le SDK fait du parsing tolérant :
- `text` est cherché dans plusieurs clés (`text`, `msg`, `content`, `message`, `urlLink`)
- `msgId` est cherché dans (`msgId`, `msgid`, `mid`, `message_id`, `id`) ; fallback SHA1 du contenu

---

## Capacités confirmées

- ✅ Messages texte (DM + groupe)
- ✅ Liens (`urlLink`)
- ✅ Mentions (`@user` via `atList` avec DID Endless)
- ✅ Boutons interactifs (simples ou confirm avec style destructive/default)
- ✅ Multi-tenant (un bot peut servir plusieurs users/groupes)
- ❓ Images, vidéos, audio, fichiers — **mentionnés dans la doc public** ("text with images") mais **aucun schéma trouvé dans le SDK** → probablement pas supportés via API bot publique encore, ou format non documenté
- ❓ Cards riches — mentionnées dans la doc, **schéma absent** du SDK
- ❌ Webhooks push (pas dans l'API actuelle)
- ❓ Inline keyboards à plusieurs lignes — le SDK n'expose qu'une liste plate de boutons
- ❓ Rate limits — non documentés ; à mesurer empiriquement

---

## Capacités hypothétiques (à valider empiriquement)

| Hypothèse | Confiance | Comment valider |
| --- | --- | --- |
| Image upload via clé `imgUrl` dans `msg` | Faible | Tester avec un URL d'image hébergée, voir si Luffa la rend |
| Vidéo via `videoUrl` | Faible | Pareil |
| File via `fileUrl` + `fileName` | Faible | Pareil |
| Card via `card: {title, subtitle, imageUrl, actionUrl}` | Faible | Test direct sur user de test |
| Rate limit polling — 1Hz raisonnable | Moyen | Le SDK propose `interval=1.0` par défaut, suggère que c'est OK |
| Réponse en 200 même si liste vide | Élevé | Le SDK ne le mentionne pas explicitement mais c'est l'usage standard |

**Stratégie de découverte** : démarrer V1 Luffa avec text + boutons uniquement. Tester images/cards via essais successifs sur un bot de dev avant de promettre la feature.

---

## Recommandations d'intégration pour DeepSight

### Pattern d'archi

Luffa = pull (polling). Telegram = push (webhook). Deux modes d'orchestration différents.

```
┌─────────────────────────────────────────────────────────┐
│  Backend FastAPI (repo-backend-1) ou service dédié     │
│                                                         │
│  ┌────────────────────────┐    ┌─────────────────────┐ │
│  │ /api/bots/telegram/    │    │ Luffa Poller daemon │ │
│  │   webhook (FastAPI)    │    │ (asyncio task)      │ │
│  │                        │    │                     │ │
│  │ Telegram push → ici    │    │ Loop:               │ │
│  └────────┬───────────────┘    │   receive() → 1s    │ │
│           │                    │   handler(msg)      │ │
│           ▼                    └──────┬──────────────┘ │
│      ┌─────────────────────────────────▼─────────┐    │
│      │  Conversation State Machine (commun)      │    │
│      │  steps: hello → qualif → demo → handoff   │    │
│      └────────┬──────────────────────────────────┘    │
│               ▼                                        │
│      ┌────────────────────────────────────┐           │
│      │  Mistral LLM (réponses naturelles) │           │
│      └────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────┘
```

### Dépendance Python

```python
# requirements.txt addition
luffa-bot-python-sdk>=0.1.2
```

Une seule lib, dépend uniquement de `httpx` (déjà installé).

### Boucle de polling minimale

```python
import asyncio
import luffa_bot

luffa_bot.robot_key = settings.LUFFA_ROBOT_SECRET

async def handler(msg, env, client):
    response = await handle_prospect_message(
        platform="luffa",
        platform_user_id=env.uid,
        text=msg.text,
        is_group=(env.type == 1),
    )
    await client.send_to_user(env.uid, response.text)

# À lancer dans le lifespan FastAPI ou un worker dédié
async def luffa_loop():
    await luffa_bot.run(handler, interval=1.0, concurrency=5)
```

### Variables d'environnement à ajouter

```env
# .env.production additions
LUFFA_ROBOT_SECRET=<secret obtenu depuis robot.luffa.im une fois>
LUFFA_ENABLED=true        # feature flag pour off-switch
LUFFA_POLL_INTERVAL=1.0   # seconds
LUFFA_CONCURRENCY=5       # max parallel handlers
```

### Récupération du robot_key

**Étape humaine** : Maxime doit se loguer sur https://robot.luffa.im/login (probablement via QR code Luffa app ou email + OTP), créer un bot, récupérer le secret. Pas automatisable, et c'est OK — fait une seule fois.

---

## Risques et angles morts

1. **Doc publique très pauvre** : si Luffa change l'API, on ne sera prévenu que par cassure du SDK (qui n'est qu'à v0.1.2 → potentiellement instable).
2. **SDK semi-officiel** : auteur Niraj Kulkarni / Sabma Labs avec email `@luffa.im` donc lié à l'équipe mais pas org GitHub officielle `luffa-im` → fragilité potentielle.
3. **Pas de signature webhooks** : le bot est uniquement authentifié par son `secret` côté outgoing. Côté incoming polling, c'est Luffa qui nous parle donc pas besoin de signer, mais on devra vérifier que le `robot_key` ne fuite jamais (treat as production secret).
4. **Pas de TLS pinning** : le SDK utilise httpx avec validation TLS standard, OK.
5. **DID Endless** : les mentions utilisent `did` qui est un format Endless protocol. À traiter comme opaque pour l'instant.
6. **Rate limits inconnus** : commencer prudemment (1Hz poll, 5 messages parallèles), monitor 429 ou erreurs explicites.
7. **Médias/cards non documentés** : promettre prudemment côté UX (texte + boutons V1, médias V2 si validé).
8. **Compte Luffa du fondateur** : aucune mention d'un compte Luffa actif dans la mémoire / vault Maxime → vérifier qu'on peut créer un bot sans pré-existence d'un compte payant.

---

## Conclusion

Luffa est **viable** pour V1 prospection B2B avec :
- Texte simple + boutons
- Polling 1Hz via SDK officiel
- Architecture worker daemon (différente de Telegram webhook)

Pas d'hypothèses risquées à compenser. Toutes les inconnues (médias, rate limits) sont des nice-to-have V2.

**Recommandation** : implémenter Telegram d'abord (Phase 3 du plan global), puis Luffa en réutilisant la machine à états de conversation. Adapter `luffa_bot.run()` pour qu'il s'arrête proprement au shutdown du backend (signal handler ou flag asyncio).
