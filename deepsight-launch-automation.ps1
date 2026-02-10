<#
.SYNOPSIS
    DeepSight Launch Automation - Orchestration Claude Code
.DESCRIPTION
    Lance 6 prompts Claude Code sequentiellement pour preparer DeepSight au lancement production.
    Utilise cmd /c claude avec Start-Job pour gerer les timeouts.
    Chaque etape est loggee, avec gestion des erreurs et reprise possible.
.PARAMETER StartFrom
    Numero d'etape a partir duquel reprendre (1-6). Par defaut : 1.
.PARAMETER DryRun
    Affiche les commandes sans les executer.
.EXAMPLE
    .\deepsight-launch-automation.ps1
    .\deepsight-launch-automation.ps1 -StartFrom 3
    .\deepsight-launch-automation.ps1 -DryRun
#>

param(
    [ValidateRange(1, 6)]
    [int]$StartFrom = 1,

    [switch]$DryRun
)

# ============================================================
# Configuration
# ============================================================

$ErrorActionPreference = "Stop"
$ProjectPath = "C:\Users\33667\DeepSight-Main"
$LogDir = Join-Path $ProjectPath "logs\launch-automation"
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$PauseBetweenSteps = 10

# Compteurs
$script:Successes = 0
$script:Failures = 0
$script:Skips = 0

# ============================================================
# Definition des 6 etapes
# ============================================================

