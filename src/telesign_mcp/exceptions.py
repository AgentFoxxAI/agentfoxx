"""Telesign API error taxonomy.

Provides structured exception hierarchy for all Telesign API failure
modes with context preservation for debugging and MCP error propagation.
"""

from __future__ import annotations

from typing import Any


class TelesignError(Exception):
    """Base exception for all Telesign API errors."""

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        response_body: dict[str, Any] | None = None,
    ) -> None:
        self.status_code = status_code
        self.response_body = response_body or {}
        super().__init__(message)


class TelesignAuthError(TelesignError):
    """Authentication or authorization failure (401/403).

    Indicates invalid credentials, expired keys, or insufficient
    permissions for the requested endpoint.
    """

    pass


class TelesignRateLimitError(TelesignError):
    """Rate limit exceeded (429).

    Contains retry_after_seconds parsed from the Retry-After header
    when available, enabling callers to implement precise backoff.
    """

    def __init__(
        self,
        message: str,
        retry_after_seconds: float | None = None,
        **kwargs: Any,
    ) -> None:
        self.retry_after_seconds = retry_after_seconds
        super().__init__(message, **kwargs)


class TelesignServerError(TelesignError):
    """Telesign server-side error (5xx).

    Transient failures that may succeed on retry. The circuit breaker
    monitors these to prevent cascading failures.
    """

    pass


class TelesignValidationError(TelesignError):
    """Client-side validation error (400).

    Indicates malformed request parameters. These should NOT be retried
    as the same request will always fail.
    """

    pass


class TelesignTimeoutError(TelesignError):
    """Request timed out before receiving a response.

    May be retried with exponential backoff.
    """

    pass


class CircuitOpenError(TelesignError):
    """Circuit breaker is open — requests are being rejected.

    The Telesign API has experienced too many consecutive failures.
    Requests will resume after the recovery timeout expires.
    """

    pass
