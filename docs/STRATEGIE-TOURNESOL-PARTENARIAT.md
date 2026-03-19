# Stratégie Tournesol × DeepSight — Approche Partenariat

**Version** : 1.0 — Mars 2026
**Objectif** : Approcher l'équipe Tournesol pour formaliser l'intégration et proposer un partenariat mutuellement bénéfique.

---

## 1. Ce qu'est Tournesol

Tournesol est une **association à but non lucratif** (Lausanne, Suisse) qui développe une plateforme open-source de recommandation collaborative de vidéos YouTube. Les utilisateurs comparent des vidéos entre elles, et un algorithme agrège ces jugements pour produire des **scores de qualité** (fiabilité, importance, accessibilité, etc.).

**Mission** : Identifier collaborativement les vidéos d'intérêt public qui méritent d'être largement recommandées, et contribuer à rendre les algorithmes de recommandation bénéfiques pour l'humanité.

**Fondateur** : Lê Nguyên Hoang — chercheur en sécurité IA à l'EPFL, vulgarisateur (chaîne YouTube Science4All, 200K+ abonnés), diplômé de Polytechnique Paris, PhD Polytechnique Montréal, post-doc MIT. Auteur de plusieurs livres sur l'IA éthique.

**Équipe** : ~10 développeurs bénévoles + board scientifique (El Mahdi El Mhamdi / Polytechnique+Google Brain, Alexandre Maurer, Vlad Nitu / CNRS Lyon, Mithuna Yoganathan / Looking Glass Universe 200K+ subs).

**Données** : 1.1M+ jugements comparatifs, 8800+ utilisateurs, dataset public sous licence ODC-By.

---

## 2. État actuel de l'intégration DeepSight × Tournesol

DeepSight intègre **déjà** Tournesol de manière significative :

### Backend (`/api/tournesol/`)
- Proxy CORS vers `api.tournesol.app`
- 4 endpoints : `/video/{id}`, `/search`, `/recommendations`, `/batch`
- Score normalisé (0.0—1.0) utilisé dans le ranking de découverte
- Auto-flag `is_tournesol_pick` si score > 0.55
- Poids de 20% dans le calcul de pertinence final

### Frontend + Mobile
- Widget TournesolWidget (score + breakdown critères)
- Section "Trending Tournesol" sur le dashboard
- Badge 🌻 sur les vidéos Tournesol-approved
- Deep links vers tournesol.app/comparison
- Toggle dans les Settings

### Ce qui manque
- Extension Chrome : pas encore d'intégration Tournesol
- Pas de communication officielle avec l'équipe Tournesol
- Pas d'attribution/mention sur le site public
- Pas de contribution au projet open-source

---

## 3. Pourquoi Tournesol a intérêt à travailler avec DeepSight

C'est la question clé : **qu'est-ce que DeepSight apporte à Tournesol ?**

### 3.1 Distribution et visibilité

Tournesol est un projet de recherche avec ~8800 contributeurs. C'est petit. DeepSight, en intégrant leurs scores dans un produit commercial grand public, **multiplie leur portée** :

- Chaque utilisateur DeepSight voit les scores Tournesol sur ses analyses
- Le badge 🌻 crée une curiosité → les utilisateurs découvrent Tournesol
- Les deep links dirigent du trafic vers tournesol.app
- Plus de visibilité = plus de contributeurs potentiels pour Tournesol

### 3.2 Cas d'usage concret

Tournesol cherche à prouver que leur approche fonctionne "dans le monde réel". DeepSight est un **cas d'usage commercial concret** d'intégration de leurs scores dans un produit. C'est exactement ce dont ils ont besoin pour :

