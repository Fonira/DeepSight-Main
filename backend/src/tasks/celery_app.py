"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔄 CELERY APP v2.0 — File de Tâches Asynchrones                                   ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  FONCTIONNALITÉS:                                                                  ║
║  • 📊 Queues séparées par priorité (video, tts, notifications)                    ║
║  • 🔁 Retry automatique avec exponential backoff                                  ║
║  • 📈 Rate limiting par type de tâche                                             ║
║  • 🕐 Tâches périodiques (cleanup, sync, reports)                                 ║
║  • 📡 Callbacks de progression pour UI temps réel                                 ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
from datetime import timedelta
from typing import Any, Dict, Optional
from celery import Celery, Task
from celery.schedules import crontab
from kombu import Queue, Exchange

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", f"{REDIS_URL.rsplit('/', 1)[0]}/1")
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", f"{REDIS_URL.rsplit('/', 1)[0]}/2")

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 QUEUES DEFINITION
# ═══════════════════════════════════════════════════════════════════════════════

# Exchanges
default_exchange = Exchange('default', type='direct')
video_exchange = Exchange('video', type='direct')
priority_exchange = Exchange('priority', type='direct')

# Queues avec priorités
TASK_QUEUES = (
    # Queue par défaut
    Queue('default', default_exchange, routing_key='default'),
    
    # Queue vidéo (analyses longues, basse priorité)
    Queue('video', video_exchange, routing_key='video',
          queue_arguments={'x-max-priority': 10}),
    
    # Queue TTS (rapide)
    Queue('tts', default_exchange, routing_key='tts'),
    
    # Queue notifications (haute priorité)
    Queue('notifications', priority_exchange, routing_key='notifications',
          queue_arguments={'x-max-priority': 10}),
    
    # Queue maintenance (très basse priorité)
    Queue('maintenance', default_exchange, routing_key='maintenance'),
)

# Routes par tâche
TASK_ROUTES = {
    'tasks.analyze_video_task': {'queue': 'video', 'routing_key': 'video'},
    'tasks.analyze_playlist_task': {'queue': 'video', 'routing_key': 'video'},
    'tasks.generate_tts_task': {'queue': 'tts', 'routing_key': 'tts'},
    'tasks.send_email_task': {'queue': 'notifications', 'routing_key': 'notifications'},
    'tasks.send_webhook_task': {'queue': 'notifications', 'routing_key': 'notifications'},
    'tasks.cleanup_cache_task': {'queue': 'maintenance', 'routing_key': 'maintenance'},
    'tasks.sync_stripe_task': {'queue': 'maintenance', 'routing_key': 'maintenance'},
}

# ═══════════════════════════════════════════════════════════════════════════════
# 🏭 CELERY APP
# ═══════════════════════════════════════════════════════════════════════════════

celery_app = Celery(
    'deepsight',
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=['tasks.analysis_tasks', 'tasks.notification_tasks', 'tasks.maintenance_tasks']
)

