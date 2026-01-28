"""
Monitoring et auto-healing pour le systeme de transcripts
v7.0 - Health tracking, alerting, and auto-optimization
"""

from datetime import datetime, timedelta
from collections import defaultdict
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
import json

from core.logging import logger


@dataclass
class MethodStats:
    """Statistics for a single extraction method"""
    success: int = 0
    failure: int = 0
    total_time_ms: int = 0
    last_success: Optional[datetime] = None
    last_failure: Optional[datetime] = None
    error_types: Dict[str, int] = field(default_factory=dict)

    @property
    def total_attempts(self) -> int:
        return self.success + self.failure

    @property
    def success_rate(self) -> float:
        if self.total_attempts == 0:
            return 0.0
        return self.success / self.total_attempts

    @property
    def avg_time_ms(self) -> float:
        if self.total_attempts == 0:
            return 0.0
        return self.total_time_ms / self.total_attempts


class TranscriptHealthMonitor:
    """
    Surveille la sante du systeme d'extraction et ajuste automatiquement
    """

    def __init__(self):
        self.method_stats: Dict[str, MethodStats] = defaultdict(MethodStats)
        self.alerts_sent: Dict[str, datetime] = {}
        self.global_stats = {
            "total_extractions": 0,
            "total_success": 0,
            "total_failure": 0,
            "start_time": datetime.now(),
        }
        self._priority_cache: Optional[List[str]] = None
        self._priority_cache_time: Optional[datetime] = None

    def record_attempt(
        self,
        method: str,
        success: bool,
        duration_ms: int,
        error: Optional[str] = None
    ):
        """Enregistre une tentative d'extraction"""
        stats = self.method_stats[method]
        stats.total_time_ms += duration_ms

        if success:
            stats.success += 1
            stats.last_success = datetime.now()
            self.global_stats["total_success"] += 1
        else:
            stats.failure += 1
            stats.last_failure = datetime.now()
            self.global_stats["total_failure"] += 1

            # Track error types
            if error:
                error_type = self._categorize_error(error)
                stats.error_types[error_type] = stats.error_types.get(error_type, 0) + 1

        self.global_stats["total_extractions"] += 1

        # Invalidate priority cache
        self._priority_cache = None

        # Check health alerts
        self._check_health_alerts(method)

    def _categorize_error(self, error: str) -> str:
        """Categorize error message into types"""
        error_lower = error.lower()

        if "timeout" in error_lower:
            return "timeout"
        elif "rate" in error_lower or "429" in error:
            return "rate_limit"
        elif "blocked" in error_lower or "403" in error:
            return "blocked"
        elif "not found" in error_lower or "404" in error:
            return "not_found"
        elif "no transcript" in error_lower or "disabled" in error_lower:
            return "no_transcript"
        elif "network" in error_lower or "connection" in error_lower:
            return "network"
        else:
            return "other"

    def get_method_priority(self) -> List[str]:
        """
        Retourne les methodes triees par taux de succes
        Pour l'auto-optimisation de l'ordre des fallbacks
        """
        # Use cache if recent
        if (
            self._priority_cache is not None
            and self._priority_cache_time is not None
            and datetime.now() - self._priority_cache_time < timedelta(minutes=5)
        ):
            return self._priority_cache

        methods_with_score = []

        for method, stats in self.method_stats.items():
            if stats.total_attempts < 3:
                # Not enough data, assign neutral score
                methods_with_score.append((method, 0.5))
                continue

            success_rate = stats.success_rate
            avg_time = stats.avg_time_ms

            # Score = success_rate * 0.7 + (1 - normalized_time) * 0.3
            # Normalize time: 0ms = 1.0, 10000ms+ = 0.0
            time_score = max(0, 1 - (avg_time / 10000))
            score = success_rate * 0.7 + time_score * 0.3

            # Penalty for recent failures
            if stats.last_failure:
                minutes_since_failure = (datetime.now() - stats.last_failure).total_seconds() / 60
                if minutes_since_failure < 5:
                    score *= 0.8  # 20% penalty for recent failure

            methods_with_score.append((method, score))

        # Sort by score descending
        methods_with_score.sort(key=lambda x: x[1], reverse=True)

        self._priority_cache = [m[0] for m in methods_with_score]
        self._priority_cache_time = datetime.now()

        return self._priority_cache

    def _check_health_alerts(self, method: str):
        """Verifie si des alertes doivent etre envoyees"""
        stats = self.method_stats[method]

        if stats.total_attempts < 10:
            return  # Not enough data

        success_rate = stats.success_rate

        # Alert if rate < 50%
        if success_rate < 0.5:
            last_alert = self.alerts_sent.get(method)
            if not last_alert or datetime.now() - last_alert > timedelta(hours=1):
                logger.warning(
                    f"ALERT: {method} success rate dropped to {success_rate:.1%}",
                    method=method,
                    success_rate=success_rate,
                    total_attempts=stats.total_attempts,
                )
                self.alerts_sent[method] = datetime.now()

        # Alert for specific error patterns
        for error_type, count in stats.error_types.items():
            error_rate = count / stats.total_attempts
            if error_rate > 0.3 and error_type in ["blocked", "rate_limit"]:
                alert_key = f"{method}_{error_type}"
                last_alert = self.alerts_sent.get(alert_key)
                if not last_alert or datetime.now() - last_alert > timedelta(hours=2):
                    logger.warning(
                        f"ALERT: {method} showing high {error_type} errors ({error_rate:.1%})",
                        method=method,
                        error_type=error_type,
                        error_rate=error_rate,
                    )
                    self.alerts_sent[alert_key] = datetime.now()

    def get_health_report(self) -> Dict[str, Any]:
        """Genere un rapport de sante complet"""
        uptime = datetime.now() - self.global_stats["start_time"]

        report = {
            "timestamp": datetime.now().isoformat(),
            "uptime_hours": uptime.total_seconds() / 3600,
            "methods": {},
            "overall_success_rate": 0,
            "total_extractions": self.global_stats["total_extractions"],
            "recommendations": [],
        }

        total_success = 0
        total_attempts = 0

        for method, stats in self.method_stats.items():
            if stats.total_attempts > 0:
                report["methods"][method] = {
                    "success_rate": f"{stats.success_rate:.1%}",
                    "total_attempts": stats.total_attempts,
                    "success_count": stats.success,
                    "failure_count": stats.failure,
                    "avg_time_ms": round(stats.avg_time_ms),
                    "last_success": stats.last_success.isoformat() if stats.last_success else None,
                    "last_failure": stats.last_failure.isoformat() if stats.last_failure else None,
                    "error_breakdown": dict(stats.error_types),
                }

                total_success += stats.success
                total_attempts += stats.total_attempts

        if total_attempts > 0:
            report["overall_success_rate"] = f"{total_success / total_attempts:.1%}"

        # Generate recommendations
        report["recommendations"] = self._generate_recommendations()

        return report

    def _generate_recommendations(self) -> List[str]:
        """Generate actionable recommendations based on stats"""
        recommendations = []

        for method, stats in self.method_stats.items():
            if stats.total_attempts < 10:
                continue

            # Check for persistent failures
            if stats.success_rate < 0.3:
                recommendations.append(
                    f"Consider disabling {method} - success rate only {stats.success_rate:.1%}"
                )

            # Check for slow methods
            if stats.avg_time_ms > 15000 and stats.success_rate < 0.7:
                recommendations.append(
                    f"Review {method} - slow ({stats.avg_time_ms:.0f}ms avg) with low success"
                )

            # Check error patterns
            for error_type, count in stats.error_types.items():
                error_rate = count / stats.total_attempts
                if error_rate > 0.4:
                    if error_type == "rate_limit":
                        recommendations.append(
                            f"{method}: Consider adding proxy rotation - {error_rate:.0%} rate limited"
                        )
                    elif error_type == "blocked":
                        recommendations.append(
                            f"{method}: Consider using residential proxies - {error_rate:.0%} blocked"
                        )

        # Global recommendations
        overall_success = (
            self.global_stats["total_success"] / self.global_stats["total_extractions"]
            if self.global_stats["total_extractions"] > 0
            else 0
        )

        if overall_success < 0.9:
            recommendations.append(
                f"Overall success rate is {overall_success:.1%} - below 99.5% target"
            )

        if overall_success < 0.8:
            recommendations.append(
                "Consider adding additional fallback methods or paid services"
            )

        return recommendations

    def get_method_stats(self, method: str) -> Optional[Dict[str, Any]]:
        """Get detailed stats for a specific method"""
        if method not in self.method_stats:
            return None

        stats = self.method_stats[method]

        return {
            "method": method,
            "success_rate": stats.success_rate,
            "total_attempts": stats.total_attempts,
            "avg_time_ms": stats.avg_time_ms,
            "last_success": stats.last_success,
            "last_failure": stats.last_failure,
            "error_types": dict(stats.error_types),
        }

    def reset_stats(self):
        """Reset all statistics"""
        self.method_stats.clear()
        self.alerts_sent.clear()
        self.global_stats = {
            "total_extractions": 0,
            "total_success": 0,
            "total_failure": 0,
            "start_time": datetime.now(),
        }
        self._priority_cache = None
        self._priority_cache_time = None
        logger.info("Transcript health monitor stats reset")

    def export_stats(self) -> str:
        """Export stats as JSON for persistence"""
        export_data = {
            "timestamp": datetime.now().isoformat(),
            "global_stats": {
                **self.global_stats,
                "start_time": self.global_stats["start_time"].isoformat(),
            },
            "method_stats": {},
        }

        for method, stats in self.method_stats.items():
            export_data["method_stats"][method] = {
                "success": stats.success,
                "failure": stats.failure,
                "total_time_ms": stats.total_time_ms,
                "last_success": stats.last_success.isoformat() if stats.last_success else None,
                "last_failure": stats.last_failure.isoformat() if stats.last_failure else None,
                "error_types": dict(stats.error_types),
            }

        return json.dumps(export_data, indent=2)

    def import_stats(self, json_data: str):
        """Import stats from JSON for persistence"""
        try:
            data = json.loads(json_data)

            self.global_stats = data.get("global_stats", {})
            if "start_time" in self.global_stats:
                self.global_stats["start_time"] = datetime.fromisoformat(
                    self.global_stats["start_time"]
                )

            for method, stats_data in data.get("method_stats", {}).items():
                stats = MethodStats(
                    success=stats_data.get("success", 0),
                    failure=stats_data.get("failure", 0),
                    total_time_ms=stats_data.get("total_time_ms", 0),
                    error_types=stats_data.get("error_types", {}),
                )

                if stats_data.get("last_success"):
                    stats.last_success = datetime.fromisoformat(stats_data["last_success"])
                if stats_data.get("last_failure"):
                    stats.last_failure = datetime.fromisoformat(stats_data["last_failure"])

                self.method_stats[method] = stats

            logger.info("Transcript health monitor stats imported successfully")

        except Exception as e:
            logger.error(f"Failed to import health monitor stats: {e}")


# Global instance
health_monitor = TranscriptHealthMonitor()


# ===================================================================
# CONVENIENCE FUNCTIONS
# ===================================================================

def record_extraction_attempt(
    method: str,
    success: bool,
    duration_ms: int,
    error: Optional[str] = None
):
    """Record an extraction attempt in the global monitor"""
    health_monitor.record_attempt(method, success, duration_ms, error)


def get_optimized_method_order() -> List[str]:
    """Get methods sorted by success rate for optimal fallback order"""
    return health_monitor.get_method_priority()


def get_transcript_health_report() -> Dict[str, Any]:
    """Get the current health report"""
    return health_monitor.get_health_report()
