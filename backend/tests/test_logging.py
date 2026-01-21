"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS: Module de Logging — Tests Fonctionnels Réels                           ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Tests pour le système de logging structuré:                                       ║
║  • Logger principal et niveaux de log                                             ║
║  • Formatter JSON pour parsing                                                     ║
║  • Contexte de requête (request_id, user_id)                                      ║
║  • Décorateur log_execution_time                                                   ║
║  • Loggers spécialisés                                                            ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import pytest
import json
import sys
import os
import logging
import asyncio
from io import StringIO
from unittest.mock import patch, MagicMock
from datetime import datetime

# Ajouter le src au path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS LOGGER PRINCIPAL
# ═══════════════════════════════════════════════════════════════════════════════

class TestLogger:
    """Tests pour le logger principal."""
    
    @pytest.mark.unit
    def test_logger_creates_instance(self):
        """Le logger doit être créé correctement."""
        from core.logging import DeepSightLogger
        
        logger = DeepSightLogger("test_instance")
        assert logger is not None
        assert hasattr(logger, '_logger')
    
    @pytest.mark.unit
    def test_logger_has_all_methods(self):
        """Le logger doit avoir toutes les méthodes de logging."""
        from core.logging import DeepSightLogger
        
        logger = DeepSightLogger("test_methods")
        
        # Vérifier que toutes les méthodes existent
        assert hasattr(logger, 'debug')
        assert hasattr(logger, 'info')
        assert hasattr(logger, 'warning')
        assert hasattr(logger, 'error')
        assert hasattr(logger, 'critical')
        assert hasattr(logger, 'exception')
        
        # Vérifier qu'elles sont appelables
        assert callable(logger.debug)
        assert callable(logger.info)
        assert callable(logger.warning)
        assert callable(logger.error)
        assert callable(logger.critical)
        assert callable(logger.exception)
    
    @pytest.mark.unit
    def test_logger_levels_dont_raise(self):
        """Tous les niveaux de log doivent fonctionner sans erreur."""
        from core.logging import DeepSightLogger
        
        logger = DeepSightLogger("test_levels")
        
        # Ces appels ne doivent pas lever d'exception
        try:
            logger.debug("Debug message")
            logger.info("Info message")
            logger.warning("Warning message")
            logger.error("Error message")
            logger.critical("Critical message")
            success = True
        except Exception as e:
            success = False
        
        assert success, "Les méthodes de logging ne doivent pas lever d'exception"
    
    @pytest.mark.unit
    def test_logger_accepts_extra_kwargs(self):
        """Le logger doit accepter des kwargs supplémentaires."""
        from core.logging import DeepSightLogger
        
        logger = DeepSightLogger("test_kwargs")
        
        # Ces appels ne doivent pas lever d'exception
        try:
            logger.info("Message avec extras", video_id="xyz", user_id=42, duration=120)
            logger.error("Erreur avec context", error_code="E001", retry_count=3)
            success = True
        except Exception as e:
            success = False
        
        assert success, "Le logger doit accepter des kwargs arbitraires"
    
    @pytest.mark.unit
    def test_logger_exception_handles_exc_info(self):
        """exception() doit gérer les exceptions correctement."""
        from core.logging import DeepSightLogger
        
        logger = DeepSightLogger("test_exception")
        
        try:
            raise ValueError("Test error for logging")
        except ValueError:
            # Ne doit pas lever d'exception
            try:
                logger.exception("Exception caught during test")
                success = True
            except Exception:
                success = False
        
        assert success, "logger.exception() doit fonctionner dans un bloc except"
    
    @pytest.mark.unit
    def test_logger_name_is_set(self):
        """Le nom du logger doit être correctement défini."""
        from core.logging import DeepSightLogger
        
        logger = DeepSightLogger("custom_name")
        assert logger._logger.name == "custom_name"


