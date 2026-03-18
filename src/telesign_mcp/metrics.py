"""In-memory metrics for observability and monitoring.

Tracks tool invocations, latency percentiles, error rates,
and circuit breaker state. All metrics are thread-safe and
designed for export via the health_check tool.
"""

from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass, field
from threading import Lock
from typing import Any


@dataclass
class _LatencyTracker:
    """Tracks latency samples for percentile computation."""

    _samples: list[float] = field(default_factory=list)
    _lock: Lock = field(default_factory=Lock)
    _max_samples: int = 10_000

    def record(self, ms: float) -> None:
        with self._lock:
            self._samples.append(ms)
            if len(self._samples) > self._max_samples:
                self._samples = self._samples[-self._max_samples :]

    def percentiles(self) -> dict[str, float | None]:
        with self._lock:
            if not self._samples:
                return {"p50": None, "p95": None, "p99": None, "count": 0}
            s = sorted(self._samples)
            n = len(s)
            return {
                "p50": round(s[int(n * 0.5)], 2),
                "p95": round(s[int(min(n * 0.95, n - 1))], 2),
                "p99": round(s[int(min(n * 0.99, n - 1))], 2),
                "count": n,
            }


class ServerMetrics:
    """Centralized metrics collector for the MCP server.

    Thread-safe, in-memory metrics suitable for inclusion in
    health check responses. No external dependencies required.

    Usage:
        metrics = ServerMetrics()
        metrics.record_tool_call("intelligence_score", 150.5, success=True)
        snapshot = metrics.snapshot()
    """

    def __init__(self) -> None:
        self._lock = Lock()
        self._start_time = time.monotonic()

        # Per-tool counters
        self._tool_calls: dict[str, int] = defaultdict(int)
        self._tool_errors: dict[str, int] = defaultdict(int)
        self._tool_latency: dict[str, _LatencyTracker] = defaultdict(_LatencyTracker)

        # Per-error-type counters
        self._error_types: dict[str, int] = defaultdict(int)

        # Global counters
        self._total_requests: int = 0
        self._total_errors: int = 0

        # Rate limiter rejections
        self._rate_limit_rejections: int = 0

    def record_tool_call(
        self,
        tool_name: str,
        latency_ms: float,
        success: bool = True,
    ) -> None:
        """Record a tool invocation.

        Args:
            tool_name: Name of the MCP tool.
            latency_ms: Execution time in milliseconds.
            success: Whether the call succeeded.
        """
        with self._lock:
            self._total_requests += 1
            self._tool_calls[tool_name] += 1
            self._tool_latency[tool_name].record(latency_ms)

            if not success:
                self._total_errors += 1
                self._tool_errors[tool_name] += 1

    def record_error(self, error_type: str) -> None:
        """Record an error by exception type name.

        Args:
            error_type: Exception class name (e.g., "TelesignAuthError").
        """
        with self._lock:
            self._error_types[error_type] += 1

    def record_rate_limit_rejection(self) -> None:
        """Record a rate limiter rejection."""
        with self._lock:
            self._rate_limit_rejections += 1

    @property
    def uptime_seconds(self) -> float:
        return round(time.monotonic() - self._start_time, 1)

    def snapshot(self) -> dict[str, Any]:
        """Return a point-in-time metrics snapshot.

        Returns:
            Dict suitable for JSON serialization in health check.
        """
        with self._lock:
            tool_stats: dict[str, Any] = {}
            for name in sorted(set(self._tool_calls) | set(self._tool_errors)):
                calls = self._tool_calls.get(name, 0)
                errors = self._tool_errors.get(name, 0)
                latency = self._tool_latency[name].percentiles()
                tool_stats[name] = {
                    "calls": calls,
                    "errors": errors,
                    "error_rate": round(errors / calls, 4) if calls > 0 else 0.0,
                    "latency": latency,
                }

            return {
                "uptime_seconds": self.uptime_seconds,
                "total_requests": self._total_requests,
                "total_errors": self._total_errors,
                "error_rate": (
                    round(self._total_errors / self._total_requests, 4)
                    if self._total_requests > 0
                    else 0.0
                ),
                "rate_limit_rejections": self._rate_limit_rejections,
                "error_types": dict(self._error_types),
                "tools": tool_stats,
            }
