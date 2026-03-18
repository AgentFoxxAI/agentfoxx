"""Tests for phone_identity_deep_check tool."""

from __future__ import annotations

import pytest
import respx
from httpx import Response

from telesign_mcp.client import TelesignClient
from telesign_mcp.config import TelesignSettings
from telesign_mcp.tools.phone_identity import phone_identity_deep_check


@pytest.fixture
def telesign_settings() -> TelesignSettings:
    return TelesignSettings(
        customer_id="test-customer-id-000",
        api_key="dGVzdC1hcGkta2V5LWJhc2U2NA==",
        base_url="https://rest-api.telesign.com",
    )


@pytest.fixture
def mock_phoneid_response() -> dict:
    """Realistic Telesign PhoneID response."""
    return {
        "reference_id": "phoneid-ref-001",
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
        },
        "phone_type": {"code": "2", "description": "MOBILE"},
        "carrier": {"name": "Verizon Wireless"},
        "location": {
            "city": "New York",
            "state": "NY",
            "country": {"name": "United States", "iso2": "US", "iso3": "USA"},
        },
        "risk": {
            "level": "low",
            "recommendation": "allow",
            "score": 50,
        },
    }


class TestPhoneIdentitySuccess:
    """Test successful phone_identity_deep_check invocations."""

    @respx.mock
    async def test_basic_phoneid(
        self, telesign_settings: TelesignSettings, mock_phoneid_response: dict
    ) -> None:
        respx.post("https://rest-api.telesign.com/v1/phoneid/+15555550100").mock(
            return_value=Response(200, json=mock_phoneid_response)
        )

        async with TelesignClient(telesign_settings) as client:
            result = await phone_identity_deep_check(
                client=client,
                phone_number="+15555550100",
            )

        assert result["success"] is True
        assert result["tool"] == "phone_identity_deep_check"
        assert result["data"]["phone_type"]["description"] == "MOBILE"
        assert result["data"]["carrier"]["name"] == "Verizon Wireless"

    @respx.mock
    async def test_phoneid_with_addons(
        self, telesign_settings: TelesignSettings, mock_phoneid_response: dict
    ) -> None:
        """Test PhoneID with enrichment add-ons."""
        mock_phoneid_response["subscriber_status"] = {
            "status": "active",
            "subscriber_type": "postpaid",
        }
        route = respx.post("https://rest-api.telesign.com/v1/phoneid/+15555550100").mock(
            return_value=Response(200, json=mock_phoneid_response)
        )

        async with TelesignClient(telesign_settings) as client:
            result = await phone_identity_deep_check(
                client=client,
                phone_number="+15555550100",
                addons=["subscriber_status"],
            )

        assert result["success"] is True
        assert route.called

    @respx.mock
    async def test_phoneid_voip_detection(self, telesign_settings: TelesignSettings) -> None:
        """Test identification of VOIP numbers."""
        voip_response = {
            "reference_id": "voip-ref",
            "status": {"code": 300, "description": "OK"},
            "phone_type": {"code": "5", "description": "VOIP"},
            "risk": {"level": "medium-high", "recommendation": "flag", "score": 650},
        }
        respx.post("https://rest-api.telesign.com/v1/phoneid/+15555550199").mock(
            return_value=Response(200, json=voip_response)
        )

        async with TelesignClient(telesign_settings) as client:
            result = await phone_identity_deep_check(
                client=client,
                phone_number="+15555550199",
            )

        assert result["success"] is True
        assert result["data"]["phone_type"]["description"] == "VOIP"
        assert result["data"]["risk"]["recommendation"] == "flag"


class TestPhoneIdentityValidation:
    """Test input validation."""

    async def test_invalid_phone(self, telesign_settings: TelesignSettings) -> None:
        async with TelesignClient(telesign_settings) as client:
            result = await phone_identity_deep_check(
                client=client,
                phone_number="bad-number",
            )
        assert result["success"] is False

    async def test_invalid_addon(self, telesign_settings: TelesignSettings) -> None:
        async with TelesignClient(telesign_settings) as client:
            result = await phone_identity_deep_check(
                client=client,
                phone_number="+15555550100",
                addons=["nonexistent_addon"],
            )
        assert result["success"] is False
        assert "Invalid addons" in result["error_message"]


class TestPhoneIdentityErrors:
    """Test API error handling."""

    @respx.mock
    async def test_server_error(self, telesign_settings: TelesignSettings) -> None:
        """Test 500 error returns structured error."""
        respx.post("https://rest-api.telesign.com/v1/phoneid/+15555550100").mock(
            return_value=Response(500, json={"error": "Internal server error"})
        )

        async with TelesignClient(telesign_settings) as client:
            result = await phone_identity_deep_check(
                client=client,
                phone_number="+15555550100",
            )

        assert result["success"] is False
        assert result["error_type"] == "server_error"