# ═══════════════════════════════════════════════════════════════════════════════
# 🎨 TESTS JSON FORMATTER
# ═══════════════════════════════════════════════════════════════════════════════

class TestJSONFormatter:
    """Tests pour le formatter JSON."""
    
    @pytest.mark.unit
    def test_json_formatter_produces_valid_json(self):
        """Le formatter doit produire du JSON valide."""
        from core.logging import JSONFormatter
        
        formatter = JSONFormatter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="Test message",
            args=(),
            exc_info=None
        )
        
        output = formatter.format(record)
        
        # Doit être parseable en JSON
        try:
            parsed = json.loads(output)
            is_valid_json = True
        except json.JSONDecodeError:
            is_valid_json = False
        
        assert is_valid_json, f"Output n'est pas du JSON valide: {output}"
    
    @pytest.mark.unit
    def test_json_formatter_includes_timestamp(self):
        """Le formatter doit inclure un timestamp ISO."""
        from core.logging import JSONFormatter
        
        formatter = JSONFormatter()
        record = logging.LogRecord(
            name="test", level=logging.INFO, pathname="test.py",
            lineno=10, msg="Test", args=(), exc_info=None
        )
        
        output = formatter.format(record)
        parsed = json.loads(output)
        
        assert "timestamp" in parsed, "timestamp manquant"
        # Vérifier le format ISO
        assert "T" in parsed["timestamp"], "timestamp doit être au format ISO"
        assert parsed["timestamp"].endswith("Z"), "timestamp doit finir par Z (UTC)"
    
    @pytest.mark.unit
    def test_json_formatter_includes_level(self):
        """Le formatter doit inclure le niveau de log."""
        from core.logging import JSONFormatter
        
        formatter = JSONFormatter()
        
        for level, level_name in [(logging.DEBUG, "DEBUG"), (logging.INFO, "INFO"), 
                                   (logging.WARNING, "WARNING"), (logging.ERROR, "ERROR")]:
            record = logging.LogRecord(
                name="test", level=level, pathname="test.py",
                lineno=10, msg="Test", args=(), exc_info=None
            )
            
            output = formatter.format(record)
            parsed = json.loads(output)
            
            assert "level" in parsed, "level manquant"
            assert parsed["level"] == level_name, f"Attendu {level_name}, obtenu {parsed['level']}"
    
    @pytest.mark.unit
    def test_json_formatter_includes_message(self):
        """Le formatter doit inclure le message."""
        from core.logging import JSONFormatter
        
        formatter = JSONFormatter()
        test_message = "This is a test message with special chars: éàü"
        
        record = logging.LogRecord(
            name="test", level=logging.INFO, pathname="test.py",
            lineno=10, msg=test_message, args=(), exc_info=None
        )
        
        output = formatter.format(record)
        parsed = json.loads(output)
        
        assert "message" in parsed, "message manquant"
        assert parsed["message"] == test_message, "message incorrect"
    
    @pytest.mark.unit
    def test_json_formatter_includes_service_info(self):
        """Le formatter doit inclure les infos du service."""
        from core.logging import JSONFormatter
        
        formatter = JSONFormatter()
        record = logging.LogRecord(
            name="test", level=logging.INFO, pathname="test.py",
            lineno=10, msg="Test", args=(), exc_info=None
        )
        
        output = formatter.format(record)
        parsed = json.loads(output)
        
        assert "service" in parsed, "service manquant"
        assert "environment" in parsed, "environment manquant"
    
    @pytest.mark.unit
    def test_json_formatter_includes_location(self):
        """Le formatter doit inclure la localisation du code."""
        from core.logging import JSONFormatter
        
        formatter = JSONFormatter()
        record = logging.LogRecord(
            name="test", level=logging.INFO, pathname="/path/to/test.py",
            lineno=42, msg="Test", args=(), exc_info=None
        )
        record.funcName = "test_function"
        
        output = formatter.format(record)
        parsed = json.loads(output)
        
        assert "location" in parsed, "location manquant"
        assert "file" in parsed["location"], "file manquant dans location"
        assert "line" in parsed["location"], "line manquant dans location"
        assert parsed["location"]["line"] == 42
    
    @pytest.mark.unit
    def test_json_formatter_includes_extras(self):
        """Le formatter doit inclure les données extra."""
        from core.logging import JSONFormatter
        
        formatter = JSONFormatter()
        record = logging.LogRecord(
            name="test", level=logging.INFO, pathname="test.py",
            lineno=10, msg="Test", args=(), exc_info=None
        )
        record.extra_data = {"video_id": "xyz123", "user_id": 42, "duration": 3600}
        
        output = formatter.format(record)
        parsed = json.loads(output)
        
        assert "extra" in parsed, "extra manquant"
        assert parsed["extra"]["video_id"] == "xyz123"
        assert parsed["extra"]["user_id"] == 42
        assert parsed["extra"]["duration"] == 3600
    
    @pytest.mark.unit
    def test_json_formatter_handles_exception(self):
        """Le formatter doit inclure les infos d'exception."""
        from core.logging import JSONFormatter
        
        formatter = JSONFormatter()
        
        try:
            raise ValueError("Test exception")
        except ValueError:
            exc_info = sys.exc_info()
        
        record = logging.LogRecord(
            name="test", level=logging.ERROR, pathname="test.py",
            lineno=10, msg="Error occurred", args=(), exc_info=exc_info
        )
        
        output = formatter.format(record)
        parsed = json.loads(output)
        
        assert "exception" in parsed, "exception manquant"
        assert parsed["exception"]["type"] == "ValueError"
        assert "Test exception" in parsed["exception"]["message"]


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 TESTS CONTEXTE DE REQUÊTE
# ═══════════════════════════════════════════════════════════════════════════════

