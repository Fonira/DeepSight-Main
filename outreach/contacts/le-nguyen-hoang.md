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

### Email — 2026-04-10

**Objet** : DeepSight x Tournesol — Integration existante et collaboration

Bonjour Le,

Je suis Maxime, fondateur de DeepSight (deepsightsynthesis.com), un SaaS francais d'analyse IA de videos YouTube. Notre outil propose des syntheses structurees, du fact-checking et des outils d'etude (flashcards, quiz, mind maps), le tout propulse par Mistral AI.

**Nous integrons deja Tournesol** dans notre plateforme depuis plusieurs mois, sur nos 3 interfaces (web, mobile, extension Chrome) :
- Les scores Tournesol sont affiches pour chaque video analysee (widget avec les 10 criteres)
- Vos scores alimentent notre algorithme de decouverte a hauteur de 20%
- Une section "Recommandations Tournesol" figure sur notre dashboard
- Le badge sunflower redirige nos utilisateurs vers tournesol.app

Nous avons note que la base de donnees publique est sous licence ODC-By, et nous attribuons Tournesol dans nos credits, notre footer et nos pages "A propos". Nous vous contactons neanmoins pour nous assurer que cette utilisation vous convient et pour explorer une eventuelle collaboration plus formelle.

**Ce que DeepSight apporte a Tournesol** :
- Distribution de vos scores aupres de nos utilisateurs sur 3 plateformes
- Un cas d'usage commercial concret de votre plateforme
- Feedback technique en tant qu'integrateur API
- Trafic dirige vers tournesol.app (deep links, badge cliquable)

Nous partageons vos valeurs : IA ethique, souverainete europeenne (100% Mistral AI, donnees hebergees en UE), et promotion du contenu de qualite.

Seriez-vous disponible pour un court echange ?

Cordialement,
Maxime Le Parc
Fondateur, DeepSight
maxime@deepsightsynthesis.com
deepsightsynthesis.com

---

*Fiche creee le : 2026-04-10*
*Derniere mise a jour : 2026-04-10*
