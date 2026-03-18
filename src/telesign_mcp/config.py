"""Application settings management via environment variables.

Uses pydantic-settings for validated, type-safe configuration
with fail-fast behavior on missing required credentials.
"""

from __future__ import annotations

from enum import Enum

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class LogLevel(str, Enum):
    """Supported log levels."""

    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class LogFormat(str, Enum):
    """Supported log output formats."""

    JSON = "json"
    CONSOLE = "console"


class TransportType(str, Enum):
    """Supported MCP transport protocols."""

    STDIO = "stdio"
    SSE = "sse"
    STREAMABLE_HTTP = "streamable-http"


class TelesignSettings(BaseSettings):
    """Telesign API credentials and connection settings.

    All values loaded from environment variables prefixed with TELESIGN_.
    """

    model_config = SettingsConfigDict(
        env_prefix="TELESIGN_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    customer_id: str = Field(
        ...,
        description="Telesign Customer ID (UUID format)",
        min_length=1,
    )
    api_key: str = Field(
        ...,
        description="Telesign API Key (Base64-encoded HMAC secret)",
        min_length=1,
    )
    base_url: str = Field(
        default="https://rest-api.telesign.com",
        description="Telesign REST API base URL",
    )

    # Connection resilience
    connect_timeout: float = Field(
        default=5.0,
        description="HTTP connection timeout in seconds",
        gt=0,
    )
    read_timeout: float = Field(
        default=30.0,
        description="HTTP read timeout in seconds",
        gt=0,
    )
    max_retries: int = Field(
        default=3,
        description="Maximum retry attempts for transient failures",
        ge=0,
        le=10,
    )
    max_connections: int = Field(
        default=100,
        description="Maximum total HTTP connections in pool",
        ge=1,
    )
    max_connections_per_host: int = Field(
        default=20,
        description="Maximum HTTP connections per host",
        ge=1,
    )

    # Circuit breaker (lives here since it controls API client behavior)
    circuit_breaker_failure_threshold: int = Field(
        default=5,
        description="Consecutive failures before circuit opens",
        ge=1,
    )
    circuit_breaker_recovery_timeout: int = Field(
        default=30,
        description="Seconds before circuit half-opens for retry",
        ge=1,
    )

    @field_validator("base_url")
    @classmethod
    def validate_base_url(cls, v: str) -> str:
        """Ensure base_url is a valid HTTPS URL without trailing slash."""
        v = v.rstrip("/")
        if not v.startswith("https://"):
            raise ValueError("Telesign base_url must use HTTPS")
        return v


class ServerSettings(BaseSettings):
    """MCP server configuration.

    Values loaded from environment variables (no prefix).
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Server identity
    server_name: str = Field(
        default="telesign-mcp-server",
        description="MCP server name for discovery",
    )
    server_version: str = Field(
        default="1.0.0",
        description="Server version string",
    )

    # Transport
    transport: TransportType = Field(
        default=TransportType.STDIO,
        description="MCP transport protocol",
    )
    host: str = Field(
        default="0.0.0.0",
        description="HTTP bind host (for SSE/HTTP transport)",
    )
    port: int = Field(
        default=8000,
        description="HTTP bind port (for SSE/HTTP transport)",
        ge=1,
        le=65535,
    )

    # Logging
    log_level: LogLevel = Field(
        default=LogLevel.INFO,
        description="Logging verbosity level",
    )
    log_format: LogFormat = Field(
        default=LogFormat.JSON,
        description="Log output format (json for production, console for dev)",
    )

    # Rate limiting
    rate_limit_per_minute: int = Field(
        default=60,
        description="Maximum tool invocations per minute",
        ge=1,
    )


def load_telesign_settings() -> TelesignSettings:
    """Load and validate Telesign settings from environment.

    Raises:
        pydantic.ValidationError: If required credentials are missing or invalid.
    """
    return TelesignSettings()


def load_server_settings() -> ServerSettings:
    """Load and validate server settings from environment.

    Raises:
        pydantic.ValidationError: If configuration values are invalid.
    """
    return ServerSettings()