class TestRequestContext:
    """Tests pour le contexte de requête."""
    
    @pytest.mark.unit
    def test_set_request_context_sets_values(self):
        """set_request_context doit définir les variables."""
        from core.logging import (
            set_request_context, request_id_var, user_id_var, user_email_var,
            clear_request_context
        )
        
        # Nettoyer d'abord
        clear_request_context()
        
        set_request_context(
            request_id="test-request-123",
            user_id=42,
            user_email="test@example.com"
        )
        
        assert request_id_var.get() == "test-request-123"
        assert user_id_var.get() == 42
        assert user_email_var.get() == "test@example.com"
        
        # Nettoyer après
        clear_request_context()
    
    @pytest.mark.unit
    def test_clear_request_context_clears_values(self):
        """clear_request_context doit effacer les variables."""
        from core.logging import (
            set_request_context, clear_request_context,
            request_id_var, user_id_var, user_email_var
        )
        
        # Définir des valeurs
        set_request_context(request_id="to-clear", user_id=99, user_email="clear@test.com")
        
        # Effacer
        clear_request_context()
        
        assert request_id_var.get() == ""
        assert user_id_var.get() is None
        assert user_email_var.get() is None
    
    @pytest.mark.unit
    def test_generate_request_id_unique(self):
        """generate_request_id doit créer des IDs uniques."""
        from core.logging import generate_request_id
        
        ids = set()
        for _ in range(100):
            new_id = generate_request_id()
            ids.add(new_id)
        
        # Tous les IDs doivent être uniques
        assert len(ids) == 100, "Tous les IDs générés doivent être uniques"
    
    @pytest.mark.unit
    def test_generate_request_id_format(self):
        """generate_request_id doit créer des UUIDs valides."""
        from core.logging import generate_request_id
        import uuid
        
        request_id = generate_request_id()
        
        # Doit être un UUID valide
        try:
            uuid.UUID(request_id)
            is_valid_uuid = True
        except ValueError:
            is_valid_uuid = False
        
        assert is_valid_uuid, f"{request_id} n'est pas un UUID valide"
    
    @pytest.mark.unit
    def test_partial_context_setting(self):
        """On doit pouvoir définir le contexte partiellement."""
        from core.logging import (
            set_request_context, clear_request_context,
            request_id_var, user_id_var
        )
        
        clear_request_context()
        
        # Définir seulement request_id
        set_request_context(request_id="partial-test")
        
        assert request_id_var.get() == "partial-test"
        assert user_id_var.get() is None  # Non défini
        
        clear_request_context()


