"""Unit tests for configuration management.

Tests environment variable loading, validation, default values,
and fail-fast behavior for missing credentials.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from telesign_mcp.config import (
    LogFormat,
    LogLevel,
    ServerSettings,
    TelesignSettings,
    TransportType,
    load_server_settings,
    load_telesign_settings,
)


class TestTelesignSettings:
    """Test Telesign credential and connection settings."""

    def test_loads_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Valid env vars produce a valid settings object."""
        monkeypatch.setenv("TELESIGN_CUSTOMER_ID", "my-customer-id")
        monkeypatch.setenv("TELESIGN_API_KEY", "bXktYXBpLWtleQ==")
        settings = load_telesign_settings()
        assert settings.customer_id == "my-customer-id"
        assert settings.api_key == "bXktYXBpLWtleQ=="

    def test_missing_customer_id_raises(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Missing TELESIGN_CUSTOMER_ID causes ValidationError."""
        monkeypatch.delenv("TELESIGN_CUSTOMER_ID", raising=False)
        monkeypatch.setenv("TELESIGN_API_KEY", "some-key")
        with pytest.raises(ValidationError, match="customer_id"):
            TelesignSettings()

    def test_missing_api_key_raises(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Missing TELESIGN_API_KEY causes ValidationError."""
        monkeypatch.setenv("TELESIGN_CUSTOMER_ID", "some-id")
        monkeypatch.delenv("TELESIGN_API_KEY", raising=False)
        with pytest.raises(ValidationError, match="api_key"):
            TelesignSettings()

    def test_empty_customer_id_raises(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Empty string for customer_id is rejected."""
        monkeypatch.setenv("TELESIGN_CUSTOMER_ID", "")
        monkeypatch.setenv("TELESIGN_API_KEY", "some-key")
        with pytest.raises(ValidationError):
            TelesignSettings()

    def test_default_base_url(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Default base URL points to Telesign REST API."""
        monkeypatch.setenv("TELESIGN_CUSTOMER_ID", "id")
        monkeypatch.setenv("TELESIGN_API_KEY", "key")
        settings = TelesignSettings()
        assert settings.base_url == "https://rest-api.telesign.com"

    def test_custom_base_url(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Custom base URL is accepted and trailing slash stripped."""
        monkeypatch.setenv("TELESIGN_CUSTOMER_ID", "id")
        monkeypatch.setenv("TELESIGN_API_KEY", "key")
        monkeypatch.setenv("TELESIGN_BASE_URL", "https://custom.telesign.com/")
        settings = TelesignSettings()
        assert settings.base_url == "https://custom.telesign.com"

    def test_http_base_url_rejected(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Non-HTTPS base URL is rejected."""
        monkeypatch.setenv("TELESIGN_CUSTOMER_ID", "id")
        monkeypatch.setenv("TELESIGN_API_KEY", "key")
        monkeypatch.setenv("TELESIGN_BASE_URL", "http://insecure.telesign.com")
        with pytest.raises(ValidationError, match="HTTPS"):
            TelesignSettings()

    def test_default_timeouts(self) -> None:
        """Default timeout values are sensible for production."""
        settings = load_telesign_settings()
        assert settings.connect_timeout == 5.0
        assert settings.read_timeout == 30.0

    def test_custom_timeouts(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Timeout values can be overridden via env vars."""
        monkeypatch.setenv("TELESIGN_CUSTOMER_ID", "id")
        monkeypatch.setenv("TELESIGN_API_KEY", "key")
        monkeypatch.setenv("TELESIGN_CONNECT_TIMEOUT", "10.0")
        monkeypatch.setenv("TELESIGN_READ_TIMEOUT", "60.0")
        settings = TelesignSettings()
        assert settings.connect_timeout == 10.0
        assert settings.read_timeout == 60.0

    def test_zero_timeout_rejected(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Zero timeout is rejected (must be > 0)."""
        monkeypatch.setenv("TELESIGN_CUSTOMER_ID", "id")
        monkeypatch.setenv("TELESIGN_API_KEY", "key")
        monkeypatch.setenv("TELESIGN_CONNECT_TIMEOUT", "0")
        with pytest.raises(ValidationError):
            TelesignSettings()

    def test_default_connection_pool(self) -> None:
        """Default connection pool sizes are production-appropriate."""
        settings = load_telesign_settings()
        assert settings.max_connections == 100
        assert settings.max_connections_per_host == 20

    def test_max_retries_bounds(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Max retries cannot exceed 10."""
        monkeypatch.setenv("TELESIGN_CUSTOMER_ID", "id")
        monkeypatch.setenv("TELESIGN_API_KEY", "key")
        monkeypatch.setenv("TELESIGN_MAX_RETRIES", "11")
        with pytest.raises(ValidationError):
            TelesignSettings()

    def test_circuit_breaker_defaults(self) -> None:
        """Default circuit breaker settings are conservative."""
        settings = load_telesign_settings()
        assert settings.circuit_breaker_failure_threshold == 5
        assert settings.circuit_breaker_recovery_timeout == 30

    def test_circuit_breaker_custom(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Circuit breaker values can be overridden via env vars."""
        monkeypatch.setenv("TELESIGN_CUSTOMER_ID", "id")
        monkeypatch.setenv("TELESIGN_API_KEY", "key")
        monkeypatch.setenv("TELESIGN_CIRCUIT_BREAKER_FAILURE_THRESHOLD", "10")
        monkeypatch.setenv("TELESIGN_CIRCUIT_BREAKER_RECOVERY_TIMEOUT", "60")
        settings = TelesignSettings()
        assert settings.circuit_breaker_failure_threshold == 10
        assert settings.circuit_breaker_recovery_timeout == 60


class TestServerSettings:
    """Test MCP server configuration."""

    def test_default_values(self) -> None:
        """Default server settings are production-ready."""
        settings = load_server_settings()
        assert settings.server_name == "telesign-mcp-server"
        assert settings.transport == TransportType.STDIO
        assert settings.log_level == LogLevel.INFO
        assert settings.log_format == LogFormat.JSON
        assert settings.port == 8000

    def test_custom_transport(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Transport type can be changed via env var."""
        monkeypatch.setenv("TRANSPORT", "sse")
        settings = ServerSettings()
        assert settings.transport == TransportType.SSE

    def test_custom_log_level(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Log level can be changed via env var."""
        monkeypatch.setenv("LOG_LEVEL", "DEBUG")
        settings = ServerSettings()
        assert settings.log_level == LogLevel.DEBUG

    def test_console_log_format(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Console log format is available for development."""
        monkeypatch.setenv("LOG_FORMAT", "console")
        settings = ServerSettings()
        assert settings.log_format == LogFormat.CONSOLE

    def test_invalid_transport_rejected(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Invalid transport type raises ValidationError."""
        monkeypatch.setenv("TRANSPORT", "websocket")
        with pytest.raises(ValidationError):
            ServerSettings()

    def test_port_range_validation(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Port must be between 1 and 65535."""
        monkeypatch.setenv("PORT", "0")
        with pytest.raises(ValidationError):
            ServerSettings()

    def test_port_max_validation(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Port above 65535 is rejected."""
        monkeypatch.setenv("PORT", "70000")
        with pytest.raises(ValidationError):
            ServerSettings()

    def test_rate_limit_defaults(self) -> None:
        """Default rate limit is 60 requests per minute."""
        settings = load_server_settings()
        assert settings.rate_limit_per_minute == 60

    def test_rate_limit_custom(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Rate limit per minute can be overridden."""
        monkeypatch.setenv("RATE_LIMIT_PER_MINUTE", "120")
        settings = ServerSettings()
        assert settings.rate_limit_per_minute == 120
