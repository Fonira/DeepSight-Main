# DeepSight Outreach — Instructions Claude

Ce dossier contient le systeme de gestion de contacts et d'outreach professionnel de DeepSight.
Claude doit lire ce fichier pour comprendre comment assister l'utilisateur dans ses demarches de communication externe.

---

## Structure du dossier

```
outreach/
├── CLAUDE.md              # Ce fichier — instructions pour Claude
├── tracker.md             # Tableau de suivi global de tous les contacts
├── templates/             # Templates de messages par canal
│   ├── contact.md         # Template fiche contact
│   ├── email-partenaire-tech.md
│   ├── email-createur.md
│   ├── message-linkedin.md
│   └── message-discord.md
├── contacts/              # Une fiche par contact (remplie)
│   └── le-nguyen-hoang.md
└── campaigns/             # Une fiche par campagne d'outreach
    └── tournesol-partenariat.md
```

---

## Workflows

### 1. Recherche d'un nouveau contact

Quand l'utilisateur demande de rechercher un contact :

1. **Investiguer** via WebSearch : site perso, LinkedIn, GitHub, YouTube, Twitter/X, Mastodon, publications
2. **Compiler** les informations dans une fiche contact (utiliser `templates/contact.md`)
3. **Identifier les points d'accroche** : valeurs communes avec DeepSight, interet potentiel, contenu recent pertinent
4. **Sauvegarder** la fiche dans `contacts/[prenom-nom].md` (kebab-case)
5. **Mettre a jour** `tracker.md` avec une nouvelle ligne

### 2. Redaction de message

Quand l'utilisateur demande de rediger un message pour un contact :

1. **Lire** la fiche contact dans `contacts/`
2. **Choisir le bon template** dans `templates/` selon le canal (email, LinkedIn, Discord)
3. **Personnaliser** le message en s'appuyant sur :
   - Le profil et les interets du contact
   - Les points d'accroche identifies
   - Le positionnement DeepSight (voir `.claude/commands/aquisition-copy.md`)
4. **Proposer le brouillon** a l'utilisateur — ne JAMAIS envoyer directement
5. **Sauvegarder** le brouillon dans la section "Brouillons" de la fiche contact

### 3. Suivi des contacts

Quand l'utilisateur demande l'etat de l'outreach :

1. **Lire** `tracker.md`
2. **Resumer** les contacts par statut
3. **Suggerer des actions** : relances si pas de reponse apres 7 jours, prochaines etapes pour les contacts en discussion

---

## Regles

### Ton et positionnement

- **Consulter** `.claude/commands/aquisition-copy.md` avant toute redaction
- **Professionnel mais accessible** : pas de jargon inutile, pas de flatterie excessive
- **Valoriser** : IA ethique, souverainete europeenne (Mistral AI), analyse de profondeur YouTube
- **Jamais denigrer** un concurrent — se positionner en alternative
- **Adapter la langue** au contact : francais par defaut, anglais si le contact est international

### Canaux — regles specifiques

| Canal | Ton | Longueur | Particularites |
|-------|-----|----------|----------------|
| **Email** | Formel, structure | 150-300 mots | Objet soigne, paragraphes courts, CTA clair |
| **LinkedIn** | Pro mais direct | 80-150 mots | Limite 300 chars pour l'invite, message court |
| **Discord** | Communautaire, decontracte | 50-100 mots | Se presenter, montrer la valeur, pas de pitch agressif |
| **Twitter/X** | Concis, accrocheur | 1-2 tweets | Mention publique, lien vers le produit |

### Securite

- Ne JAMAIS envoyer un message sans validation explicite de l'utilisateur
- Ne JAMAIS inventer ou deviner une adresse email — toujours verifier via recherche
- Ne JAMAIS partager d'informations confidentielles sur DeepSight (revenus, nombre d'utilisateurs exact, secrets techniques)
- Les fiches contact peuvent contenir des emails personnels — traiter avec respect

### Statuts de suivi

Les statuts dans `tracker.md` suivent cette progression :

```
recherche → brouillon → envoye → repondu → en discussion → partenariat
                                                          → refuse
                                         → sans reponse → relance
```

---

## References

- **Positionnement marketing** : `.claude/commands/aquisition-copy.md`
- **Strategie Tournesol detaillee** : `docs/STRATEGIE-TOURNESOL-PARTENARIAT.md`
- **Credits et partenaires** : `CREDITS.md`
- **Marketing existant** : `marketing/` (posts LinkedIn/Twitter, pitch deck, scripts video)

---

## Types de contacts

### Partenaires techniques / API
Projets open-source ou API que DeepSight integre. Objectif : formaliser l'usage, obtenir un accord, co-branding.
Template : `templates/email-partenaire-tech.md`

### Createurs / Influenceurs
YouTubeurs, vulgarisateurs, createurs de contenu. Objectif : test gratuit, review, collaboration.
Template : `templates/email-createur.md`

### Institutionnels (futur)
BPI, French Tech, fonds, programmes EU. Non encore implemente.

---

*Derniere mise a jour : 10 avril 2026*
