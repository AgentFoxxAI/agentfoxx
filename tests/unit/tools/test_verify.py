"""Tests for adaptive_verify tool (send + status)."""

from __future__ import annotations

import pytest
import respx
from httpx import Response

from telesign_mcp.client import TelesignClient
from telesign_mcp.config import TelesignSettings
from telesign_mcp.tools.verify import adaptive_verify_send, adaptive_verify_status


@pytest.fixture
def telesign_settings() -> TelesignSettings:
    return TelesignSettings(
        customer_id="test-customer-id-000",
        api_key="dGVzdC1hcGkta2V5LWJhc2U2NA==",
        base_url="https://rest-api.telesign.com",
    )


@pytest.fixture
def mock_verify_send_response() -> dict:
    return {
        "reference_id": "0123456789ABCDEF0123456789ABCDEF",
        "sub_resource": "sms",
        "errors": [],
        "status": {
            "updated_on": "2025-01-15T10:30:00.000000Z",
            "code": 290,
            "description": "Message in progress",
        },
        "verify": {
            "code_state": "UNKNOWN",
            "code_entered": "",
        },
    }


@pytest.fixture
def mock_verify_status_response() -> dict:
    return {
        "reference_id": "0123456789ABCDEF0123456789ABCDEF",
        "sub_resource": "sms",
        "errors": [],
        "status": {
            "updated_on": "2025-01-15T10:31:00.000000Z",
            "code": 200,
            "description": "Delivered to handset",
        },
        "verify": {
            "code_state": "VALID",
            "code_entered": "123456",
        },
    }


class TestAdaptiveVerifySend:
    """Test OTP sending via verify tool."""

    @respx.mock
    async def test_send_success(
        self, telesign_settings: TelesignSettings, mock_verify_send_response: dict
    ) -> None:
        respx.post("https://rest-api.telesign.com/v1/verify/sms").mock(
            return_value=Response(200, json=mock_verify_send_response)
        )

        async with TelesignClient(telesign_settings) as client:
            result = await adaptive_verify_send(
                client=client,
                phone_number="+15555550100",
            )

        assert result["success"] is True
        assert result["tool"] == "adaptive_verify"
        assert result["data"]["reference_id"] == "0123456789ABCDEF0123456789ABCDEF"
        assert result["data"]["status"]["code"] == 290
        assert result["data"]["verify"]["code_state"] == "UNKNOWN"

    @respx.mock
    async def test_send_with_custom_code(
        self, telesign_settings: TelesignSettings, mock_verify_send_response: dict
    ) -> None:
        route = respx.post("https://rest-api.telesign.com/v1/verify/sms").mock(
            return_value=Response(200, json=mock_verify_send_response)
        )

        async with TelesignClient(telesign_settings) as client:
            result = await adaptive_verify_send(
                client=client,
                phone_number="+15555550100",
                verify_code="987654",
            )

        assert result["success"] is True
        assert route.called

    @respx.mock
    async def test_send_with_template(
        self, telesign_settings: TelesignSettings, mock_verify_send_response: dict
    ) -> None:
        respx.post("https://rest-api.telesign.com/v1/verify/sms").mock(
            return_value=Response(200, json=mock_verify_send_response)
        )

        async with TelesignClient(telesign_settings) as client:
            result = await adaptive_verify_send(
                client=client,
                phone_number="+15555550100",
                template="Your code is $$CODE$$. Expires in 5 min.",
            )

        assert result["success"] is True

    async def test_send_invalid_phone(self, telesign_settings: TelesignSettings) -> None:
        async with TelesignClient(telesign_settings) as client:
            result = await adaptive_verify_send(
                client=client,
                phone_number="not-valid",
            )
        assert result["success"] is False

    async def test_send_code_too_short(self, telesign_settings: TelesignSettings) -> None:
        async with TelesignClient(telesign_settings) as client:
            result = await adaptive_verify_send(
                client=client,
                phone_number="+15555550100",
                verify_code="12",  # min 4
            )
        assert result["success"] is False


class TestAdaptiveVerifyStatus:
    """Test OTP verification status checking."""

    @respx.mock
    async def test_status_valid_code(
        self, telesign_settings: TelesignSettings, mock_verify_status_response: dict
    ) -> None:
        ref_id = "0123456789ABCDEF0123456789ABCDEF"
        respx.get(f"https://rest-api.telesign.com/v1/verify/{ref_id}").mock(
            return_value=Response(200, json=mock_verify_status_response)
        )

        async with TelesignClient(telesign_settings) as client:
            result = await adaptive_verify_status(
                client=client,
                reference_id=ref_id,
                verify_code="123456",
            )

        assert result["success"] is True
        assert result["data"]["verify"]["code_state"] == "VALID"

    @respx.mock
    async def test_status_without_code(self, telesign_settings: TelesignSettings) -> None:
        ref_id = "0123456789ABCDEF0123456789ABCDEF"
        status_resp = {
            "reference_id": ref_id,
            "sub_resource": "sms",
            "errors": [],
            "status": {"code": 290, "description": "Message in progress"},
            "verify": {"code_state": "UNKNOWN", "code_entered": ""},
        }
        respx.get(f"https://rest-api.telesign.com/v1/verify/{ref_id}").mock(
            return_value=Response(200, json=status_resp)
        )

        async with TelesignClient(telesign_settings) as client:
            result = await adaptive_verify_status(
                client=client,
                reference_id=ref_id,
            )

        assert result["success"] is True
        assert result["data"]["verify"]["code_state"] == "UNKNOWN"

    async def test_status_empty_reference_id(self, telesign_settings: TelesignSettings) -> None:
        async with TelesignClient(telesign_settings) as client:
            result = await adaptive_verify_status(
                client=client,
                reference_id="",
            )
        assert result["success"] is False

    @respx.mock
    async def test_status_auth_error(self, telesign_settings: TelesignSettings) -> None:
        ref_id = "ref-auth-test"
        respx.get(f"https://rest-api.telesign.com/v1/verify/{ref_id}").mock(
            return_value=Response(403, json={"error": "Forbidden"})
        )

        async with TelesignClient(telesign_settings) as client:
            result = await adaptive_verify_status(
                client=client,
                reference_id=ref_id,
            )

        assert result["success"] is False
        assert result["error_type"] == "authentication_error"
