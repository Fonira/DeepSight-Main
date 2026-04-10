# Fiche Contact — Le Nguyen Hoang

## Identite

| Champ | Detail |
|-------|--------|
| **Nom** | Le Nguyen Hoang |
| **Role** | President et Co-fondateur |
| **Organisation** | Association Tournesol (tournesol.app) |
| **Localisation** | Lausanne, Suisse |
| **Type** | Partenaire tech |

---

## Coordonnees

| Canal | Lien / Adresse |
|-------|---------------|
| Email | len@science4all.org |
| LinkedIn | linkedin.com/in/le-nguyen-hoang |
| Twitter/X | @le_science4all |
| Mastodon | @lenhoang@mastodon.social |
| Bluesky | @science4all.org |
| Discord | Serveur Tournesol : discord.gg/WvcSG55Bf3 |
| GitHub | github.com/lenhoanglnh |
| YouTube | Science4All (220K+ abonnes) |
| Site web | science4all.org |

---

## Profil

### Bio
Diplome de l'Ecole Polytechnique Paris, PhD en mathematiques appliquees de Polytechnique Montreal, post-doc au MIT. Chercheur en IA et communicateur scientifique a l'EPFL (Ecole Polytechnique Federale de Lausanne). Auteur de plusieurs livres sur l'IA ethique et la securite des algorithmes. Vulgarisateur scientifique sur la chaine YouTube Science4All depuis 2012.

### Centres d'interet
- Securite et ethique de l'IA a grande echelle
- Algorithmes de recommandation et leur impact societal
- Democratisation des recommandations collaboratives
- Vulgarisation scientifique (mathematiques, informatique, IA)

### Audience / Influence
- YouTube Science4All : 220K+ abonnes
- Communaute Tournesol : 8800+ contributeurs actifs
- Publications academiques et conferences IA (ICML, etc.)
- Reseau academique fort : EPFL, Polytechnique Paris, CNRS, ex-Google Brain

### Lien avec DeepSight
Tournesol est deja integre dans DeepSight sur toutes les plateformes (web, mobile, extension). DeepSight utilise l'API publique de Tournesol pour afficher les scores de qualite des videos (fiabilite, pedagogie, etc.) et pour alimenter son algorithme de decouverte (20% du poids). L'objectif est de formaliser cet usage et d'etablir un partenariat.

---

## Recherche

### Sources consultees
- tournesol.app — Plateforme principale, API publique sans auth requise
- github.com/tournesol-app/tournesol — Code open-source, LICENSE.md detaillee
- wiki.tournesol.app/wiki/Tournesol_Association — Statuts de l'association (IDE: CHE-269.536.932), fondee le 20 avril 2021
- science4all.org — Site personnel, email de contact
- linkedin.com/in/le-nguyen-hoang — Profil professionnel
- VentureBeat (mars 2022) — Article "Researchers turn to crowdsourcing for better YouTube recommendations"

### Points d'accroche identifies
1. **Valeurs alignees** : Tournesol et DeepSight partagent la mission d'IA ethique, souverainete europeenne, anti-desinformation et esprit critique
2. **Integration existante** : DeepSight integre deja Tournesol de maniere significative — ce n'est pas une demande a froid mais une formalisation d'un usage existant
3. **Distribution** : DeepSight expose les scores Tournesol a ses utilisateurs sur 3 plateformes, avec deep links vers tournesol.app — c'est de la visibilite gratuite pour Tournesol
4. **Cas d'usage commercial** : DeepSight represente un cas concret d'adoption des scores Tournesol dans un produit grand public — utile pour publications, subventions, communication
5. **Licence favorable** : La base de donnees Tournesol est sous ODC-By (Open Data Commons Attribution) — la reutilisation commerciale avec attribution est explicitement autorisee

### Notes
- L'API Tournesol est publique et ne requiert aucune authentification
- Pas de documentation officielle sur les rate limits
- Le User-Agent envoye par DeepSight est `DeepSight/1.0 (tournesol-integration)`
- Tournesol ne renvoie pas de headers CORS — d'ou le proxy cote backend DeepSight
- L'equipe est petite (~10 devs benevoles) — etre respectueux du temps
- Secretaire de l'association : Aidan Jungo
- Board scientifique : El Mahdi El Mhamdi (Polytechnique + ex-Google Brain), Vlad Nitu (CNRS Lyon), Mithuna Yoganathan (Looking Glass Universe)

---

## Historique des echanges

| Date | Canal | Direction | Resume | Statut |
|------|-------|-----------|--------|--------|
| 2026-04-10 | — | — | Recherche completee, profil compile, licence verifiee | recherche |

---

## Brouillons

### Email v1 — 2026-04-10 (version initiale — archivee)

~~Version business/partenariat classique.~~

### Email v2 — 2026-04-10 (angle ethique — archivee)

~~Bon angle ethique mais ne mentionne pas le stade pre-lancement.~~

### Email v3 — 2026-04-10 (VERSION FINALE — transparent, pre-lancement, ethique)

**Objet** : DeepSight x Tournesol — Integration de vos scores avant notre lancement

Bonjour Le,

