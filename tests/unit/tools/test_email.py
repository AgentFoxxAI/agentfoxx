"""Tests for email_intelligence tool."""

from __future__ import annotations

import pytest
import respx
from httpx import Response

from telesign_mcp.client import TelesignClient
from telesign_mcp.config import TelesignSettings
from telesign_mcp.tools.email import email_intelligence


@pytest.fixture
def telesign_settings() -> TelesignSettings:
    return TelesignSettings(
        customer_id="test-customer-id-000",
        api_key="dGVzdC1hcGkta2V5LWJhc2U2NA==",
        base_url="https://rest-api.telesign.com",
    )


@pytest.fixture
def mock_intelligence_response() -> dict:
    """Full intelligence response with email enrichment."""
    return {
        "reference_id": "email-ref-001",
        "status": {
            "updated_on": "2025-01-15T10:30:00Z",
            "code": 300,
            "description": "Transaction successfully completed",
        },
        "risk": {
            "level": "medium",
            "recommendation": "flag",
            "score": 450,
        },
        "risk_insights": {
            "status": 200,
            "email": ["disposable_email_domain"],
        },
        "phone_type": {"code": "2", "description": "MOBILE"},
        "carrier": {"name": "AT&T"},
    }


class TestEmailIntelligenceWithPhone:
    """Test email intelligence with phone cross-reference."""

    @respx.mock
    async def test_email_with_phone_success(
        self, telesign_settings: TelesignSettings, mock_intelligence_response: dict
    ) -> None:
        respx.post("https://rest-api.telesign.com/v1/score/+15555550100").mock(
            return_value=Response(200, json=mock_intelligence_response)
        )

        async with TelesignClient(telesign_settings) as client:
            result = await email_intelligence(
                client=client,
                email_address="test@example.com",
                phone_number="+15555550100",
            )

        assert result["success"] is True
        assert result["tool"] == "email_intelligence"
        assert result["data"]["queried_email"] == "test@example.com"
        assert result["data"]["risk"]["score"] == 450

    @respx.mock
    async def test_email_with_phone_and_ip(
        self, telesign_settings: TelesignSettings, mock_intelligence_response: dict
    ) -> None:
        route = respx.post("https://rest-api.telesign.com/v1/score/+15555550100").mock(
            return_value=Response(200, json=mock_intelligence_response)
        )

        async with TelesignClient(telesign_settings) as client:
            result = await email_intelligence(
                client=client,
                email_address="test@example.com",
                phone_number="+15555550100",
                originating_ip="10.0.0.1",
            )

        assert result["success"] is True
        assert route.called


class TestEmailIntelligenceStandalone:
    """Test email-only intelligence (no phone number)."""

    @respx.mock
    async def test_email_only_success(self, telesign_settings: TelesignSettings) -> None:
        email_response = {
            "reference_id": "email-only-ref",
            "status": {"code": 300, "description": "OK"},
            "risk": {"level": "low", "recommendation": "allow", "score": 100},
        }
        respx.post("https://rest-api.telesign.com/v1/score/email").mock(
            return_value=Response(200, json=email_response)
        )

        async with TelesignClient(telesign_settings) as client:
            result = await email_intelligence(
                client=client,
                email_address="safe@company.com",
            )

        assert result["success"] is True
        assert result["data"]["email_address"] == "safe@company.com"


class TestEmailIntelligenceValidation:
    """Test input validation."""

    async def test_invalid_email(self, telesign_settings: TelesignSettings) -> None:
        async with TelesignClient(telesign_settings) as client:
            result = await email_intelligence(
                client=client,
                email_address="not-an-email",
            )
        assert result["success"] is False

    async def test_invalid_phone_with_email(self, telesign_settings: TelesignSettings) -> None:
        async with TelesignClient(telesign_settings) as client:
            result = await email_intelligence(
                client=client,
                email_address="test@example.com",
                phone_number="bad-phone",
            )
        assert result["success"] is False


class TestEmailIntelligenceErrors:
    """Test API error handling."""

    @respx.mock
    async def test_auth_error(self, telesign_settings: TelesignSettings) -> None:
        respx.post("https://rest-api.telesign.com/v1/score/+15555550100").mock(
            return_value=Response(401, json={"error": "Unauthorized"})
        )

        async with TelesignClient(telesign_settings) as client:
            result = await email_intelligence(
                client=client,
                email_address="test@example.com",
                phone_number="+15555550100",
            )

        assert result["success"] is False
        assert result["error_type"] == "authentication_error"
