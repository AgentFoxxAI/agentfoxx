"""Unit tests for MCP server lifecycle and configuration.

Tests server creation, lifespan management, health checks,
tool registration, and graceful shutdown behavior.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from telesign_mcp.client import TelesignClient
from telesign_mcp.config import ServerSettings, TelesignSettings
from telesign_mcp.metrics import ServerMetrics
from telesign_mcp.ratelimit import SlidingWindowRateLimiter
from telesign_mcp.server import AppState, create_server, server_lifespan


class TestCreateServer:
    """Test MCP server factory function."""

    def test_creates_fastmcp_instance(self) -> None:
        """create_server returns a FastMCP instance."""
        from fastmcp import FastMCP

        server = create_server()
        assert isinstance(server, FastMCP)

    def test_server_has_name(self) -> None:
        """Server is created with the correct name."""
        server = create_server()
        assert server.name == "telesign-mcp-server"

    def test_server_has_instructions(self) -> None:
        """Server includes LLM-facing instructions."""
        server = create_server()
        assert server.instructions is not None
        assert "Telesign" in server.instructions

    @pytest.mark.asyncio
    async def test_health_check_tool_registered(self) -> None:
        """Health check tool is available after server creation."""
        server = create_server()
        tools = await server.providers[0].list_tools()
        tool_names = [t.name for t in tools]
        assert "health_check" in tool_names

    @pytest.mark.asyncio
    async def test_all_tools_registered(self) -> None:
        """All tools (Phase 3 + Phase 4) are registered on the server."""
        server = create_server()
        tools = await server.providers[0].list_tools()
        tool_names = {t.name for t in tools}
        expected = {
            "health_check",
            "intelligence_score",
            "phone_identity_deep_check",
            "adaptive_verify_send",
            "adaptive_verify_status",
            "email_intelligence",
            "fraud_intent_analysis",
            "fraud_intent_plan",
        }
        assert expected.issubset(tool_names), f"Missing tools: {expected - tool_names}"

    @pytest.mark.asyncio
    async def test_tool_count(self) -> None:
        """Server has exactly 8 tools registered."""
        server = create_server()
        tools = await server.providers[0].list_tools()
        assert len(tools) == 8


class TestServerLifespan:
    """Test server startup and shutdown lifecycle."""

    @pytest.mark.asyncio
    async def test_lifespan_yields_app_state(self) -> None:
        """Lifespan context manager yields AppState with valid config."""
        from fastmcp import FastMCP

        server = FastMCP(name="test")
        async with server_lifespan(server) as state:
            assert isinstance(state, AppState)
            assert isinstance(state.server_settings, ServerSettings)
            assert isinstance(state.telesign_settings, TelesignSettings)
            assert isinstance(state.telesign_client, TelesignClient)
            assert isinstance(state.metrics, ServerMetrics)
            assert isinstance(state.rate_limiter, SlidingWindowRateLimiter)

    @pytest.mark.asyncio
    async def test_lifespan_fails_on_missing_credentials(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Lifespan fails fast if Telesign credentials are missing."""
        monkeypatch.delenv("TELESIGN_CUSTOMER_ID", raising=False)
        monkeypatch.delenv("TELESIGN_API_KEY", raising=False)

        from fastmcp import FastMCP

        server = FastMCP(name="test")
        with pytest.raises(ValidationError):
            async with server_lifespan(server) as _state:
                pass

    @pytest.mark.asyncio
    async def test_lifespan_state_has_telesign_config(self) -> None:
        """AppState contains validated Telesign credentials."""
        from fastmcp import FastMCP

        server = FastMCP(name="test")
        async with server_lifespan(server) as state:
            assert state.telesign_settings.customer_id == "test-customer-id-000"
            assert len(state.telesign_settings.api_key) > 0

    @pytest.mark.asyncio
    async def test_lifespan_initializes_client(self) -> None:
        """Lifespan initializes the TelesignClient with HTTP connection."""
        from fastmcp import FastMCP

        server = FastMCP(name="test")
        async with server_lifespan(server) as state:
            # Client should be initialized (has internal http_client)
            assert state.telesign_client._http_client is not None


class TestAppState:
    """Test application state dataclass."""

    def test_app_state_construction(self) -> None:
        """AppState can be constructed with all required fields."""
        server_settings = ServerSettings()
        telesign_settings = TelesignSettings(
            customer_id="test-id",
            api_key="test-key",
        )
        client = TelesignClient(telesign_settings)
        metrics = ServerMetrics()
        rate_limiter = SlidingWindowRateLimiter(max_requests=60)
        state = AppState(
            server_settings=server_settings,
            telesign_settings=telesign_settings,
            telesign_client=client,
            metrics=metrics,
            rate_limiter=rate_limiter,
        )
        assert state.server_settings is server_settings
        assert state.telesign_settings is telesign_settings
        assert state.telesign_client is client
        assert state.metrics is metrics
        assert state.rate_limiter is rate_limiter