Je me permets de vous ecrire parce que je crois qu'on partage une conviction : l'IA doit etre un outil au service de la comprehension et de l'esprit critique, pas une machine a engagement ou a profit.

Je suis Maxime Le Parc, fondateur de DeepSight (deepsightsynthesis.com). Je developpe un outil d'analyse de videos YouTube propulse par Mistral AI — syntheses structurees, fact-checking, flashcards, quiz. L'idee n'est pas de consommer plus de contenu, mais de mieux comprendre celui qu'on regarde.

Je suis transparent : DeepSight est en phase de pre-lancement. Le produit est fonctionnel (web, mobile, extension Chrome), mais je n'ai pas encore d'utilisateurs. Je vous contacte maintenant, avant le lancement, justement parce que je veux construire les choses correctement des le depart.

Et Tournesol fait partie des fondations.

Concretement, j'ai integre Tournesol dans les 3 interfaces de DeepSight :
- Chaque video analysee affiche son score Tournesol avec les 10 criteres
- Vos scores alimentent l'algorithme de decouverte (20% du poids)
- Une section "Recommandations Tournesol" figure sur le dashboard
- Le badge 🌻 redirige vers tournesol.app pour inciter a contribuer

J'ai vu que la base de donnees publique est sous licence ODC-By, et j'attribue Tournesol dans les credits, le footer et les pages "A propos". Mais au-dela de la licence, je tenais a vous ecrire directement : est-ce que cette utilisation vous convient ?

Ce qui m'a amene vers Tournesol, c'est la meme lecture du probleme : les algorithmes de recommandation actuels amplifient le bruit, la desinformation et l'engagement toxique. Tournesol propose une alternative citoyenne par le jugement collaboratif. DeepSight propose une alternative individuelle par l'analyse en profondeur et la verification. Je crois que les deux approches se completent.

A terme, quand DeepSight aura des utilisateurs, ca representera :
- Vos scores exposes sur 3 plateformes a un public qui ne connait pas forcement Tournesol
- Du trafic redirige vers tournesol.app
- De nouveaux contributeurs potentiels pour vos comparaisons

DeepSight est 100% propulse par Mistral AI, donnees hebergees en Europe. Je ne vends pas de l'attention — j'essaie d'outiller les gens pour qu'ils pensent mieux.

Si vous etes ouvert a un echange, meme court, j'en serais tres heureux.

Cordialement,
Maxime Le Parc
Fondateur, DeepSight
maxime@deepsightsynthesis.com
https://www.deepsightsynthesis.com

---

## Pieces jointes a envoyer avec le mail

1. **Screenshot #1** : Section "Recommandations Tournesol" sur le dashboard
   - URL : deepsightsynthesis.com → se connecter → dashboard (sans video selectionnee)
   - Montre : grille 12 videos, badges scores couleur, criteres fiabilite/pedagogie
   - C'est LE screenshot le plus impactant

2. **Screenshot #2** : Widget Tournesol detaille sur une analyse
   - URL : dashboard → analyser une video qui a un score Tournesol
   - Montre : grand score dore, 10 criteres avec barres, bouton "Comparer"
   - Cliquer sur l'icone info pour deplier le detail

3. **Screenshot #3** (optionnel) : Badges inline dans l'historique
   - URL : /history
   - Montre : liste de videos avec petit badge 🌻 + score a cote de chaque titre

4. **One-pager** : Fichier `outreach/campaigns/tournesol-one-pager.txt`
   - Resume technique de l'integration (endpoints, attribution, pourquoi)
   - A joindre en PDF ou copier dans le corps du mail si les screenshots suffisent

---

## Strategie d'envoi

### Avant d'envoyer
- [ ] Prendre les 2-3 screenshots sur deepsightsynthesis.com (mode sombre)
- [ ] Relire le mail, adapter a ta voix si besoin
- [ ] Verifier que l'envoi est depuis maxime@deepsightsynthesis.com
- [ ] Joindre screenshots + optionnellement le one-pager

### Timing
- **Ce soir** : envoyer l'email a len@science4all.org
- **J+2 a J+4** : rejoindre le Discord Tournesol (discord.gg/WvcSG55Bf3), observer quelques messages
- **J+5** : se presenter dans #general (version courte, voir campaigns/tournesol-partenariat.md)
- **J+7 sans reponse** : relance legere par LinkedIn
- **J+14 sans reponse** : dernier message LinkedIn, puis passer a autre chose pour l'instant

### Scenarios probables

| Scenario | Proba | Reaction |
|----------|-------|----------|
| Pas de reponse | 55-60% | Relance Discord J+5, LinkedIn J+7. Revenir post-lancement avec metriques. |
| "OK, pas de souci" | 25-30% | Remercier, demander si mention wiki possible, proposer un call. |
| Interet actif | 10-12% | Proposer un call, discuter mention croisee, contribution repo. |
| Reserves | 5-8% | Respecter a la lettre, remercier, revenir avec metriques. |
| Refus | <2% | Quasi impossible vu la licence ODC-By. Remercier et continuer. |

---

*Fiche creee le : 2026-04-10*
*Derniere mise a jour : 2026-04-10*
