"""Sliding-window rate limiter for MCP tool invocations.

Enforces the configured requests-per-minute limit to prevent
abuse and protect Telesign API quotas. Uses a lock-free
monotonic clock approach for accuracy.
"""

from __future__ import annotations

import time
from collections import deque
from threading import Lock

from telesign_mcp.logging import get_logger

logger = get_logger(__name__)


class RateLimitExceeded(Exception):
    """Raised when the tool invocation rate limit is exceeded.

    Attributes:
        retry_after_seconds: Suggested wait time before retrying.
    """

    def __init__(self, retry_after_seconds: float) -> None:
        self.retry_after_seconds = retry_after_seconds
        super().__init__(f"Rate limit exceeded. Retry after {retry_after_seconds:.1f} seconds.")


class SlidingWindowRateLimiter:
    """Sliding-window rate limiter.

    Tracks timestamps of recent requests and rejects new ones
    when the window is full.

    Args:
        max_requests: Maximum allowed requests in the window.
        window_seconds: Window duration in seconds (default: 60).
    """

    def __init__(self, max_requests: int, window_seconds: float = 60.0) -> None:
        self._max_requests = max_requests
        self._window_seconds = window_seconds
        self._timestamps: deque[float] = deque()
        self._lock = Lock()

    def acquire(self) -> bool:
        """Attempt to acquire a rate limit token.

        Returns:
            True if the request is allowed.

        Raises:
            RateLimitExceeded: If the rate limit is exceeded.
        """
        now = time.monotonic()

        with self._lock:
            # Evict expired timestamps
            cutoff = now - self._window_seconds
            while self._timestamps and self._timestamps[0] < cutoff:
                self._timestamps.popleft()

            if len(self._timestamps) >= self._max_requests:
                # Calculate wait time until the oldest entry expires
                oldest = self._timestamps[0]
                retry_after = (oldest + self._window_seconds) - now
                raise RateLimitExceeded(retry_after_seconds=max(retry_after, 0.1))

            self._timestamps.append(now)
            return True

    @property
    def current_usage(self) -> int:
        """Current number of requests in the window."""
        now = time.monotonic()
        with self._lock:
            cutoff = now - self._window_seconds
            while self._timestamps and self._timestamps[0] < cutoff:
                self._timestamps.popleft()
            return len(self._timestamps)

    @property
    def remaining(self) -> int:
        """Number of remaining allowed requests in the window."""
        return max(0, self._max_requests - self.current_usage)

    def status(self) -> dict[str, int | float]:
        """Return rate limiter status."""
        return {
            "limit": self._max_requests,
            "window_seconds": self._window_seconds,
            "current_usage": self.current_usage,
            "remaining": self.remaining,
        }