$Steps = @(
    @{
        Number     = 1
        Name       = "Audit Variables Env"
        TimeoutMin = 10
        Prompt     = @"
Tu travailles sur le projet DeepSight dans $ProjectPath.

MISSION : Audit complet des variables d'environnement sur tout le projet.

ETAPES OBLIGATOIRES :

1. SCANNER tout le code source :
   - backend/src/**/*.py : chercher os.environ, os.getenv, settings., config.
   - frontend/src/**/*.ts,*.tsx : chercher import.meta.env, VITE_
   - mobile/src/**/*.ts,*.tsx : chercher process.env, Constants.expoConfig
   - extension/src/**/*.ts : chercher des references a des URLs ou cles API
   - Fichiers docker-compose, railway.json, vercel.json, app.json

2. Pour CHAQUE variable trouvee, documenter :
   - Nom exact de la variable
   - Fichier(s) ou elle est utilisee
   - Si elle est requise ou optionnelle
   - Valeur par defaut si presente
   - Si c'est une cle TEST vs LIVE (chercher sk_test_, pk_test_, re_test_, etc.)

3. GENERER docs/env-audit.md avec :
   - Tableau complet de toutes les variables par composant (Backend, Frontend, Mobile, Extension)
   - Colonnes : Variable | Fichiers | Requis | Defaut | Notes
   - Section "ALERTES" pour les cles test trouvees dans du code production
   - Section "Variables manquantes" si referencees mais pas dans .env.example

4. METTRE A JOUR ou CREER les fichiers .env.example :
   - backend/.env.example avec toutes les variables backend, commentees par section
   - frontend/.env.example avec toutes les variables frontend
   - mobile/.env.example si pertinent

5. MODIFIER backend/src/core/config.py :
   - Utiliser pydantic-settings (BaseSettings) si pas deja fait
   - Ajouter une validation qui REFUSE de demarrer si :
     * STRIPE_SECRET_KEY commence par sk_test_ et ENV=production
     * STRIPE_WEBHOOK_SECRET commence par whsec_test_ et ENV=production
     * Toute cle API contenant "test" quand ENV=production
   - Ajouter un validator Pydantic qui leve une erreur claire au demarrage
   - Ajouter ENV: str = "development" si pas present

6. VERIFIER que le code compile apres modifications :
   - cd backend && python -c "from core.config import settings; print('Config OK')"

Ne touche PAS aux autres fichiers que ceux mentionnes. Fais des commits atomiques.
"@
    },
    @{
        Number     = 2
        Name       = "Emails Transactionnels"
        TimeoutMin = 15
        Prompt     = @"
Tu travailles sur le projet DeepSight dans $ProjectPath.

MISSION : Implementer le systeme d'emails transactionnels avec Resend.

ETAPES OBLIGATOIRES :

1. INSTALLER les dependances :
   - cd backend && pip install resend jinja2
   - Ajouter resend et jinja2 a requirements.txt

2. CREER backend/src/services/email_service.py :
   - Classe EmailService avec methode send_email(to, subject, html_body)
   - Utiliser resend.Emails.send() avec RESEND_API_KEY depuis config
   - FROM_EMAIL depuis config (defaut: noreply@deepsightsynthesis.com)
   - Methodes specifiques :
     * send_welcome(email, username) - Email de bienvenue apres inscription
     * send_password_reset(email, reset_token, reset_url) - Lien de reinitialisation
     * send_payment_success(email, plan_name, amount, next_billing_date) - Confirmation paiement
     * send_payment_failed(email, plan_name, reason) - Echec de paiement
     * send_analysis_complete(email, video_title, summary_url) - Analyse terminee
   - Gestion d'erreurs avec logging (ne pas crash si email echoue)
   - Mode async avec asyncio

3. CREER les templates HTML dans backend/src/templates/emails/ :
   - base.html : Layout commun (header DeepSight, footer, styles inline CSS)
   - welcome.html : Bienvenue, bouton "Commencer", features cles
   - reset_password.html : Lien de reinitialisation (expire 1h), instructions
   - payment_success.html : Recapitulatif paiement, features du plan, date prochain paiement
   - payment_failed.html : Alerte, raison, bouton MAJ moyen de paiement
   - analysis_complete.html : Titre video, resume court, bouton "Voir l'analyse"
   - TOUS les templates en FRANCAIS
   - Design coherent : fond sombre #0a0a0f, accents bleu #3b82f6, police sans-serif
   - Utiliser Jinja2 pour le templating

4. CREER backend/src/services/email_templates.py :
   - Fonction render_template(template_name, **kwargs) -> str
   - Charger les templates Jinja2 depuis le dossier templates/emails/
   - Configurer Jinja2 Environment avec FileSystemLoader

5. INTEGRER aux endpoints existants :
   - POST /api/auth/register : envoyer send_welcome apres creation user
   - POST /api/auth/forgot-password : envoyer send_password_reset
   - Webhooks Stripe checkout.session.completed : envoyer send_payment_success
   - Webhooks Stripe invoice.payment_failed : envoyer send_payment_failed
   - NE PAS casser les endpoints existants, ajouter l'envoi d'email en plus

6. AJOUTER les variables dans config.py :
   - RESEND_API_KEY: str = ""
   - FROM_EMAIL: str = "noreply@deepsightsynthesis.com"
   - EMAIL_ENABLED: bool = True (pour pouvoir desactiver en dev)

7. VERIFIER :
   - cd backend/src && python -c "from services.email_service import EmailService; print('Email OK')"
   - S'assurer que les imports sont corrects dans tous les fichiers modifies

Fais des commits atomiques apres chaque fichier cree.
"@
    },
    @{
        Number     = 3
        Name       = "Audit Stripe Webhooks"
        TimeoutMin = 12
        Prompt     = @"
Tu travailles sur le projet DeepSight dans $ProjectPath.

MISSION : Audit complet de l'integration Stripe et correction des webhooks.

ETAPES OBLIGATOIRES :

1. SCANNER tous les fichiers utilisant Stripe :
   - Chercher "stripe" dans tout backend/src/
   - Lister chaque endpoint, chaque appel API Stripe, chaque webhook handler
   - Identifier les fichiers : billing/router.py, billing/service.py, etc.

2. AUDITER les webhooks - Verifier que TOUS ces events sont geres :
   - checkout.session.completed : creer/upgrade subscription, crediter le user
   - customer.subscription.updated : sync plan/status dans la DB
   - customer.subscription.deleted : downgrade vers Free, revoquer features
   - invoice.payment_failed : marquer le payment comme failed, notifier user
   - invoice.payment_succeeded : renouveler les credits mensuels
   - Pour chaque event : verifier la logique metier, les edge cases

3. VERIFIER la securite des webhooks :
   - Validation de signature Stripe (stripe.Webhook.construct_event)
   - Verifier que STRIPE_WEBHOOK_SECRET est utilise
   - Verifier l'idempotency (ne pas traiter 2 fois le meme event)
     * Ajouter un champ stripe_event_id dans la table transactions si absent
     * Verifier l'unicite avant traitement

4. AJOUTER un endpoint de diagnostic :
   - GET /api/stripe/health (admin only)
   - Verifie la connexion a Stripe (stripe.Account.retrieve)
   - Verifie que le webhook secret est configure
   - Liste les webhooks enregistres si possible
   - Retourne un JSON avec status de chaque verification

5. INTEGRER EmailService dans les webhooks :
   - checkout.session.completed -> send_payment_success
   - invoice.payment_failed -> send_payment_failed
   - Importer EmailService depuis services/email_service.py
   - Appeler les methodes email APRES la logique metier (ne pas bloquer si email echoue)

6. CORRIGER les problemes trouves :
   - Ajouter les handlers d'events manquants
   - Fixer les problemes d'idempotency
   - Ajouter des logs structures pour chaque event traite

7. GENERER docs/stripe-audit.md :
   - Liste de tous les endpoints Stripe
   - Matrice des webhooks (event -> handler -> action -> email)
   - Problemes trouves et corrections appliquees
   - Configuration requise (variables env)
   - Procedure de test des webhooks (stripe CLI)

8. VERIFIER :
   - Pas d'erreurs de syntaxe dans les fichiers modifies
   - Les imports sont corrects

Fais des commits atomiques.
"@
    },
    @{
        Number     = 4
        Name       = "Backup PostgreSQL S3"
        TimeoutMin = 12
        Prompt     = @"
Tu travailles sur le projet DeepSight dans $ProjectPath.

MISSION : Implementer un systeme de backup automatique PostgreSQL vers S3.

ETAPES OBLIGATOIRES :

1. INSTALLER les dependances :
   - cd backend && pip install boto3 apscheduler psycopg2-binary
   - Ajouter a requirements.txt

2. CREER backend/src/scripts/backup_db.py :
   - Fonction async backup_database() :
     * Extraire host/port/user/pass/dbname depuis DATABASE_URL (config)
     * Dump SQL via psycopg2 (pas pg_dump) en utilisant COPY pour chaque table
     * Compresser en .gz avec gzip
     * Nommer : deepsight_backup_YYYY-MM-DD_HH-MM-SS.sql.gz
     * Upload vers S3 bucket (S3_BACKUP_BUCKET) avec boto3
     * Supprimer les backups de plus de 30 jours sur S3 (retention policy)
     * Envoyer email notification (succes ou echec) via EmailService
     * Logger chaque etape
   - Fonction async restore_database(backup_key) :
     * Telecharger le backup depuis S3
     * Decompresser
     * Restaurer via psycopg2
     * Logger chaque etape

3. CREER backend/src/scripts/restore_db.py :
   - Script CLI standalone : python restore_db.py --backup-key <key>
   - Demander confirmation avant restauration
   - Afficher les backups disponibles si --list

4. CONFIGURER APScheduler :
   - Dans main.py ou un fichier dedie backend/src/core/scheduler.py
   - Job de backup quotidien a 3h00 UTC
   - Utiliser BackgroundScheduler ou AsyncIOScheduler
   - S'assurer que le scheduler demarre avec l'app FastAPI (lifespan)

5. CREER les endpoints admin :
   - POST /api/admin/backup/trigger : lancer un backup manuellement (admin only)
   - GET /api/admin/backup/list : lister les backups disponibles sur S3
     * Retourner : nom, taille, date, URL de telechargement pre-signee (expire 1h)
   - Proteger avec require_admin ou require_plan("team")

6. AJOUTER les variables dans config.py :
   - S3_BACKUP_BUCKET: str = ""
   - S3_ACCESS_KEY: str = ""
   - S3_SECRET_KEY: str = ""
   - S3_REGION: str = "eu-west-3"
   - S3_ENDPOINT_URL: str = "" (pour compatibilite MinIO/Backblaze)
   - BACKUP_RETENTION_DAYS: int = 30
   - BACKUP_ENABLED: bool = False

7. GENERER docs/backup-restore.md :
   - Architecture du systeme de backup
   - Configuration S3 requise (IAM policy minimale)
   - Comment declencher un backup manuel
   - Procedure de restauration pas a pas
   - Verification de l'integrite des backups
   - Troubleshooting

8. VERIFIER :
   - Pas d'erreurs d'import
   - Le scheduler ne crash pas au demarrage si BACKUP_ENABLED=False

Fais des commits atomiques.
"@
    },
    @{
        Number     = 5
        Name       = "Monitoring Page Status"
        TimeoutMin = 15
        Prompt     = @"
Tu travailles sur le projet DeepSight dans $ProjectPath.

MISSION : Implementer le monitoring des services et une page de statut publique.

ETAPES OBLIGATOIRES :

1. CREER backend/src/health/router.py :
   - GET /api/health/ping : retourne {"status": "ok", "timestamp": "..."} (public, ultra-leger)
   - GET /api/health/status : check complet de chaque service :
     * database : tester une requete simple (SELECT 1)
     * stripe : stripe.Account.retrieve() dans un try/catch
     * mistral : verifier que MISTRAL_API_KEY est defini et tester un appel leger
     * perplexity : verifier que PERPLEXITY_API_KEY est defini
     * resend : verifier que RESEND_API_KEY est defini
     * s3 : tester la connexion au bucket si BACKUP_ENABLED
   - Format de reponse :
     {
       "status": "healthy" | "degraded" | "down",
       "timestamp": "ISO8601",
       "uptime_seconds": int,
       "services": {
         "database": {"status": "up", "latency_ms": 12},
         "stripe": {"status": "up", "latency_ms": 45},
         "mistral": {"status": "up"},
         "perplexity": {"status": "down", "error": "API key missing"},
         ...
       }
     }
   - "healthy" si tous up, "degraded" si certains down, "down" si database down

2. ENREGISTRER le router dans main.py :
   - app.include_router(health_router, prefix="/api/health", tags=["Health"])

3. CREER le background monitoring :
   - Dans core/scheduler.py (reutiliser le scheduler du backup)
   - Job toutes les 5 minutes : appeler la logique de /api/health/status
   - Si status passe de "healthy" a "degraded" ou "down" :
     * Envoyer email d'alerte via EmailService a ADMIN_EMAIL
     * Logger en WARNING/ERROR
   - Si status revient a "healthy" apres un incident :
     * Envoyer email de resolution
   - Stocker le dernier status en memoire pour comparaison

4. CREER la page React /status dans le frontend :
   - frontend/src/pages/StatusPage.tsx
   - Polling toutes les 30 secondes vers /api/health/status
   - Pour chaque service, afficher :
     * Nom du service
     * Indicateur couleur : vert (up), orange (degraded), rouge (down)
     * Latence si disponible
     * Dernier check timestamp
   - Header avec status global : "Tous les systemes operationnels" / "Degradation partielle" / "Incident en cours"
   - Design coherent avec le reste de l'app (dark mode, couleurs DeepSight)
   - Responsive (mobile-friendly)

5. AJOUTER la route dans le router React :
   - Dans le fichier de routes principal, ajouter /status -> StatusPage
   - Page publique (pas besoin d'auth)

6. AJOUTER dans config.py :
   - ADMIN_EMAIL: str = "" (email pour les alertes)
   - MONITORING_INTERVAL_MINUTES: int = 5
   - MONITORING_ENABLED: bool = True

7. GENERER docs/monitoring.md :
   - Architecture du monitoring
   - Endpoints disponibles
   - Configuration des alertes
   - Comment ajouter un nouveau service a monitorer
   - Integration avec UptimeRobot (instructions)

8. VERIFIER :
   - cd frontend && npm run typecheck (seulement les fichiers modifies/crees)
   - Pas d'erreurs d'import cote backend

Fais des commits atomiques.
"@
    },
    @{
        Number     = 6
        Name       = "Support Crisp Contact"
        TimeoutMin = 15
        Prompt     = @"
Tu travailles sur le projet DeepSight dans $ProjectPath.

MISSION : Integrer Crisp Chat et creer une page de contact complete.

ETAPES OBLIGATOIRES :

1. CREER le composant Crisp Chat pour le frontend :
   - frontend/src/components/CrispChat.tsx
   - Charger le script Crisp avec VITE_CRISP_WEBSITE_ID
   - Injecter le script dans le DOM via useEffect
   - Ne charger que si VITE_CRISP_WEBSITE_ID est defini
   - Ajouter le composant dans le layout principal (App.tsx ou Layout)

2. CREER la page /contact dans le frontend :
   - frontend/src/pages/ContactPage.tsx
   - Formulaire de contact :
     * Champs : Nom, Email, Sujet (select: Bug, Question, Suggestion, Autre), Message
     * Validation cote client (email valide, message min 10 chars)
     * Bouton d'envoi avec etat loading
     * Message de succes/erreur apres envoi
   - Section FAQ avec accordion/collapsible :
     * "Comment analyser une video ?" -> Explication etapes
     * "Quels sont les plans disponibles ?" -> Resume + lien pricing
     * "Comment annuler mon abonnement ?" -> Via portail Stripe
     * "L'analyse est bloquee, que faire ?" -> Refresh, re-essayer, contacter support
     * "Comment exporter mon analyse ?" -> PDF/DOCX/Markdown selon plan
     * "Mes donnees sont-elles securisees ?" -> Chiffrement, RGPD, pas de revente
     * Au moins 6 questions
   - Design coherent dark mode DeepSight
   - Responsive

3. AJOUTER la route /contact dans le router React :
   - Page publique (pas besoin d'auth)

4. CREER l'endpoint backend :
   - POST /api/contact dans un nouveau fichier backend/src/contact/router.py
   - Schema Pydantic : ContactRequest(name, email, subject, message)
   - Rate limiting : maximum 3 requetes par heure par IP
     * Utiliser un simple dict en memoire avec timestamp (ou slowapi si deja installe)
   - Envoyer un email a ADMIN_EMAIL via EmailService avec les details du formulaire
   - Envoyer un email de confirmation a l'expediteur
   - Retourner {"status": "sent", "message": "Votre message a ete envoye"}
   - Enregistrer le router dans main.py

5. CREER l'ecran Contact dans l'app mobile :
   - mobile/src/screens/ContactScreen.tsx
   - Meme formulaire que le web (adapte React Native)
   - FAQ accordion avec Animated/Reanimated
   - Lien vers le chat Crisp (ouvrir dans le navigateur)
   - Style coherent avec le theme mobile existant (useTheme)
   - ScrollView pour le contenu long
   - Ajouter l'ecran dans la navigation (si approprie)

6. AJOUTER les variables :
   - Frontend .env.example : VITE_CRISP_WEBSITE_ID
   - Backend config.py : ADMIN_EMAIL (si pas deja fait), CONTACT_RATE_LIMIT: int = 3

7. VERIFIER :
   - cd frontend && npm run typecheck
   - Pas d'erreurs d'import cote backend et mobile

Fais des commits atomiques.
"@
    }
)

# ============================================================
# Fonctions utilitaires
# ============================================================

function Write-StepHeader {
    param([int]$Number, [string]$Name)
    $border = "=" * 60
    Write-Host ""
    Write-Host $border -ForegroundColor Cyan
    Write-Host "  ETAPE $Number/6 : $Name" -ForegroundColor Cyan
    Write-Host $border -ForegroundColor Cyan
    Write-Host ""
}

function Write-Report {
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Magenta
    Write-Host "  RAPPORT FINAL" -ForegroundColor Magenta
    Write-Host ("=" * 60) -ForegroundColor Magenta
    Write-Host ""
    Write-Host "  Succes  : $($script:Successes)" -ForegroundColor Green
    Write-Host "  Echecs  : $($script:Failures)" -ForegroundColor Red
    Write-Host "  Skippes : $($script:Skips)" -ForegroundColor Yellow
    Write-Host "  Total   : 6" -ForegroundColor White
    Write-Host ""

    if ($script:Failures -gt 0) {
        Write-Host "  /!\ Certaines etapes ont echoue. Verifiez les logs dans :" -ForegroundColor Yellow
        Write-Host "    $LogDir" -ForegroundColor Yellow
        Write-Host ""
    }

    Write-Host ("=" * 60) -ForegroundColor Magenta
    Write-Host "  CHECKLIST ACTIONS MANUELLES" -ForegroundColor Magenta
    Write-Host ("=" * 60) -ForegroundColor Magenta
    Write-Host ""
    Write-Host "  [ ] 1. Creer un compte Resend (https://resend.com)" -ForegroundColor White
    Write-Host "       - Verifier le domaine deepsightsynthesis.com" -ForegroundColor Gray
    Write-Host "       - Copier la cle API dans RESEND_API_KEY" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  [ ] 2. Creer un compte Crisp (https://crisp.chat)" -ForegroundColor White
    Write-Host "       - Recuperer le Website ID" -ForegroundColor Gray
    Write-Host "       - Ajouter VITE_CRISP_WEBSITE_ID dans Vercel" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  [ ] 3. Configurer un bucket S3 pour les backups" -ForegroundColor White
    Write-Host "       - Creer un bucket (AWS S3, Backblaze B2, ou MinIO)" -ForegroundColor Gray
    Write-Host "       - Creer un utilisateur IAM avec acces limite au bucket" -ForegroundColor Gray
    Write-Host "       - Ajouter S3_BACKUP_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  [ ] 4. Configurer UptimeRobot (https://uptimerobot.com)" -ForegroundColor White
    Write-Host "       - Ajouter le monitor HTTP pour /api/health/ping" -ForegroundColor Gray
    Write-Host "       - Configurer les alertes email/SMS" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  [ ] 5. Mettre a jour les variables d'env sur Railway :" -ForegroundColor White
    Write-Host "       - RESEND_API_KEY" -ForegroundColor Gray
    Write-Host "       - ADMIN_EMAIL" -ForegroundColor Gray
    Write-Host "       - S3_BACKUP_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION" -ForegroundColor Gray
    Write-Host "       - BACKUP_ENABLED=true" -ForegroundColor Gray
    Write-Host "       - MONITORING_ENABLED=true" -ForegroundColor Gray
    Write-Host "       - ENV=production" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  [ ] 6. Mettre a jour les variables sur Vercel :" -ForegroundColor White
    Write-Host "       - VITE_CRISP_WEBSITE_ID" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  [ ] 7. Configurer les webhooks Stripe (Dashboard Stripe) :" -ForegroundColor White
    Write-Host "       - URL: https://deep-sight-backend-v3-production.up.railway.app/api/billing/webhook" -ForegroundColor Gray
    Write-Host "       - Events: checkout.session.completed, customer.subscription.updated," -ForegroundColor Gray
    Write-Host "         customer.subscription.deleted, invoice.payment_failed, invoice.payment_succeeded" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  [ ] 8. Tester manuellement :" -ForegroundColor White
    Write-Host "       - Envoyer un email test via Resend" -ForegroundColor Gray
    Write-Host "       - Verifier /api/health/status" -ForegroundColor Gray
    Write-Host "       - Tester le webhook Stripe avec stripe CLI" -ForegroundColor Gray
    Write-Host "       - Declencher un backup test via /api/admin/backup/trigger" -ForegroundColor Gray
    Write-Host "       - Verifier que le chat Crisp apparait sur le site" -ForegroundColor Gray
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Magenta
}

function Run-Step {
    param(
        [hashtable]$Step
    )

    $stepNum = $Step.Number
    $stepName = $Step.Name
    $timeoutMin = $Step.TimeoutMin
    $prompt = $Step.Prompt
    $safeStepName = $stepName -replace '\s+', '-'
    $logFile = Join-Path $LogDir "step-${stepNum}-${safeStepName}-${Timestamp}.log"

    Write-StepHeader -Number $stepNum -Name $stepName

    if ($DryRun) {
        Write-Host "  [DRY RUN] Commande qui serait executee :" -ForegroundColor Yellow
        Write-Host "  cmd /c claude -p <prompt $stepName> --dangerously-skip-permissions" -ForegroundColor Gray
        Write-Host "  Timeout: ${timeoutMin} minutes" -ForegroundColor Gray
        Write-Host "  Log: $logFile" -ForegroundColor Gray
        Write-Host ""
        $script:Skips++
        return $true
    }

    Write-Host "  Timeout  : ${timeoutMin} minutes" -ForegroundColor Gray
    Write-Host "  Log      : $logFile" -ForegroundColor Gray
    Write-Host "  Demarrage: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Gray
    Write-Host ""

    # Ecrire le prompt dans un fichier temporaire pour eviter les problemes d'echappement
    $promptFile = Join-Path $LogDir "prompt-step-${stepNum}.txt"
    $prompt | Out-File -FilePath $promptFile -Encoding utf8

    $timeoutSec = $timeoutMin * 60

    try {
        # Lancer claude via cmd /c dans un job PowerShell pour gerer le timeout
        $job = Start-Job -ScriptBlock {
            param($WorkDir, $PromptFilePath, $LogFilePath)
            Set-Location $WorkDir
            $promptContent = Get-Content -Path $PromptFilePath -Raw
            cmd /c "claude -p `"$promptContent`" --dangerously-skip-permissions 2>&1" | Tee-Object -FilePath $LogFilePath
        } -ArgumentList $ProjectPath, $promptFile, $logFile

        # Attendre le job avec timeout
        $completed = $job | Wait-Job -Timeout $timeoutSec

        if ($null -eq $completed) {
            # Timeout atteint
            Write-Host "  TIMEOUT apres ${timeoutMin} minutes !" -ForegroundColor Red
            $job | Stop-Job -PassThru | Remove-Job -Force
            Add-Content -Path $logFile -Value "`n[TIMEOUT] Processus arrete apres ${timeoutMin} minutes"
            return $false
        }

        # Recuperer la sortie du job
        $jobOutput = $job | Receive-Job
        $jobState = $job.State
        $job | Remove-Job -Force

        if ($jobState -eq "Failed") {
            Write-Host "  ECHEC (job en erreur)" -ForegroundColor Red
            return $false
        }

        Write-Host "  SUCCES" -ForegroundColor Green
        Write-Host "  Fin: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Gray
        return $true
    }
    catch {
        Write-Host "  ERREUR: $($_.Exception.Message)" -ForegroundColor Red
        Add-Content -Path $logFile -Value "`n[ERROR] $($_.Exception.Message)"
        return $false
    }
    finally {
        # Nettoyer le fichier prompt temporaire
        if (Test-Path $promptFile) {
            Remove-Item $promptFile -Force
        }
    }
}

# ============================================================
# Execution principale
# ============================================================

# Banner
Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host "  DeepSight Launch Automation" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host ""
Write-Host "  Projet    : $ProjectPath" -ForegroundColor White
Write-Host "  Demarrage : Etape $StartFrom" -ForegroundColor White
Write-Host "  Mode      : $(if ($DryRun) { 'DRY RUN' } else { 'EXECUTION' })" -ForegroundColor $(if ($DryRun) { 'Yellow' } else { 'Green' })
Write-Host "  Logs      : $LogDir" -ForegroundColor White
Write-Host ""

# Creer le dossier de logs
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    Write-Host "  Dossier de logs cree : $LogDir" -ForegroundColor Gray
}

# Verifier que claude est installe
if (-not $DryRun) {
    $claudeCmd = Get-Command "claude" -ErrorAction SilentlyContinue
    if (-not $claudeCmd) {
        Write-Host "  ERREUR: 'claude' n'est pas trouve dans le PATH." -ForegroundColor Red
        Write-Host "  Installez Claude Code : npm install -g @anthropic-ai/claude-code" -ForegroundColor Yellow
        exit 1
    }
}

# Boucle sur les etapes
foreach ($step in $Steps) {
    if ($step.Number -lt $StartFrom) {
        continue
    }

    $retry = $true
    while ($retry) {
        $retry = $false
        $success = Run-Step -Step $step

        if ($success) {
            $script:Successes++
        }
        else {
            if (-not $DryRun) {
                Write-Host ""
                Write-Host "  L'etape $($step.Number) ($($step.Name)) a echoue." -ForegroundColor Red
                Write-Host ""
                $choice = Read-Host "  [r] Reessayer  [s] Skipper  [q] Quitter  > "

                switch ($choice.ToLower()) {
                    "r" {
                        Write-Host "  Nouvelle tentative..." -ForegroundColor Yellow
                        $retry = $true
                    }
                    "s" {
                        Write-Host "  Etape skippee." -ForegroundColor Yellow
                        $script:Skips++
                    }
                    "q" {
                        Write-Host "  Arret demande par l'utilisateur." -ForegroundColor Red
                        $script:Failures++
                        Write-Report
                        exit 1
                    }
                    default {
                        Write-Host "  Choix invalide, on skip." -ForegroundColor Yellow
                        $script:Skips++
                    }
                }
            }
            else {
                $script:Skips++
            }
        }
    }

    # Pause entre les etapes (sauf la derniere)
    if ($step.Number -lt 6 -and $step.Number -ge $StartFrom -and -not $DryRun) {
        Write-Host ""
        Write-Host "  Pause de ${PauseBetweenSteps}s avant l'etape suivante..." -ForegroundColor Gray
        Start-Sleep -Seconds $PauseBetweenSteps
    }
}

# Rapport final
Write-Report

# Code de sortie
if ($script:Failures -gt 0) {
    exit 1
}
exit 0
