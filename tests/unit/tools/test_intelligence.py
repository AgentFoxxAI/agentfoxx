"""Tests for intelligence_score tool.

Uses respx to mock Telesign HTTP responses and validates the
full request→response pipeline including input validation,
HMAC auth, error handling, and structured output formatting.
"""

from __future__ import annotations

import pytest
import respx
from httpx import Response

from telesign_mcp.client import TelesignClient
from telesign_mcp.config import TelesignSettings
from telesign_mcp.tools.intelligence import intelligence_score


@pytest.fixture
def telesign_settings() -> TelesignSettings:
    """Create test TelesignSettings."""
    return TelesignSettings(
        customer_id="test-customer-id-000",
        api_key="dGVzdC1hcGkta2V5LWJhc2U2NA==",
        base_url="https://rest-api.telesign.com",
    )


@pytest.fixture
def mock_score_response() -> dict:
    """Realistic Telesign Score API response."""
    return {
        "reference_id": "0123456789ABCDEF0123456789ABCDEF",
        "status": {
            "updated_on": "2025-01-15T10:30:00.000000Z",
            "code": 300,
            "description": "Transaction successfully completed",
        },
        "numbering": {
            "original": {
                "complete_phone_number": "+15555550100",
                "country_code": "1",
                "phone_number": "5555550100",
            },
            "cleansing": {
                "call": {
                    "country_code": "1",
                    "phone_number": "5555550100",
                    "cleansed_code": 100,
                },
                "sms": {
                    "country_code": "1",
                    "phone_number": "5555550100",
                    "cleansed_code": 100,
                },
            },
        },
        "phone_type": {"code": "2", "description": "MOBILE"},
        "carrier": {"name": "T-Mobile USA"},
        "location": {
            "city": "Los Angeles",
            "state": "CA",
            "country": {"name": "United States", "iso2": "US", "iso3": "USA"},
        },
        "risk": {
            "level": "low",
            "recommendation": "allow",
            "score": 85,
        },
        "risk_insights": {
            "status": 200,
            "category": ["safe"],
            "number_type": ["mobile"],
        },
    }


class TestIntelligenceScoreSuccess:
    """Test successful intelligence_score invocations."""

    @respx.mock
    async def test_score_success(
        self, telesign_settings: TelesignSettings, mock_score_response: dict
    ) -> None:
        """Test successful score request with full response."""
        respx.post("https://rest-api.telesign.com/v1/score/+15555550100").mock(
            return_value=Response(200, json=mock_score_response)
        )

        async with TelesignClient(telesign_settings) as client:
            result = await intelligence_score(
                client=client,
                phone_number="+15555550100",
                account_lifecycle_event="create",
            )

        assert result["success"] is True
        assert result["tool"] == "intelligence_score"
        assert result["data"]["risk"]["score"] == 85
        assert result["data"]["risk"]["recommendation"] == "allow"
        assert result["data"]["carrier"]["name"] == "T-Mobile USA"

    @respx.mock
    async def test_score_with_ip_and_email(
        self, telesign_settings: TelesignSettings, mock_score_response: dict
    ) -> None:
        """Test score request with all optional enrichment params."""
        route = respx.post("https://rest-api.telesign.com/v1/score/+15555550100").mock(
            return_value=Response(200, json=mock_score_response)
        )

        async with TelesignClient(telesign_settings) as client:
            result = await intelligence_score(
                client=client,
                phone_number="+15555550100",
                account_lifecycle_event="transact",
                originating_ip="192.168.1.1",
                email_address="user@example.com",
            )

        assert result["success"] is True
        assert route.called

    @respx.mock
    async def test_score_minimal_response(self, telesign_settings: TelesignSettings) -> None:
        """Test handling of minimal response (no optional fields)."""
        minimal = {
            "reference_id": "ref-minimal",
            "status": {"code": 300, "description": "OK"},
        }
        respx.post("https://rest-api.telesign.com/v1/score/+447911123456").mock(
            return_value=Response(200, json=minimal)
        )

        async with TelesignClient(telesign_settings) as client:
            result = await intelligence_score(
                client=client,
                phone_number="+447911123456",
                account_lifecycle_event="sign-in",
            )

        assert result["success"] is True
        assert "risk" not in result["data"]  # excluded by exclude_none


class TestIntelligenceScoreValidation:
    """Test input validation error handling."""

    async def test_invalid_phone_number(self, telesign_settings: TelesignSettings) -> None:
        """Test rejection of invalid phone numbers."""
        async with TelesignClient(telesign_settings) as client:
            result = await intelligence_score(
                client=client,
                phone_number="not-a-phone",
                account_lifecycle_event="create",
            )

        assert result["success"] is False
        assert result["error_type"] == "unknown_error"

    async def test_invalid_lifecycle_event(self, telesign_settings: TelesignSettings) -> None:
        """Test rejection of invalid lifecycle events."""
        async with TelesignClient(telesign_settings) as client:
            result = await intelligence_score(
                client=client,
                phone_number="+15555550100",
                account_lifecycle_event="invalid",
            )

        assert result["success"] is False


class TestIntelligenceScoreErrors:
    """Test API error handling."""

    @respx.mock
    async def test_auth_error(self, telesign_settings: TelesignSettings) -> None:
        """Test 401 authentication error handling."""
        respx.post("https://rest-api.telesign.com/v1/score/+15555550100").mock(
            return_value=Response(
                401, json={"status": {"code": 401, "description": "Unauthorized"}}
            )
        )

        async with TelesignClient(telesign_settings) as client:
            result = await intelligence_score(
                client=client,
                phone_number="+15555550100",
                account_lifecycle_event="create",
            )

        assert result["success"] is False
        assert result["error_type"] == "authentication_error"

    @respx.mock
    async def test_rate_limit_error(self, telesign_settings: TelesignSettings) -> None:
        """Test 429 rate limit error with retry-after."""
        respx.post("https://rest-api.telesign.com/v1/score/+15555550100").mock(
            return_value=Response(
                429,
                json={"status": {"code": 429, "description": "Rate limit exceeded"}},
                headers={"Retry-After": "30"},
            )
        )

        async with TelesignClient(telesign_settings) as client:
            result = await intelligence_score(
                client=client,
                phone_number="+15555550100",
                account_lifecycle_event="create",
            )

        assert result["success"] is False
        assert result["error_type"] == "rate_limit_error"
        assert result["retry_after_seconds"] == 30.0

    @respx.mock
    async def test_validation_error_400(self, telesign_settings: TelesignSettings) -> None:
        """Test 400 validation error handling."""
        respx.post("https://rest-api.telesign.com/v1/score/+15555550100").mock(
            return_value=Response(400, json={"status": {"code": 400, "description": "Bad Request"}})
        )

        async with TelesignClient(telesign_settings) as client:
            result = await intelligence_score(
                client=client,
                phone_number="+15555550100",
                account_lifecycle_event="create",
            )

        assert result["success"] is False
        assert result["error_type"] == "validation_error"
