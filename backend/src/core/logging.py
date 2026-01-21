"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📊 LOGGING MODULE v1.0 — Logging Structuré pour Deep Sight                        ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  • Logs JSON structurés pour parsing facile                                        ║
║  • Contexte automatique (user_id, request_id, etc.)                               ║
║  • Niveaux: DEBUG, INFO, WARNING, ERROR, CRITICAL                                 ║
║  • Compatible avec Datadog, Grafana, ELK Stack                                    ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import sys
import json
import logging
import traceback
from datetime import datetime
from typing import Any, Dict, Optional
from functools import wraps
from contextvars import ContextVar
from uuid import uuid4

# ═══════════════════════════════════════════════════════════════════════════════
# 📦 CONTEXT VARIABLES (pour tracer les requêtes)
# ═══════════════════════════════════════════════════════════════════════════════

request_id_var: ContextVar[str] = ContextVar('request_id', default='')
user_id_var: ContextVar[Optional[int]] = ContextVar('user_id', default=None)
user_email_var: ContextVar[Optional[str]] = ContextVar('user_email', default=None)

# ═══════════════════════════════════════════════════════════════════════════════
# 🎨 CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_FORMAT = os.getenv("LOG_FORMAT", "json")  # "json" ou "text"
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
SERVICE_NAME = "deepsight-api"
VERSION = os.getenv("VERSION", "1.0.0")


class JSONFormatter(logging.Formatter):
    """
    Formatter JSON pour logs structurés.
    
    Format de sortie:
    {
        "timestamp": "2024-12-26T14:30:00.000Z",
        "level": "INFO",
        "service": "deepsight-api",
        "environment": "production",
        "message": "Video analysis started",
        "request_id": "abc123",
        "user_id": 42,
        "extra": {...}
    }
    """
    
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "service": SERVICE_NAME,
            "environment": ENVIRONMENT,
            "version": VERSION,
            "logger": record.name,
            "message": record.getMessage(),
        }
        
        # Ajouter le contexte de requête
        request_id = request_id_var.get()
        if request_id:
            log_data["request_id"] = request_id
        
        user_id = user_id_var.get()
        if user_id:
            log_data["user_id"] = user_id
        
        user_email = user_email_var.get()
        if user_email:
            log_data["user_email"] = user_email
        
        # Ajouter les extras
        if hasattr(record, 'extra_data') and record.extra_data:
            log_data["extra"] = record.extra_data
        
        # Ajouter l'exception si présente
        if record.exc_info:
            log_data["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": traceback.format_exception(*record.exc_info)
            }
        
        # Ajouter la localisation du code
        log_data["location"] = {
            "file": record.pathname,
            "line": record.lineno,
            "function": record.funcName
        }
        
        return json.dumps(log_data, default=str, ensure_ascii=False)


class ColoredFormatter(logging.Formatter):
    """Formatter coloré pour le développement local."""
    
    COLORS = {
        'DEBUG': '\033[36m',     # Cyan
        'INFO': '\033[32m',      # Green
        'WARNING': '\033[33m',   # Yellow
        'ERROR': '\033[31m',     # Red
        'CRITICAL': '\033[35m',  # Magenta
    }
    RESET = '\033[0m'
    BOLD = '\033[1m'
    
    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, self.RESET)
        
        # Format de base
        timestamp = datetime.now().strftime("%H:%M:%S")
        level = f"{color}{self.BOLD}{record.levelname:8}{self.RESET}"
        
        # Contexte
        request_id = request_id_var.get()
        user_id = user_id_var.get()
        ctx = ""
        if request_id:
            ctx += f" [{request_id[:8]}]"
        if user_id:
            ctx += f" [user:{user_id}]"
        
        # Message
        message = record.getMessage()
        
        # Extras
        extra_str = ""
        if hasattr(record, 'extra_data') and record.extra_data:
            extra_str = f" | {json.dumps(record.extra_data, default=str)}"
        
        # Exception
        exc_str = ""
        if record.exc_info:
            exc_str = f"\n{''.join(traceback.format_exception(*record.exc_info))}"
        
        return f"{timestamp} {level}{ctx} {message}{extra_str}{exc_str}"


