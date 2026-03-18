"""Tests for tool helper utilities."""

from __future__ import annotations

from telesign_mcp.exceptions import (
    CircuitOpenError,
    TelesignAuthError,
    TelesignRateLimitError,
    TelesignServerError,
    TelesignTimeoutError,
    TelesignValidationError,
)
from telesign_mcp.tools._helpers import format_error, format_success


class TestFormatSuccess:
    """Test success envelope formatting."""

    def test_basic_success(self) -> None:
        result = format_success("test_tool", {"key": "value"})
        assert result["success"] is True
        assert result["tool"] == "test_tool"
        assert result["data"]["key"] == "value"

    def test_empty_data(self) -> None:
        result = format_success("test_tool", {})
        assert result["success"] is True
        assert result["data"] == {}

    def test_nested_data(self) -> None:
        result = format_success(
            "test_tool",
            {
                "risk": {"score": 500, "level": "high"},
                "carrier": {"name": "Test"},
            },
        )
        assert result["data"]["risk"]["score"] == 500


class TestFormatError:
    """Test error envelope formatting for each exception type."""

    def test_auth_error(self) -> None:
        exc = TelesignAuthError("Auth failed", status_code=401)
        result = format_error("test_tool", exc)
        assert result["success"] is False
        assert result["error_type"] == "authentication_error"

    def test_rate_limit_error(self) -> None:
        exc = TelesignRateLimitError("Rate limited", retry_after_seconds=60.0)
        result = format_error("test_tool", exc)
        assert result["error_type"] == "rate_limit_error"
        assert result["retry_after_seconds"] == 60.0

    def test_server_error(self) -> None:
        exc = TelesignServerError("Server down", status_code=503)
        result = format_error("test_tool", exc)
        assert result["error_type"] == "server_error"

    def test_validation_error(self) -> None:
        exc = TelesignValidationError("Bad input", status_code=400)
        result = format_error("test_tool", exc)
        assert result["error_type"] == "validation_error"

    def test_timeout_error(self) -> None:
        exc = TelesignTimeoutError("Timed out")
        result = format_error("test_tool", exc)
        assert result["error_type"] == "timeout_error"

    def test_circuit_open_error(self) -> None:
        exc = CircuitOpenError("Circuit is open")
        result = format_error("test_tool", exc)
        assert result["error_type"] == "circuit_open_error"

    def test_unknown_error(self) -> None:
        exc = RuntimeError("Something unexpected")
        result = format_error("test_tool", exc)
        assert result["error_type"] == "unknown_error"
