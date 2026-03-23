---
description: "Tech stack exact et bibliothèques autorisées pour chaque plateforme DeepSight. TOUJOURS consulter cette skill avant d'installer une dépendance, importer une librairie, ou choisir un outil/composant."
---

Tech Stack DeepSight — Référentiel des librairies
Frontend Web (/frontend)
CatégorieLibrairieNotesFrameworkNext.js 14+ (App Router)Pages dans app/, pas pages/LangageTypeScript strictStylingTailwind CSSClasses utilitaires uniquementComposants UIshadcn/uiComposants copiés, pas installésIcônesLucide ReactCohérence avec shadcnState globalZustandLéger, pas de ReduxRequêtes APIfetch natif ou axiosAvec intercepteurs authFormulairesReact Hook Form + ZodValidation type-safeAnimationsFramer MotionSi nécessaireChartsRechartsPour les visualisationsPaiements@stripe/stripe-jsCheckout côté clientToast/NotifssonnerVia shadcn
Interdit en Frontend : fs, path, child_process, toute lib Node-only.
Mobile (/mobile)
CatégorieLibrairieNotesFrameworkExpo SDK (dernière stable)Managed workflowLangageTypeScript strictNavigationReact Navigation (Stack + Tab)@react-navigation/*StylingStyleSheet.create()PAS de CSS, PAS de Tailwind natif sauf NativeWind si configuréStockage localexpo-secure-storePour tokensAsync storage@react-native-async-storagePour prefs non-sensiblesRequêtes APIfetch natif ou axiosIcônes@expo/vector-iconsIonicons, MaterialIconsAnimationsreact-native-reanimatedSi nécessaireNotificationsexpo-notificationsPush notifications
Composants natifs UNIQUEMENT :

✅ <View>, <Text>, <ScrollView>, <TouchableOpacity>, <FlatList>, <Image>, <TextInput>
❌ JAMAIS <div>, <span>, <p>, <button>, <input> (crash fatal)

Backend (/backend)
CatégorieLibrairieNotesFrameworkFastAPIAsync par défautServeurUvicornORMSQLAlchemy 2.0+ (async)Avec Alembic pour migrationsBDDPostgreSQLVia RailwayCacheRedisVia Hetzner VPSAuthpython-jose (JWT)Tokens signésValidationPydantic v2Modèles de requête/réponseIA SynthèseMistral AI SDKFact-checkPerplexity API + Brave SearchPipeline dualEmailsResendVérification, transactionnelPaiementsstripe (Python)Webhooks + checkoutTestsPytest + pytest-asyncioTâches bgCelery ou ARQAvec Redis broker
Convention Python :

snake_case partout (variables, fonctions, endpoints)
Type hints obligatoires
Docstrings sur les endpoints
async def par défaut pour les routes

Extension Chrome (/extension)
CatégorieOutilNotesManifestV3Obligatoire Chrome Web StoreLangageTypeScript/JavaScriptBuildWebpack ou ViteBundle pour ChromeAPIschrome.runtime, chrome.tabsManifest V3 APIsCommunicationMessages entre content/background/popup
Règle critique Extension : L'extraction de transcripts YouTube se fait côté BACKEND (pas côté extension) pour conformité Chrome Web Store.
Règle d'or
Avant de proposer un npm install X ou pip install Y :

Vérifier que la lib est dans ce référentiel
Si elle n'y est pas, la proposer avec justification et demander confirmation
Vérifier qu'on l'installe dans le BON dossier (frontend/mobile/backend/extension)