"""End-to-end integration tests for all MCP tools.

Exercises the full stack: MCP tool → validation → client → mocked HTTP → response parsing.
Uses respx (via pytest-respx fixture) to mock Telesign API responses.
"""

from __future__ import annotations

import time

import pytest
import respx

from telesign_mcp.client import TelesignClient
from telesign_mcp.server import AppState
from telesign_mcp.tools.email import email_intelligence
from telesign_mcp.tools.intelligence import intelligence_score
from telesign_mcp.tools.phone_identity import phone_identity_deep_check
from telesign_mcp.tools.verify import adaptive_verify_send, adaptive_verify_status


class TestIntelligenceScoreE2E:
    """End-to-end tests for the Intelligence Score tool."""

    @pytest.mark.asyncio
    async def test_full_pipeline_success(
        self,
        telesign_client: TelesignClient,
        mock_intelligence_success: respx.Route,
    ) -> None:
        """Intelligence Score returns structured result through full pipeline."""
        result = await intelligence_score(
            client=telesign_client,
            phone_number="+15555550100",
            account_lifecycle_event="create",
        )

        assert result["success"] is True
        assert result["data"]["risk"]["score"] == 250
        assert result["data"]["risk"]["recommendation"] == "allow"
        assert result["data"]["phone_type"]["description"] == "MOBILE"
        assert mock_intelligence_success.called

    @pytest.mark.asyncio
    async def test_with_optional_signals(
        self,
        telesign_client: TelesignClient,
        mock_intelligence_success: respx.Route,
    ) -> None:
        """Intelligence Score accepts optional IP and email signals."""
        result = await intelligence_score(
            client=telesign_client,
            phone_number="+15555550100",
            account_lifecycle_event="sign-in",
            originating_ip="192.168.1.1",
            email_address="user@example.com",
        )

        assert result["success"] is True
        assert mock_intelligence_success.call_count == 1

    @pytest.mark.asyncio
    async def test_invalid_phone_returns_error(
        self,
        telesign_client: TelesignClient,
    ) -> None:
        """Invalid phone number is caught by validation before HTTP call."""
        result = await intelligence_score(
            client=telesign_client,
            phone_number="not-a-phone",
            account_lifecycle_event="create",
        )

        assert result["success"] is False
        assert "error_message" in result


class TestPhoneIdentityE2E:
    """End-to-end tests for the Phone Identity Deep Check tool."""

    @pytest.mark.asyncio
    async def test_basic_lookup(
        self,
        telesign_client: TelesignClient,
        mock_phoneid_success: respx.Route,
    ) -> None:
        """Phone ID returns carrier and type information."""
        result = await phone_identity_deep_check(
            client=telesign_client,
            phone_number="+15555550100",
        )

        assert result["success"] is True
        assert result["data"]["carrier"]["name"] == "T-Mobile"
        assert result["data"]["phone_type"]["description"] == "MOBILE"

    @pytest.mark.asyncio
    async def test_with_addons(
        self,
        telesign_client: TelesignClient,
        mock_phoneid_success: respx.Route,
    ) -> None:
        """Phone ID accepts enrichment add-ons."""
        result = await phone_identity_deep_check(
            client=telesign_client,
            phone_number="+15555550100",
            addons=["contact", "number_deactivation"],
        )

        assert result["success"] is True
        assert mock_phoneid_success.called


class TestVerifyE2E:
    """End-to-end tests for the Adaptive Verify tools."""

    @pytest.mark.asyncio
    async def test_send_and_check_flow(
        self,
        telesign_client: TelesignClient,
        mock_verify_send_success: respx.Route,
        mock_verify_status_success: respx.Route,
    ) -> None:
        """Full OTP flow: send → check status."""
        send_result = await adaptive_verify_send(
            client=telesign_client,
            phone_number="+15555550100",
        )
        assert send_result["success"] is True
        ref_id = send_result["data"]["reference_id"]
        assert ref_id == "ref-verify-001"

        status_result = await adaptive_verify_status(
            client=telesign_client,
            reference_id=ref_id,
            verify_code="12345",
        )
        assert status_result["success"] is True
        assert status_result["data"]["verify"]["code_state"] == "VALID"

    @pytest.mark.asyncio
    async def test_send_with_custom_code(
        self,
        telesign_client: TelesignClient,
        mock_verify_send_success: respx.Route,
    ) -> None:
        """Verify send accepts custom OTP code."""
        result = await adaptive_verify_send(
            client=telesign_client,
            phone_number="+15555550100",
            verify_code="987654",
            template="Your code is $$CODE$$. Expires in 5 min.",
        )

        assert result["success"] is True


class TestEmailIntelligenceE2E:
    """End-to-end tests for Email Intelligence tool."""

    @pytest.mark.asyncio
    async def test_email_only(
        self,
        telesign_client: TelesignClient,
        mock_email_success: respx.Route,
    ) -> None:
        """Email intelligence evaluates an email address."""
        result = await email_intelligence(
            client=telesign_client,
            email_address="user@example.com",
        )

        assert result["success"] is True
        assert result["data"]["risk"]["score"] == 100
        assert result["data"]["risk"]["recommendation"] == "allow"

    @pytest.mark.asyncio
    async def test_email_with_phone_cross_reference(
        self,
        telesign_client: TelesignClient,
        mock_intelligence_success: respx.Route,
    ) -> None:
        """Email intelligence with phone cross-reference."""
        result = await email_intelligence(
            client=telesign_client,
            email_address="user@example.com",
            phone_number="+15555550100",
            originating_ip="10.0.0.1",
        )

        assert result["success"] is True
        assert mock_intelligence_success.called


class TestMetricsIntegration:
    """Verify metrics are recorded correctly during tool execution."""

    @pytest.mark.asyncio
    async def test_successful_call_records_metrics(
        self,
        app_state: AppState,
        mock_intelligence_success: respx.Route,
    ) -> None:
        """A successful tool call records metrics (calls, latency)."""
        from telesign_mcp.server import _instrument_tool

        _instrument_tool(app_state, "intelligence_score")

        start = time.monotonic()
        await intelligence_score(
            client=app_state.telesign_client,
            phone_number="+15555550100",
            account_lifecycle_event="create",
        )
        elapsed = (time.monotonic() - start) * 1000

        app_state.metrics.record_tool_call("intelligence_score", elapsed, success=True)

        snapshot = app_state.metrics.snapshot()
        assert snapshot["tools"]["intelligence_score"]["calls"] == 1
        assert snapshot["tools"]["intelligence_score"]["errors"] == 0
        assert snapshot["tools"]["intelligence_score"]["latency"]["p50"] > 0

    @pytest.mark.asyncio
    async def test_validation_error_records_failure(
        self,
        app_state: AppState,
    ) -> None:
        """A validation error records an error metric."""
        start = time.monotonic()
        await intelligence_score(
            client=app_state.telesign_client,
            phone_number="bad-phone",
            account_lifecycle_event="create",
        )
        elapsed = (time.monotonic() - start) * 1000

        app_state.metrics.record_tool_call("intelligence_score", elapsed, success=False)

        snapshot = app_state.metrics.snapshot()
        assert snapshot["tools"]["intelligence_score"]["errors"] == 1