- Publications académiques (démontrer l'adoption)
- Demandes de subventions (prouver l'impact)
- Communication publique (montrer que ça marche)

### 3.3 Feedback boucle

DeepSight peut fournir à Tournesol :

- **Données d'usage anonymisées** : quelles vidéos sont analysées, combien ont un score Tournesol, corrélation entre qualité perçue et score Tournesol
- **Feedback utilisateur** : si les utilisateurs DeepSight trouvent les scores Tournesol utiles/pertinents
- **Bug reports** : en tant qu'intégrateur API, on détecte les problèmes avant les autres

### 3.4 Valeurs alignées

DeepSight et Tournesol partagent les mêmes valeurs :

| Valeur | Tournesol | DeepSight |
|--------|-----------|-----------|
| IA éthique | Mission fondatrice | Analyse nuancée, marqueurs épistémiques |
| Souveraineté EU | Association suisse, chercheurs EU | 100% Mistral AI, données en UE |
| Esprit critique | Score de fiabilité des vidéos | Fact-checking, sources vérifiées |
| Open source | Code source ouvert | API publique, extension open-source |
| Anti-désinformation | Identification des contenus fiables | Marqueurs "À VÉRIFIER", "INCERTAIN" |

---

## 4. Ce que DeepSight a intérêt à obtenir de Tournesol

### 4.1 Légitimité

Une mention officielle de DeepSight sur le site/wiki Tournesol comme "intégrateur partenaire" donne une **crédibilité académique et éthique** immédiate. C'est un argument puissant pour :

- Investisseurs (BPI France, French Tech, EU grants)
- Presse tech française
- Utilisateurs soucieux de l'éthique IA

### 4.2 Accès privilégié à l'API

Actuellement on utilise l'API publique. Un partenariat pourrait donner :

- Rate limits plus élevés
- Accès à des endpoints supplémentaires
- Données en temps réel vs batch
- Prévention des breaking changes

### 4.3 Co-branding

"Propulsé par Tournesol" sur le site DeepSight + "Utilisé par DeepSight" sur le wiki Tournesol = crédibilité mutuelle.

### 4.4 Réseau académique

L'équipe Tournesol (EPFL, Polytechnique, CNRS, Google Brain) est un réseau précieux pour la crédibilité scientifique de DeepSight.

---

## 5. Proposition concrète de partenariat

### Tier 1 — Gratuit, immédiat (on peut faire maintenant)

1. **Attribution visible** : Ajouter "Scores de qualité fournis par Tournesol" avec logo + lien sur le site DeepSight
2. **Contribution open-source** : Soumettre un PR sur le repo Tournesol (documentation, bug fix, etc.)
3. **Message Discord** : Se présenter sur le Discord Tournesol, expliquer l'intégration
4. **Page wiki** : Proposer une page "DeepSight" sur le wiki Tournesol comme cas d'usage

### Tier 2 — Partenariat informel (à proposer)

5. **Email à Lê Nguyên Hoang** : Présentation formelle de DeepSight + intégration existante
6. **Mention croisée** : DeepSight mentionne Tournesol, Tournesol mentionne DeepSight
7. **Feedback régulier** : DeepSight envoie des stats d'usage (anonymisées) à Tournesol
8. **Extension Chrome** : Intégrer Tournesol dans l'extension DeepSight (leur extension est une ref)

### Tier 3 — Partenariat formalisé (objectif moyen terme)

9. **API dédiée** : Endpoint optimisé pour DeepSight (batch, cache, webhooks)
10. **Co-publication** : Article/blog post conjoint "Comment nous utilisons Tournesol pour des recommandations éthiques"
11. **Événements** : Participation conjointe à des conférences IA éthique
12. **Subventions EU** : Candidature conjointe à des programmes EU (Horizon Europe, etc.)

---

## 6. Contacts et canaux d'approche

### Contact principal

**Lê Nguyên Hoang** — Président & Co-fondateur
- LinkedIn : linkedin.com/in/lê-nguyên-hoang
- Mastodon : @lenhoang@mastodon.social
- Bluesky : @science4all.org
- YouTube : Science4All (200K+ abonnés)
- Site perso : science4all.org

### Canaux d'approche (par ordre de priorité)

1. **Discord Tournesol** (discord.gg/WvcSG55Bf3) — Communauté active, bonne première impression
2. **LinkedIn** — Message direct à Lê Nguyên Hoang, professionnel
3. **Email via site** — Contact formel
4. **GitHub** — PR ou issue comme contribution concrète
5. **Twitter/Mastodon** — Mention publique

### Stratégie recommandée

**Étape 1** (cette semaine) : Rejoindre le Discord, se présenter brièvement dans #general, montrer l'intégration existante.

**Étape 2** (après réponse Discord) : Message LinkedIn à Lê Nguyên Hoang avec lien vers l'intégration live.

**Étape 3** (si intérêt) : Appel/visio pour discuter du partenariat formalisé.

---

## 7. Brouillon du message d'approche

### Version Discord (courte)

> Bonjour à tous ! Je suis Arinov, fondateur de DeepSight (deepsightsynthesis.com), un SaaS français d'analyse IA de vidéos YouTube.
>
> Je voulais vous informer que nous avons intégré les scores Tournesol directement dans notre plateforme : chaque vidéo analysée affiche son score Tournesol, et nous utilisons vos scores dans notre algorithme de découverte pour mettre en avant les vidéos d'intérêt public. Nos utilisateurs voient le badge 🌻 et peuvent cliquer pour comparer sur tournesol.app.
>
> Nous sommes 100% propulsés par Mistral AI (IA française, données en UE) et nous partageons vos valeurs d'IA éthique et de souveraineté européenne.
>
> Je serais ravi d'échanger sur comment nous pourrions mieux collaborer et contribuer au projet Tournesol.

### Version LinkedIn (pour Lê Nguyên Hoang)

> Bonjour Lê,
>
> Je suis le fondateur de DeepSight, un SaaS français d'analyse IA de vidéos YouTube (deepsightsynthesis.com). Nous avons intégré les scores Tournesol dans notre plateforme — vos scores alimentent notre algorithme de découverte et sont visibles par nos utilisateurs sur web, mobile et bientôt sur notre extension Chrome.
>
> Nous partageons vos convictions : IA éthique, souveraineté européenne (100% Mistral AI, données hébergées en UE), et promotion du contenu de qualité.
>
> J'aimerais échanger avec vous sur une possible collaboration formelle. DeepSight pourrait être un cas d'usage commercial concret pour Tournesol, et nous serions ravis de contribuer au projet (feedback, données d'usage, contributions open-source).
>
> Seriez-vous disponible pour un échange ?
>
> Cordialement,
> Arinov — Fondateur DeepSight

---

## 8. Argumentaire économique global (Mistral + Tournesol)

### Pour les investisseurs / BPI / French Tech

DeepSight se positionne comme le **premier SaaS d'analyse vidéo 100% européen et éthique** :

1. **IA 100% française** — Mistral AI, société parisienne, données hébergées en UE
2. **Non soumis au CLOUD Act** — Contrairement aux concurrents utilisant OpenAI/Google
3. **RGPD natif** — DPA signé, Zero Data Retention demandé
4. **EU AI Act ready** — Mistral signataire du Code of Practice
5. **Recommandations éthiques** — Scores Tournesol (plateforme académique reconnue)
6. **Anti-désinformation** — Marqueurs épistémiques, fact-checking sourcé
7. **Open contribution** — Extension open-source, contribution à Tournesol

### Pitch en une phrase

> "DeepSight est le seul outil d'analyse vidéo au monde qui combine une IA 100% française (Mistral AI), des données souveraines en Europe, et des recommandations éthiques validées par la communauté scientifique (Tournesol)."

---

## 9. Prochaines actions

| # | Action | Priorité | Délai |
|---|--------|----------|-------|
| 1 | Rejoindre le Discord Tournesol et poster le message | Haute | Cette semaine |
| 2 | Ajouter l'attribution Tournesol visible sur deepsightsynthesis.com | Haute | Cette semaine |
| 3 | Envoyer un message LinkedIn à Lê Nguyên Hoang | Haute | Après le Discord |
| 4 | Contribuer un PR au repo GitHub Tournesol | Moyenne | 2 semaines |
| 5 | Intégrer Tournesol dans l'extension Chrome | Moyenne | 2 semaines |
| 6 | Préparer un one-pager partenariat PDF | Moyenne | Avant l'appel |
| 7 | Candidater à un programme French Tech / BPI avec l'argumentaire | Basse | 1 mois |

---

*Document généré le 19 mars 2026 — DeepSight Stratégie Partenariat Tournesol*
