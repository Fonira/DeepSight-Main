# Guide de Configuration Apple Developer pour Deep Sight

Ce guide vous accompagne dans la configuration de votre compte Apple Developer pour publier Deep Sight sur l'App Store.

## Prérequis

1. Un compte Apple Developer ($99/an) : https://developer.apple.com/programs/
2. Expo CLI et EAS CLI installés
3. Node.js >= 18

## Étape 1 : Créer l'App sur App Store Connect

1. Connectez-vous à [App Store Connect](https://appstoreconnect.apple.com)
2. Cliquez sur "My Apps" → "+"  → "New App"
3. Remplissez les informations :
   - **Platforms** : iOS
   - **Name** : Deep Sight
   - **Primary Language** : French (France)
   - **Bundle ID** : com.deepsight.app
   - **SKU** : com.deepsight.app
   - **User Access** : Full Access

4. Notez l'**App ID** (visible dans l'URL : `https://appstoreconnect.apple.com/apps/XXXXXXXX`)

## Étape 2 : Obtenir vos identifiants

### Apple ID
Votre email de connexion Apple Developer (ex: `contact@deepsight.app`)

### ASC App ID
L'ID numérique de votre app sur App Store Connect (ex: `6740123456`)
- Visible dans l'URL de votre app
- Ou dans "App Information" → "Apple ID"

### Apple Team ID
1. Allez sur [Apple Developer](https://developer.apple.com/account)
2. Cliquez sur "Membership details"
3. Copiez le "Team ID" (format: `XXXXXXXXXX`)

## Étape 3 : Mettre à jour eas.json

Ouvrez `eas.json` et remplacez les valeurs placeholder :

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "VOTRE_EMAIL_APPLE",
        "ascAppId": "VOTRE_APP_ID",
        "appleTeamId": "VOTRE_TEAM_ID"
      }
    }
  }
}
```

## Étape 4 : Configurer les Credentials

### Option A : Automatique (Recommandé)

```bash
eas credentials
```

EAS va automatiquement :
- Créer les certificats de distribution
- Créer les profils de provisioning
- Les stocker de manière sécurisée

### Option B : Manuelle

1. Créez un certificat de distribution iOS sur Apple Developer Portal
2. Créez un App ID avec le bundle identifier `com.deepsight.app`
3. Créez un profil de provisioning de distribution

## Étape 5 : Générer les Icônes

```bash
# Installer sharp pour la conversion
npm install sharp --save-dev

# Générer les icônes PNG depuis les SVG
node scripts/generate-icons.js
```

Ou convertissez manuellement les SVG en PNG :
- `icon.svg` → `icon.png` (1024x1024)
- `splash.svg` → `splash.png` (1284x2778)
- `adaptive-icon.svg` → `adaptive-icon.png` (1024x1024)

## Étape 6 : Build et Soumission

### Build pour l'App Store

```bash
# Se connecter à Expo
eas login

# Build iOS
eas build --platform ios --profile production
```

### Soumettre à l'App Store

```bash
eas submit --platform ios --profile production
```

## Étape 7 : Préparer la Fiche App Store

Dans App Store Connect, complétez :

### Informations Générales
- **Subtitle** : Analyse de vidéos YouTube par IA
- **Category** : Productivity / Education
- **Age Rating** : 4+

### Description (FR)
```
Deep Sight transforme n'importe quelle vidéo YouTube en synthèse structurée grâce à l'intelligence artificielle.

FONCTIONNALITÉS PRINCIPALES :
• Analysez des vidéos YouTube en quelques secondes
• Choisissez parmi 4 modes d'analyse : synthèse, détaillé, critique, éducatif
• Discutez avec l'IA sur le contenu de la vidéo
• Générez des quiz et des mindmaps
• Exportez vos analyses en PDF, Markdown ou texte

POURQUOI DEEP SIGHT ?
• Gagnez du temps sur votre veille informationnelle
• Comprenez rapidement l'essentiel d'une vidéo
• Révisez efficacement avec les outils d'étude
• Vérifiez les faits avec notre fact-checking IA

Commencez gratuitement avec 20 analyses par mois !
```

### Keywords
```
youtube, analyse, IA, synthèse, résumé, vidéo, intelligence artificielle, étude, révision, éducation
```

### Screenshots Requis
- iPhone 6.7" (1290 × 2796)
- iPhone 6.5" (1284 × 2778)
- iPhone 5.5" (1242 × 2208)
- iPad Pro 12.9" (2048 × 2732)

### URL de Support
https://deepsight.app/support

### URL Politique de Confidentialité
https://deepsight.app/privacy

## Checklist Finale

- [ ] Compte Apple Developer actif
- [ ] App créée sur App Store Connect
- [ ] `eas.json` configuré avec vos identifiants
- [ ] Icônes générées (PNG 1024x1024)
- [ ] Screenshots préparées
- [ ] Textes de description prêts
- [ ] Build EAS réussi
- [ ] Soumission effectuée

## Troubleshooting

### Erreur "No matching provisioning profiles"
```bash
eas credentials --platform ios
# Sélectionnez "Build credentials" puis "Set up new"
```

### Erreur "Bundle ID already exists"
Vérifiez que le Bundle ID dans `app.json` est unique et correspond à celui créé sur Apple Developer Portal.

### Erreur d'authentification
```bash
eas logout
eas login
```

## Liens Utiles

- [Apple Developer Portal](https://developer.apple.com)
- [App Store Connect](https://appstoreconnect.apple.com)
- [Documentation EAS Submit](https://docs.expo.dev/submit/ios/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