# Configuration
celery_app.conf.update(
    # ═══════════════════════════════════════════════════════════════════════════
    # 🔧 GENERAL
    # ═══════════════════════════════════════════════════════════════════════════
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 📊 QUEUES
    # ═══════════════════════════════════════════════════════════════════════════
    task_queues=TASK_QUEUES,
    task_routes=TASK_ROUTES,
    task_default_queue='default',
    task_default_exchange='default',
    task_default_routing_key='default',
    
    # ═══════════════════════════════════════════════════════════════════════════
    # ⏱️ TIMEOUTS & LIMITS
    # ═══════════════════════════════════════════════════════════════════════════
    task_soft_time_limit=300,      # 5 minutes soft limit
    task_time_limit=600,           # 10 minutes hard limit
    task_acks_late=True,           # Acknowledge after completion
    task_reject_on_worker_lost=True,
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 🔁 RETRY
    # ═══════════════════════════════════════════════════════════════════════════
    task_annotations={
        '*': {
            'rate_limit': '100/m',  # Default rate limit
        },
        'tasks.analyze_video_task': {
            'rate_limit': '10/m',   # 10 analyses par minute max
            'time_limit': 600,      # 10 minutes
        },
        'tasks.generate_tts_task': {
            'rate_limit': '20/m',   # 20 TTS par minute
            'time_limit': 120,      # 2 minutes
        },
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 🗄️ RESULT BACKEND
    # ═══════════════════════════════════════════════════════════════════════════
    result_expires=86400,          # Results expire after 1 day
    result_extended=True,          # Store task metadata
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 👷 WORKER
    # ═══════════════════════════════════════════════════════════════════════════
    worker_prefetch_multiplier=4,  # Prefetch 4 tasks
    worker_max_tasks_per_child=100,  # Restart worker after 100 tasks
    worker_disable_rate_limits=False,
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 📡 EVENTS
    # ═══════════════════════════════════════════════════════════════════════════
    worker_send_task_events=True,
    task_send_sent_event=True,
)

# ═══════════════════════════════════════════════════════════════════════════════
# 🕐 BEAT SCHEDULE (Tâches Périodiques)
# ═══════════════════════════════════════════════════════════════════════════════

celery_app.conf.beat_schedule = {
    # Nettoyage du cache - tous les jours à 3h du matin
    'cleanup-cache-daily': {
        'task': 'tasks.cleanup_cache_task',
        'schedule': crontab(hour=3, minute=0),
        'options': {'queue': 'maintenance'},
    },
    
    # Nettoyage des tâches expirées - toutes les heures
    'cleanup-expired-tasks-hourly': {
        'task': 'tasks.cleanup_expired_tasks',
        'schedule': crontab(minute=0),  # Every hour
        'options': {'queue': 'maintenance'},
    },
    
    # Sync Stripe subscriptions - tous les jours à 4h
    'sync-stripe-daily': {
        'task': 'tasks.sync_stripe_subscriptions_task',
        'schedule': crontab(hour=4, minute=0),
        'options': {'queue': 'maintenance'},
    },
    
    # Rapport d'utilisation hebdomadaire - lundi 9h
    'weekly-usage-report': {
        'task': 'tasks.generate_weekly_report_task',
        'schedule': crontab(day_of_week=1, hour=9, minute=0),
        'options': {'queue': 'notifications'},
    },
    
    # Health check - toutes les 5 minutes
    'health-check': {
        'task': 'tasks.health_check_task',
        'schedule': timedelta(minutes=5),
        'options': {'queue': 'default'},
    },
}

# ═══════════════════════════════════════════════════════════════════════════════
# 🧩 BASE TASK CLASS
# ═══════════════════════════════════════════════════════════════════════════════

class BaseTask(Task):
    """
    Classe de base pour toutes les tâches Deep Sight.
    
    Features:
    - Auto-retry avec exponential backoff
    - Logging structuré
    - Callbacks de progression
    - Intégration Sentry
    """
    
    abstract = True
    autoretry_for = (Exception,)
    retry_backoff = True
    retry_backoff_max = 600  # Max 10 minutes
    retry_jitter = True
    max_retries = 3
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Appelé en cas d'échec définitif"""
        print(f"❌ [CELERY] Task {self.name} failed: {exc}", flush=True)
        
        # Report to Sentry
        try:
            import sentry_sdk
            sentry_sdk.capture_exception(exc)
        except ImportError:
            pass
        
        # Notify user if applicable
        user_id = kwargs.get('user_id') or (args[0] if args else None)
        if user_id:
            self._notify_failure(user_id, task_id, str(exc))
    
    def on_retry(self, exc, task_id, args, kwargs, einfo):
        """Appelé lors d'un retry"""
        print(f"🔄 [CELERY] Task {self.name} retrying (attempt {self.request.retries + 1}): {exc}", flush=True)
    
    def on_success(self, retval, task_id, args, kwargs):
        """Appelé en cas de succès"""
        print(f"✅ [CELERY] Task {self.name} completed: {task_id}", flush=True)
    
    def update_progress(self, current: int, total: int, message: str = ""):
        """Met à jour la progression de la tâche"""
        progress = int((current / total) * 100) if total > 0 else 0
        
        self.update_state(
            state='PROGRESS',
            meta={
                'current': current,
                'total': total,
                'progress': progress,
                'message': message,
            }
        )
        
        # Notify via Redis pub/sub for real-time UI
        self._publish_progress(progress, message)
    
    def _publish_progress(self, progress: int, message: str):
        """Publie la progression via Redis pour UI temps réel"""
        try:
            import redis
            r = redis.from_url(REDIS_URL)
            r.publish(
                f"task_progress:{self.request.id}",
                f"{progress}:{message}"
            )
        except Exception as e:
            pass  # Silently fail
    
    def _notify_failure(self, user_id: int, task_id: str, error: str):
        """Notifie l'utilisateur d'un échec"""
        try:
            # Enqueue notification task
            from tasks.notification_tasks import send_task_failure_notification
            send_task_failure_notification.delay(user_id, task_id, error)
        except Exception:
            pass


# Register base task
celery_app.Task = BaseTask

# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 TASK PRIORITIES
# ═══════════════════════════════════════════════════════════════════════════════

class TaskPriority:
    """Constantes de priorité pour les tâches"""
    LOW = 1
    NORMAL = 5
    HIGH = 8
    CRITICAL = 10


def apply_task_with_priority(
    task: Task,
    args: tuple = (),
    kwargs: dict = None,
    priority: int = TaskPriority.NORMAL,
    **options
) -> Any:
    """
    Applique une tâche avec une priorité spécifique.
    
    Usage:
        apply_task_with_priority(
            analyze_video_task,
            args=(video_id,),
            kwargs={'user_id': 123},
            priority=TaskPriority.HIGH
        )
    """
    kwargs = kwargs or {}
    return task.apply_async(
        args=args,
        kwargs=kwargs,
        priority=priority,
        **options
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 📤 EXPORTS
# ═══════════════════════════════════════════════════════════════════════════════

__all__ = [
    'celery_app',
    'BaseTask',
    'TaskPriority',
    'apply_task_with_priority',
]