# ═══════════════════════════════════════════════════════════════════════════════
# ⏱️ TESTS DÉCORATEUR LOG_EXECUTION_TIME
# ═══════════════════════════════════════════════════════════════════════════════

class TestLogExecutionTime:
    """Tests pour le décorateur log_execution_time."""
    
    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_log_execution_time_async_returns_result(self):
        """Le décorateur doit retourner le résultat de la fonction async."""
        from core.logging import log_execution_time
        
        @log_execution_time
        async def async_function():
            await asyncio.sleep(0.01)
            return "async_result"
        
        result = await async_function()
        assert result == "async_result"
    
    @pytest.mark.unit
    def test_log_execution_time_sync_returns_result(self):
        """Le décorateur doit retourner le résultat de la fonction sync."""
        from core.logging import log_execution_time
        import time
        
        @log_execution_time
        def sync_function():
            time.sleep(0.01)
            return "sync_result"
        
        result = sync_function()
        assert result == "sync_result"
    
    @pytest.mark.unit
    def test_log_execution_time_preserves_function_name(self):
        """Le décorateur doit préserver le nom de la fonction."""
        from core.logging import log_execution_time
        
        @log_execution_time
        def named_function():
            return True
        
        assert named_function.__name__ == "named_function"
    
    @pytest.mark.unit
    def test_log_execution_time_propagates_exception(self):
        """Le décorateur doit propager les exceptions."""
        from core.logging import log_execution_time
        
        @log_execution_time
        def failing_function():
            raise ValueError("Intentional test error")
        
        with pytest.raises(ValueError, match="Intentional test error"):
            failing_function()
    
    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_log_execution_time_async_propagates_exception(self):
        """Le décorateur async doit propager les exceptions."""
        from core.logging import log_execution_time
        
        @log_execution_time
        async def async_failing():
            await asyncio.sleep(0.01)
            raise RuntimeError("Async test error")
        
        with pytest.raises(RuntimeError, match="Async test error"):
            await async_failing()
    
    @pytest.mark.unit
    def test_log_execution_time_with_args(self):
        """Le décorateur doit fonctionner avec des arguments."""
        from core.logging import log_execution_time
        
        @log_execution_time
        def function_with_args(a, b, c=None):
            return a + b + (c or 0)
        
        result = function_with_args(1, 2, c=3)
        assert result == 6


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 TESTS LOGGERS SPÉCIALISÉS
# ═══════════════════════════════════════════════════════════════════════════════

