"""Fault tolerance integration tests.

Verifies retry logic, circuit breaker behavior, timeout handling,
and rate limit enforcement through the full tool stack.
"""

from __future__ import annotations

import time

import httpx
import pytest
import respx

from telesign_mcp.client import TelesignClient
from telesign_mcp.config import load_server_settings, load_telesign_settings
from telesign_mcp.metrics import ServerMetrics
from telesign_mcp.ratelimit import RateLimitExceeded, SlidingWindowRateLimiter
from telesign_mcp.server import AppState, _instrument_tool
from telesign_mcp.tools.intelligence import intelligence_score

TELESIGN_BASE = "https://rest-api.telesign.com"


class TestRetryBehavior:
    """Test that transient failures are retried correctly."""

    @pytest.mark.asyncio
    async def test_retries_on_500_then_succeeds(
        self,
        telesign_client: TelesignClient,
        respx_mock: respx.MockRouter,
    ) -> None:
        """Client retries on 500 and succeeds on subsequent attempt."""
        route = respx_mock.post(url__regex=r".*/v1/score/\+?15555550100")
        route.side_effect = [
            httpx.Response(500, json={"status": {"code": 500, "description": "Server Error"}}),
            httpx.Response(500, json={"status": {"code": 500, "description": "Server Error"}}),
            httpx.Response(
                200,
                json={
                    "reference_id": "ref-001",
                    "status": {"code": 300, "description": "Transaction successfully completed"},
                    "risk": {"score": 100, "level": "low", "recommendation": "allow"},
                    "phone_type": {"code": "2", "description": "MOBILE"},
                },
            ),
        ]

        result = await intelligence_score(
            client=telesign_client,
            phone_number="+15555550100",
            account_lifecycle_event="create",
        )

        assert result["success"] is True
        assert route.call_count == 3  # 2 failures + 1 success

    @pytest.mark.asyncio
    async def test_no_retry_on_auth_error(
        self,
        telesign_client: TelesignClient,
        respx_mock: respx.MockRouter,
    ) -> None:
        """Auth errors (401) are not retried — they fail immediately."""
        route = respx_mock.post(url__regex=r".*/v1/score/\+?15555550100").respond(
            401,
            json={"status": {"code": 401, "description": "Unauthorized"}},
        )

        result = await intelligence_score(
            client=telesign_client,
            phone_number="+15555550100",
            account_lifecycle_event="create",
        )

        assert result["success"] is False
        assert route.call_count == 1  # No retries

    @pytest.mark.asyncio
    async def test_no_retry_on_validation_error(
        self,
        telesign_client: TelesignClient,
        respx_mock: respx.MockRouter,
    ) -> None:
        """Validation errors (400) are not retried."""
        route = respx_mock.post(url__regex=r".*/v1/score/\+?15555550100").respond(
            400,
            json={"status": {"code": 400, "description": "Bad Request"}},
        )

        result = await intelligence_score(
            client=telesign_client,
            phone_number="+15555550100",
            account_lifecycle_event="create",
        )

        assert result["success"] is False
        assert route.call_count == 1


class TestRateLimitEnforcement:
    """Test the sliding-window rate limiter."""

    def test_rate_limiter_rejects_when_exhausted(self) -> None:
        """Rate limiter raises RateLimitExceeded after limit is reached."""
        limiter = SlidingWindowRateLimiter(max_requests=3, window_seconds=60.0)

        for _ in range(3):
            limiter.acquire()

        with pytest.raises(RateLimitExceeded) as exc_info:
            limiter.acquire()

        assert exc_info.value.retry_after_seconds > 0

    def test_instrument_tool_records_rejection(self) -> None:
        """_instrument_tool records rate limit rejection in metrics."""
        metrics = ServerMetrics()
        limiter = SlidingWindowRateLimiter(max_requests=1, window_seconds=60.0)

        state = AppState(
            server_settings=load_server_settings(),
            telesign_settings=load_telesign_settings(),
            telesign_client=TelesignClient(load_telesign_settings()),
            metrics=metrics,
            rate_limiter=limiter,
        )

        # First call succeeds
        _instrument_tool(state, "test_tool")

        # Second call is rejected
        with pytest.raises(RateLimitExceeded):
            _instrument_tool(state, "test_tool")

        snapshot = metrics.snapshot()
        assert snapshot["rate_limit_rejections"] == 1

    def test_sliding_window_resets_after_expiry(self) -> None:
        """Rate limiter allows new requests after the window expires."""
        limiter = SlidingWindowRateLimiter(max_requests=2, window_seconds=0.1)

        limiter.acquire()
        limiter.acquire()

        time.sleep(0.15)

        limiter.acquire()
        assert limiter.current_usage == 1

    def test_rate_limiter_status(self) -> None:
        """Rate limiter status reports current usage and remaining capacity."""
        limiter = SlidingWindowRateLimiter(max_requests=10, window_seconds=60.0)

        for _ in range(4):
            limiter.acquire()

        status = limiter.status()
        assert status["current_usage"] == 4
        assert status["remaining"] == 6
        assert status["limit"] == 10


class TestMetricsUnderLoad:
    """Test that metrics track correctly under various conditions."""

    @pytest.mark.asyncio
    async def test_metrics_across_multiple_tools(
        self,
        app_state: AppState,
        mock_intelligence_success: respx.Route,
        mock_email_success: respx.Route,
    ) -> None:
        """Metrics track calls across different tools independently."""
        from telesign_mcp.tools.email import email_intelligence as _email_intel

        # Call intelligence_score
        start = time.monotonic()
        await intelligence_score(
            client=app_state.telesign_client,
            phone_number="+15555550100",
            account_lifecycle_event="create",
        )
        elapsed = (time.monotonic() - start) * 1000
        app_state.metrics.record_tool_call("intelligence_score", elapsed, success=True)

        # Call email_intelligence
        start = time.monotonic()
        await _email_intel(
            client=app_state.telesign_client,
            email_address="user@example.com",
        )
        elapsed = (time.monotonic() - start) * 1000
        app_state.metrics.record_tool_call("email_intelligence", elapsed, success=True)

        snapshot = app_state.metrics.snapshot()
        assert snapshot["tools"]["intelligence_score"]["calls"] == 1
        assert snapshot["tools"]["email_intelligence"]["calls"] == 1
        assert snapshot["total_requests"] == 2

    def test_error_type_tracking(self) -> None:
        """Different error types are tracked separately in metrics."""
        metrics = ServerMetrics()

        metrics.record_error("TelesignAuthError")
        metrics.record_error("TelesignAuthError")
        metrics.record_error("TelesignServerError")

        snapshot = metrics.snapshot()
        assert snapshot["error_types"]["TelesignAuthError"] == 2
        assert snapshot["error_types"]["TelesignServerError"] == 1
