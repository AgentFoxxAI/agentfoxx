"""Tests for Pydantic models and schemas.

Validates input validation, E.164 phone number format enforcement,
response model parsing, and tool output envelope formatting.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from telesign_mcp.models.schemas import (
    AccountLifecycleEvent,
    EmailInput,
    EmailIntelligenceResponse,
    IntelligenceInput,
    IntelligenceResponse,
    PhoneIdInput,
    PhoneIdResponse,
    PhoneNumberInput,
    ToolError,
    ToolSuccess,
    VerifyInput,
    VerifyResponse,
    VerifyStatusInput,
)

# ---------------------------------------------------------------------------
# PhoneNumberInput validation
# ---------------------------------------------------------------------------


class TestPhoneNumberInput:
    """Test E.164 phone number validation."""

    def test_valid_us_number(self) -> None:
        result = PhoneNumberInput(phone_number="+15555550100")
        assert result.phone_number == "+15555550100"

    def test_valid_uk_number(self) -> None:
        result = PhoneNumberInput(phone_number="+447911123456")
        assert result.phone_number == "+447911123456"

    def test_valid_short_number(self) -> None:
        result = PhoneNumberInput(phone_number="+1234567")
        assert result.phone_number == "+1234567"

    def test_missing_plus_prefix(self) -> None:
        with pytest.raises(ValidationError, match="E.164"):
            PhoneNumberInput(phone_number="15555550100")

    def test_leading_zero_country_code(self) -> None:
        with pytest.raises(ValidationError, match="E.164"):
            PhoneNumberInput(phone_number="+05555550100")

    def test_too_short(self) -> None:
        with pytest.raises(ValidationError):
            PhoneNumberInput(phone_number="+123")

    def test_non_numeric(self) -> None:
        with pytest.raises(ValidationError, match="E.164"):
            PhoneNumberInput(phone_number="+1555abc0100")

    def test_empty(self) -> None:
        with pytest.raises(ValidationError):
            PhoneNumberInput(phone_number="")


# ---------------------------------------------------------------------------
# IntelligenceInput validation
# ---------------------------------------------------------------------------


class TestIntelligenceInput:
    """Test Intelligence/Score API input model."""

    def test_valid_minimal(self) -> None:
        result = IntelligenceInput(
            phone_number="+15555550100",
            account_lifecycle_event="create",
        )
        assert result.account_lifecycle_event == AccountLifecycleEvent.CREATE

    def test_all_fields(self) -> None:
        result = IntelligenceInput(
            phone_number="+15555550100",
            account_lifecycle_event="sign-in",
            originating_ip="192.168.1.1",
            email_address="test@example.com",
        )
        assert result.originating_ip == "192.168.1.1"
        assert result.email_address == "test@example.com"

    def test_invalid_lifecycle_event(self) -> None:
        with pytest.raises(ValidationError):
            IntelligenceInput(
                phone_number="+15555550100",
                account_lifecycle_event="invalid_event",
            )

    def test_invalid_ip(self) -> None:
        with pytest.raises(ValidationError, match="Invalid IP"):
            IntelligenceInput(
                phone_number="+15555550100",
                account_lifecycle_event="create",
                originating_ip="not-an-ip",
            )

    def test_ipv6_accepted(self) -> None:
        result = IntelligenceInput(
            phone_number="+15555550100",
            account_lifecycle_event="create",
            originating_ip="::1",
        )
        assert result.originating_ip == "::1"


# ---------------------------------------------------------------------------
# PhoneIdInput validation
# ---------------------------------------------------------------------------


class TestPhoneIdInput:
    """Test PhoneID input model."""

    def test_valid_no_addons(self) -> None:
        result = PhoneIdInput(phone_number="+15555550100")
        assert result.addons is None

    def test_valid_with_addons(self) -> None:
        result = PhoneIdInput(
            phone_number="+15555550100",
            addons=["contact", "subscriber_status"],
        )
        assert len(result.addons) == 2


# ---------------------------------------------------------------------------
# VerifyInput validation
# ---------------------------------------------------------------------------


class TestVerifyInput:
    """Test Verify API input model."""

    def test_valid_minimal(self) -> None:
        result = VerifyInput(phone_number="+15555550100")
        assert result.verify_code is None
        assert result.template is None

    def test_custom_code(self) -> None:
        result = VerifyInput(
            phone_number="+15555550100",
            verify_code="123456",
        )
        assert result.verify_code == "123456"

    def test_code_too_short(self) -> None:
        with pytest.raises(ValidationError):
            VerifyInput(
                phone_number="+15555550100",
                verify_code="12",  # min is 4
            )

    def test_template(self) -> None:
        result = VerifyInput(
            phone_number="+15555550100",
            template="Your code is $$CODE$$",
        )
        assert "$$CODE$$" in result.template


# ---------------------------------------------------------------------------
# VerifyStatusInput validation
# ---------------------------------------------------------------------------


class TestVerifyStatusInput:
    """Test Verify status check input model."""

    def test_valid(self) -> None:
        result = VerifyStatusInput(
            reference_id="ABC123DEF456",
            verify_code="123456",
        )
        assert result.reference_id == "ABC123DEF456"

    def test_reference_id_required(self) -> None:
        with pytest.raises(ValidationError):
            VerifyStatusInput(reference_id="")


# ---------------------------------------------------------------------------
# EmailInput validation
# ---------------------------------------------------------------------------


class TestEmailInput:
    """Test email input validation."""

    def test_valid_email(self) -> None:
        result = EmailInput(email_address="user@example.com")
        assert result.email_address == "user@example.com"

    def test_invalid_email(self) -> None:
        with pytest.raises(ValidationError, match="Invalid email"):
            EmailInput(email_address="not-an-email")

    def test_email_missing_domain(self) -> None:
        with pytest.raises(ValidationError, match="Invalid email"):
            EmailInput(email_address="user@")


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class TestResponseModels:
    """Test response model parsing from API-like dicts."""

    def test_intelligence_response_full(self) -> None:
        data = {
            "reference_id": "ref-123",
            "status": {"code": 300, "description": "Transaction successfully completed"},
            "numbering": {
                "original": {
                    "complete_phone_number": "+15555550100",
                    "country_code": "1",
                    "phone_number": "5555550100",
                }
            },
            "phone_type": {"code": "2", "description": "MOBILE"},
            "carrier": {"name": "T-Mobile"},
            "risk": {"level": "low", "recommendation": "allow", "score": 120},
            "risk_insights": {
                "status": 200,
                "category": ["safe"],
            },
        }
        parsed = IntelligenceResponse(**data)
        assert parsed.reference_id == "ref-123"
        assert parsed.risk.score == 120
        assert parsed.risk.recommendation == "allow"
        assert parsed.carrier.name == "T-Mobile"
        assert parsed.phone_type.description == "MOBILE"

    def test_intelligence_response_minimal(self) -> None:
        data = {
            "reference_id": "ref-456",
            "status": {"code": 300, "description": "OK"},
        }
        parsed = IntelligenceResponse(**data)
        assert parsed.risk is None
        assert parsed.carrier is None

    def test_phoneid_response(self) -> None:
        data = {
            "reference_id": "ref-789",
            "status": {"code": 300, "description": "OK"},
            "phone_type": {"code": "5", "description": "VOIP"},
            "location": {
                "city": "Los Angeles",
                "state": "CA",
                "country": {"name": "United States", "iso2": "US", "iso3": "USA"},
            },
        }
        parsed = PhoneIdResponse(**data)
        assert parsed.phone_type.description == "VOIP"
        assert parsed.location.city == "Los Angeles"
        assert parsed.location.country.iso2 == "US"

    def test_verify_response(self) -> None:
        data = {
            "reference_id": "ref-verify-001",
            "sub_resource": "sms",
            "errors": [],
            "status": {"code": 290, "description": "Message in progress"},
            "verify": {"code_state": "UNKNOWN", "code_entered": ""},
        }
        parsed = VerifyResponse(**data)
        assert parsed.sub_resource == "sms"
        assert parsed.status.code == 290
        assert parsed.verify.code_state == "UNKNOWN"

    def test_email_intelligence_response(self) -> None:
        data = {
            "email_address": "user@example.com",
            "risk": {"level": "medium", "score": 450},
            "reference_id": "ref-email-001",
            "status": {"code": 300, "description": "OK"},
        }
        parsed = EmailIntelligenceResponse(**data)
        assert parsed.email_address == "user@example.com"
        assert parsed.risk.score == 450


# ---------------------------------------------------------------------------
# Tool output envelopes
# ---------------------------------------------------------------------------


class TestToolEnvelopes:
    """Test ToolSuccess and ToolError wrappers."""

    def test_success_envelope(self) -> None:
        result = ToolSuccess(
            tool="test_tool",
            data={"key": "value"},
        )
        dumped = result.model_dump()
        assert dumped["success"] is True
        assert dumped["tool"] == "test_tool"
        assert dumped["data"]["key"] == "value"

    def test_error_envelope(self) -> None:
        result = ToolError(
            tool="test_tool",
            error_type="validation_error",
            error_message="Bad input",
        )
        dumped = result.model_dump()
        assert dumped["success"] is False
        assert dumped["error_type"] == "validation_error"
        assert dumped["retry_after_seconds"] is None

    def test_error_with_retry(self) -> None:
        result = ToolError(
            tool="test_tool",
            error_type="rate_limit_error",
            error_message="Too many requests",
            retry_after_seconds=30.0,
        )
        dumped = result.model_dump()
        assert dumped["retry_after_seconds"] == 30.0
