"""Shared utilities for MCP tool implementations.

Provides common error-handling wrappers and response formatting
so each tool module stays focused on business logic.
"""

from __future__ import annotations

from typing import Any

from telesign_mcp.exceptions import (
    CircuitOpenError,
    TelesignAuthError,
    TelesignRateLimitError,
    TelesignServerError,
    TelesignTimeoutError,
    TelesignValidationError,
)
from telesign_mcp.logging import get_logger
from telesign_mcp.models.schemas import ToolError, ToolSuccess

logger = get_logger(__name__)


def format_success(tool_name: str, data: dict[str, Any]) -> dict[str, Any]:
    """Wrap a successful tool result in the standard envelope.

    Args:
        tool_name: MCP tool identifier.
        data: Tool-specific response payload.

    Returns:
        Serialized ToolSuccess dict.
    """
    return ToolSuccess(tool=tool_name, data=data).model_dump()


def format_error(tool_name: str, exc: Exception) -> dict[str, Any]:
    """Convert a Telesign exception into a structured MCP error response.

    Maps each exception type to a user-friendly error classification
    and message, with optional retry hints for rate limits.

    Args:
        tool_name: MCP tool identifier.
        exc: The caught exception.

    Returns:
        Serialized ToolError dict.
    """
    error_map: dict[type, str] = {
        TelesignAuthError: "authentication_error",
        TelesignRateLimitError: "rate_limit_error",
        TelesignServerError: "server_error",
        TelesignValidationError: "validation_error",
        TelesignTimeoutError: "timeout_error",
        CircuitOpenError: "circuit_open_error",
    }

    error_type = error_map.get(type(exc), "unknown_error")
    retry_after = None

    if isinstance(exc, TelesignRateLimitError):
        retry_after = exc.retry_after_seconds

    logger.error(
        "tool_error",
        tool=tool_name,
        error_type=error_type,
        error=str(exc),
    )

    return ToolError(
        tool=tool_name,
        error_type=error_type,
        error_message=str(exc),
        retry_after_seconds=retry_after,
    ).model_dump()
