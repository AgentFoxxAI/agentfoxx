"""Integration test fixtures.

Integration tests come in two flavours:

1. **Simulated** (default): Exercise the full stack with mocked HTTP via respx.
   These always run and verify end-to-end wiring without real credentials.

2. **Live** (opt-in): Hit the real Telesign API.
   Skipped unless TELESIGN_INTEGRATION=1 is set with real credentials.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator

import pytest
import respx
from fastmcp import FastMCP

from telesign_mcp.client import TelesignClient
from telesign_mcp.config import (
    ServerSettings,
    TelesignSettings,
    load_server_settings,
    load_telesign_settings,
)
from telesign_mcp.metrics import ServerMetrics
from telesign_mcp.ratelimit import SlidingWindowRateLimiter
from telesign_mcp.server import AppState, server_lifespan

# Mark for live-only tests
live_only = pytest.mark.skipif(
    os.getenv("TELESIGN_INTEGRATION", "0") != "1",
    reason="Set TELESIGN_INTEGRATION=1 and provide real credentials to run",
)


@pytest.fixture
def telesign_settings() -> TelesignSettings:
    """Load TelesignSettings from (mock) environment."""
    return load_telesign_settings()


@pytest.fixture
def server_settings() -> ServerSettings:
    """Load ServerSettings from (mock) environment."""
    return load_server_settings()


@pytest.fixture
async def telesign_client(telesign_settings: TelesignSettings) -> AsyncIterator[TelesignClient]:
    """Provide an initialized TelesignClient (for mocked HTTP tests)."""
    client = TelesignClient(telesign_settings)
    async with client:
        yield client


@pytest.fixture
def metrics() -> ServerMetrics:
    """Fresh ServerMetrics instance."""
    return ServerMetrics()


@pytest.fixture
def rate_limiter(server_settings: ServerSettings) -> SlidingWindowRateLimiter:
    """Rate limiter configured from server settings."""
    return SlidingWindowRateLimiter(
        max_requests=server_settings.rate_limit_per_minute,
        window_seconds=60.0,
    )


@pytest.fixture
async def app_state() -> AsyncIterator[AppState]:
    """Yield a fully-initialized AppState via the real lifespan manager."""
    server = FastMCP(name="integration-test")
    async with server_lifespan(server) as state:
        yield state


# ── Respx mock helpers ──────────────────────────────────────────────

TELESIGN_BASE = "https://rest-api.telesign.com"


@pytest.fixture
def mock_intelligence_success(respx_mock: respx.MockRouter) -> respx.Route:
    """Mock a successful Intelligence Score response."""
    return respx_mock.post(url__regex=r".*/v1/score/\+?15555550100").respond(
        200,
        json={
            "reference_id": "ref-intl-001",
            "status": {"code": 300, "description": "Transaction successfully completed"},
            "risk": {
                "score": 250,
                "level": "medium-low",
                "recommendation": "allow",
            },
            "phone_type": {"code": "2", "description": "MOBILE"},
            "carrier": {"name": "T-Mobile"},
            "location": {"country": {"iso2": "US"}},
        },
    )


@pytest.fixture
def mock_phoneid_success(respx_mock: respx.MockRouter) -> respx.Route:
    """Mock a successful PhoneID response."""
    return respx_mock.post(url__regex=r".*/v1/phoneid/\+?15555550100").respond(
        200,
        json={
            "reference_id": "ref-pid-001",
            "status": {"code": 300, "description": "Transaction successfully completed"},
            "phone_type": {"code": "2", "description": "MOBILE"},
            "carrier": {"name": "T-Mobile"},
            "location": {"country": {"iso2": "US"}, "city": "Los Angeles", "state": "CA"},
            "numbering": {"original": {"phone_number": "+15555550100"}},
        },
    )


@pytest.fixture
def mock_verify_send_success(respx_mock: respx.MockRouter) -> respx.Route:
    """Mock a successful Verify SMS send response."""
    return respx_mock.post(f"{TELESIGN_BASE}/v1/verify/sms").respond(
        200,
        json={
            "reference_id": "ref-verify-001",
            "status": {"code": 290, "description": "Message in progress"},
            "sub_resource": "sms",
            "verify": {"code_state": "UNKNOWN"},
        },
    )


@pytest.fixture
def mock_verify_status_success(respx_mock: respx.MockRouter) -> respx.Route:
    """Mock a successful Verify status check response."""
    return respx_mock.get(f"{TELESIGN_BASE}/v1/verify/ref-verify-001").respond(
        200,
        json={
            "reference_id": "ref-verify-001",
            "status": {"code": 300, "description": "Transaction successfully completed"},
            "sub_resource": "sms",
            "verify": {"code_state": "VALID"},
        },
    )


@pytest.fixture
def mock_email_success(respx_mock: respx.MockRouter) -> respx.Route:
    """Mock a successful Email Intelligence response."""
    return respx_mock.post(f"{TELESIGN_BASE}/v1/score/email").respond(
        200,
        json={
            "reference_id": "ref-email-001",
            "status": {"code": 300, "description": "Transaction successfully completed"},
            "risk": {
                "score": 100,
                "level": "low",
                "recommendation": "allow",
            },
            "email": {
                "is_valid": True,
                "is_disposable": False,
                "domain_age_days": 5000,
            },
        },
    )


@pytest.fixture
def mock_all_tools_success(
    mock_intelligence_success: respx.Route,
    mock_phoneid_success: respx.Route,
    mock_verify_send_success: respx.Route,
    mock_verify_status_success: respx.Route,
    mock_email_success: respx.Route,
) -> None:
    """Activate all mock API responses at once."""
    pass