class DeepSightLogger:
    """
    Logger principal pour Deep Sight.
    
    Usage:
        from core.logging import logger
        
        logger.info("Video analysis started", video_id="xyz", user_id=42)
        logger.error("Analysis failed", exc_info=True, video_id="xyz")
    """
    
    def __init__(self, name: str = "deepsight"):
        self._logger = logging.getLogger(name)
        self._logger.setLevel(getattr(logging, LOG_LEVEL))
        self._logger.handlers = []  # Clear existing handlers
        
        # Handler pour stdout
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(getattr(logging, LOG_LEVEL))
        
        # Choisir le formatter selon l'environnement
        if LOG_FORMAT == "json" or ENVIRONMENT == "production":
            handler.setFormatter(JSONFormatter())
        else:
            handler.setFormatter(ColoredFormatter())
        
        self._logger.addHandler(handler)
        self._logger.propagate = False
    
    def _log(self, level: int, message: str, exc_info: bool = False, **kwargs):
        """Log avec extras structurés."""
        record = self._logger.makeRecord(
            self._logger.name,
            level,
            "(unknown file)",
            0,
            message,
            (),
            None if not exc_info else sys.exc_info()
        )
        record.extra_data = kwargs if kwargs else None
        
        # Récupérer le vrai fichier/ligne (3 niveaux au-dessus)
        import inspect
        frame = inspect.currentframe()
        if frame:
            for _ in range(3):  # Remonter de 3 niveaux
                if frame.f_back:
                    frame = frame.f_back
            record.pathname = frame.f_code.co_filename
            record.lineno = frame.f_lineno
            record.funcName = frame.f_code.co_name
        
        self._logger.handle(record)
    
    def debug(self, message: str, **kwargs):
        """Log niveau DEBUG."""
        self._log(logging.DEBUG, message, **kwargs)
    
    def info(self, message: str, **kwargs):
        """Log niveau INFO."""
        self._log(logging.INFO, message, **kwargs)
    
    def warning(self, message: str, **kwargs):
        """Log niveau WARNING."""
        self._log(logging.WARNING, message, **kwargs)
    
    def error(self, message: str, exc_info: bool = False, **kwargs):
        """Log niveau ERROR."""
        self._log(logging.ERROR, message, exc_info=exc_info, **kwargs)
    
    def critical(self, message: str, exc_info: bool = False, **kwargs):
        """Log niveau CRITICAL."""
        self._log(logging.CRITICAL, message, exc_info=exc_info, **kwargs)
    
    def exception(self, message: str, **kwargs):
        """Log une exception avec traceback."""
        self._log(logging.ERROR, message, exc_info=True, **kwargs)


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 INSTANCE GLOBALE
# ═══════════════════════════════════════════════════════════════════════════════

logger = DeepSightLogger()


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def set_request_context(request_id: str = None, user_id: int = None, user_email: str = None):
    """
    Définit le contexte de la requête pour le logging.
    
    Usage dans un middleware FastAPI:
        @app.middleware("http")
        async def logging_middleware(request, call_next):
            set_request_context(
                request_id=str(uuid4()),
                user_id=getattr(request.state, 'user_id', None)
            )
            return await call_next(request)
    """
    if request_id:
        request_id_var.set(request_id)
    if user_id:
        user_id_var.set(user_id)
    if user_email:
        user_email_var.set(user_email)


def clear_request_context():
    """Nettoie le contexte de la requête."""
    request_id_var.set('')
    user_id_var.set(None)
    user_email_var.set(None)


def generate_request_id() -> str:
    """Génère un ID de requête unique."""
    return str(uuid4())


def log_execution_time(func):
    """
    Décorateur pour logger le temps d'exécution d'une fonction.
    
    Usage:
        @log_execution_time
        async def analyze_video(...):
            ...
    """
    @wraps(func)
    async def async_wrapper(*args, **kwargs):
        start = datetime.now()
        try:
            result = await func(*args, **kwargs)
            elapsed = (datetime.now() - start).total_seconds()
            logger.info(
                f"{func.__name__} completed",
                function=func.__name__,
                duration_seconds=elapsed,
                status="success"
            )
            return result
        except Exception as e:
            elapsed = (datetime.now() - start).total_seconds()
            logger.error(
                f"{func.__name__} failed",
                exc_info=True,
                function=func.__name__,
                duration_seconds=elapsed,
                status="error",
                error=str(e)
            )
            raise
    
    @wraps(func)
    def sync_wrapper(*args, **kwargs):
        start = datetime.now()
        try:
            result = func(*args, **kwargs)
            elapsed = (datetime.now() - start).total_seconds()
            logger.info(
                f"{func.__name__} completed",
                function=func.__name__,
                duration_seconds=elapsed,
                status="success"
            )
            return result
        except Exception as e:
            elapsed = (datetime.now() - start).total_seconds()
            logger.error(
                f"{func.__name__} failed",
                exc_info=True,
                function=func.__name__,
                duration_seconds=elapsed,
                status="error",
                error=str(e)
            )
            raise
    
    import asyncio
    if asyncio.iscoroutinefunction(func):
        return async_wrapper
    return sync_wrapper


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 LOGGERS SPÉCIALISÉS
# ═══════════════════════════════════════════════════════════════════════════════

# Logger pour les analyses vidéo
video_logger = DeepSightLogger("deepsight.video")

# Logger pour l'authentification
auth_logger = DeepSightLogger("deepsight.auth")

# Logger pour les paiements
billing_logger = DeepSightLogger("deepsight.billing")

# Logger pour la base de données
db_logger = DeepSightLogger("deepsight.db")

# Logger pour les APIs externes (Mistral, Perplexity)
api_logger = DeepSightLogger("deepsight.api")


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 EXEMPLE D'UTILISATION
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    # Test des différents niveaux
    set_request_context(request_id="test-123", user_id=42, user_email="test@example.com")
    
    logger.debug("Debug message", key="value")
    logger.info("Info message", video_id="xyz", duration=120)
    logger.warning("Warning message", retry_count=3)
    logger.error("Error message", error_code="E001")
    
    try:
        raise ValueError("Test exception")
    except:
        logger.exception("Exception caught", context="test")
    
    clear_request_context()
