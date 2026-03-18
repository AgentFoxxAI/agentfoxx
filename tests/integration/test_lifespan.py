"""Lifespan management integration tests.

Tests the server startup/shutdown lifecycle, configuration loading,
and resource initialization through the real lifespan context manager.
"""

from __future__ import annotations

import pytest
from fastmcp import FastMCP

from telesign_mcp.client import TelesignClient
from telesign_mcp.config import ServerSettings, TelesignSettings
from telesign_mcp.metrics import ServerMetrics
from telesign_mcp.ratelimit import SlidingWindowRateLimiter
from telesign_mcp.server import AppState, server_lifespan


class TestLifespanStartup:
    """Test server startup via the lifespan context manager."""

    @pytest.mark.asyncio
    async def test_full_initialization(self) -> None:
        """Lifespan initializes all components correctly."""
        server = FastMCP(name="test-startup")
        async with server_lifespan(server) as state:
            assert isinstance(state, AppState)
            assert isinstance(state.server_settings, ServerSettings)
            assert isinstance(state.telesign_settings, TelesignSettings)
            assert isinstance(state.telesign_client, TelesignClient)
            assert isinstance(state.metrics, ServerMetrics)
            assert isinstance(state.rate_limiter, SlidingWindowRateLimiter)

    @pytest.mark.asyncio
    async def test_metrics_start_fresh(self) -> None:
        """Metrics are initialized with zero counts on startup."""
        server = FastMCP(name="test-fresh-metrics")
        async with server_lifespan(server) as state:
            snapshot = state.metrics.snapshot()
            assert snapshot["total_requests"] == 0
            assert snapshot["total_errors"] == 0
            assert snapshot["rate_limit_rejections"] == 0

    @pytest.mark.asyncio
    async def test_rate_limiter_configured_from_settings(self) -> None:
        """Rate limiter limit matches server settings."""
        server = FastMCP(name="test-rate-config")
        async with server_lifespan(server) as state:
            status = state.rate_limiter.status()
            assert status["limit"] == state.server_settings.rate_limit_per_minute

    @pytest.mark.asyncio
    async def test_circuit_breaker_configured_from_settings(self) -> None:
        """Circuit breaker reads thresholds from TelesignSettings."""
        server = FastMCP(name="test-cb-config")
        async with server_lifespan(server) as state:
            assert state.telesign_settings.circuit_breaker_failure_threshold >= 1
            assert state.telesign_settings.circuit_breaker_recovery_timeout >= 1


class TestLifespanShutdown:
    """Test server shutdown via the lifespan context manager."""

    @pytest.mark.asyncio
    async def test_client_closed_after_lifespan(self) -> None:
        """TelesignClient HTTP pool is closed after lifespan exits."""
        server = FastMCP(name="test-shutdown")
        async with server_lifespan(server) as state:
            client = state.telesign_client
            assert client is not None

        # After lifespan exits, the internal httpx client should be closed
        assert client._http_client.is_closed

    @pytest.mark.asyncio
    async def test_metrics_available_during_shutdown(self) -> None:
        """Metrics snapshot is available at shutdown time for final logging."""
        server = FastMCP(name="test-shutdown-metrics")
        final_metrics = None

        async with server_lifespan(server) as state:
            state.metrics.record_tool_call("test_tool", 50.0, success=True)
            final_metrics = state.metrics.snapshot()

        assert final_metrics is not None
        assert final_metrics["total_requests"] == 1


class TestLifespanConfigFailure:
    """Test that lifespan fails fast on bad configuration."""

    @pytest.mark.asyncio
    async def test_missing_credentials_fails_startup(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Missing Telesign credentials prevent server startup."""
        monkeypatch.delenv("TELESIGN_CUSTOMER_ID", raising=False)
        monkeypatch.delenv("TELESIGN_API_KEY", raising=False)

        server = FastMCP(name="test-bad-config")
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            async with server_lifespan(server) as _state:
                pass