class TestSpecializedLoggers:
    """Tests pour les loggers spécialisés."""
    
    @pytest.mark.unit
    def test_video_logger_exists_and_works(self):
        """video_logger doit exister et fonctionner."""
        from core.logging import video_logger
        
        assert video_logger is not None
        
        # Doit pouvoir logger sans erreur
        try:
            video_logger.info("Test video log", video_id="test123")
            success = True
        except Exception:
            success = False
        
        assert success
    
    @pytest.mark.unit
    def test_auth_logger_exists_and_works(self):
        """auth_logger doit exister et fonctionner."""
        from core.logging import auth_logger
        
        assert auth_logger is not None
        
        try:
            auth_logger.info("Test auth log", user_email="test@test.com")
            success = True
        except Exception:
            success = False
        
        assert success
    
    @pytest.mark.unit
    def test_billing_logger_exists_and_works(self):
        """billing_logger doit exister et fonctionner."""
        from core.logging import billing_logger
        
        assert billing_logger is not None
        
        try:
            billing_logger.info("Test billing log", amount=9.99, currency="EUR")
            success = True
        except Exception:
            success = False
        
        assert success
    
    @pytest.mark.unit
    def test_api_logger_exists_and_works(self):
        """api_logger doit exister et fonctionner."""
        from core.logging import api_logger
        
        assert api_logger is not None
        
        try:
            api_logger.info("Test API log", endpoint="/v1/analyze", method="POST")
            success = True
        except Exception:
            success = False
        
        assert success
    
    @pytest.mark.unit
    def test_specialized_loggers_have_different_names(self):
        """Les loggers spécialisés doivent avoir des noms différents."""
        from core.logging import video_logger, auth_logger, billing_logger, api_logger
        
        names = {
            video_logger._logger.name,
            auth_logger._logger.name,
            billing_logger._logger.name,
            api_logger._logger.name,
        }
        
        # Tous les noms doivent être uniques
        assert len(names) == 4, "Les loggers spécialisés doivent avoir des noms uniques"


# ═══════════════════════════════════════════════════════════════════════════════
# 🎨 TESTS COLORED FORMATTER (Dev Mode)
# ═══════════════════════════════════════════════════════════════════════════════

class TestColoredFormatter:
    """Tests pour le formatter coloré (développement)."""
    
    @pytest.mark.unit
    def test_colored_formatter_has_colors(self):
        """Le formatter coloré doit avoir des couleurs définies."""
        from core.logging import ColoredFormatter
        
        formatter = ColoredFormatter()
        
        assert hasattr(formatter, 'COLORS')
        assert 'DEBUG' in formatter.COLORS
        assert 'INFO' in formatter.COLORS
        assert 'WARNING' in formatter.COLORS
        assert 'ERROR' in formatter.COLORS
        assert 'CRITICAL' in formatter.COLORS
    
    @pytest.mark.unit
    def test_colored_formatter_produces_string(self):
        """Le formatter coloré doit produire une chaîne."""
        from core.logging import ColoredFormatter
        
        formatter = ColoredFormatter()
        record = logging.LogRecord(
            name="test", level=logging.INFO, pathname="test.py",
            lineno=10, msg="Test message", args=(), exc_info=None
        )
        
        output = formatter.format(record)
        
        assert isinstance(output, str)
        assert len(output) > 0
        assert "Test message" in output
    
    @pytest.mark.unit
    def test_colored_formatter_includes_level(self):
        """Le formatter coloré doit inclure le niveau."""
        from core.logging import ColoredFormatter
        
        formatter = ColoredFormatter()
        record = logging.LogRecord(
            name="test", level=logging.WARNING, pathname="test.py",
            lineno=10, msg="Warning test", args=(), exc_info=None
        )
        
        output = formatter.format(record)
        
        assert "WARNING" in output


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 TESTS CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

class TestLoggingConfiguration:
    """Tests pour la configuration du logging."""
    
    @pytest.mark.unit
    def test_log_level_constant_exists(self):
        """LOG_LEVEL doit être défini."""
        from core.logging import LOG_LEVEL
        
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        assert LOG_LEVEL in valid_levels
    
    @pytest.mark.unit
    def test_service_name_constant_exists(self):
        """SERVICE_NAME doit être défini."""
        from core.logging import SERVICE_NAME
        
        assert SERVICE_NAME is not None
        assert len(SERVICE_NAME) > 0
        assert isinstance(SERVICE_NAME, str)
    
    @pytest.mark.unit
    def test_environment_constant_exists(self):
        """ENVIRONMENT doit être défini."""
        from core.logging import ENVIRONMENT
        
        valid_envs = ["development", "staging", "production", "test"]
        assert ENVIRONMENT in valid_envs or ENVIRONMENT is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
