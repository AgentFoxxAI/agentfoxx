"""Pydantic models for Telesign API request/response schemas.

Strict validation models for all tool inputs and outputs.
No raw dicts — everything typed.

Covers:
    - Score/Intelligence API responses
    - PhoneID API responses
    - Verify API responses
    - Email Intelligence responses
    - Shared sub-models (status, numbering, carrier, risk, location)
"""

from __future__ import annotations

import re
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class RiskLevel(str, Enum):
    """Telesign risk assessment level."""

    LOW = "low"
    MEDIUM_LOW = "medium-low"
    MEDIUM = "medium"
    MEDIUM_HIGH = "medium-high"
    HIGH = "high"


class RiskRecommendation(str, Enum):
    """Telesign risk recommendation action."""

    ALLOW = "allow"
    FLAG = "flag"
    BLOCK = "block"


class AccountLifecycleEvent(str, Enum):
    """Supported account lifecycle events for Intelligence API."""

    CREATE = "create"
    SIGN_IN = "sign-in"
    TRANSACT = "transact"
    UPDATE = "update"
    DELETE = "delete"


class VerifyCodeState(str, Enum):
    """State of the OTP verification code."""

    UNKNOWN = "UNKNOWN"
    VALID = "VALID"
    INVALID = "INVALID"
    EXPIRED = "EXPIRED"


class PhoneType(str, Enum):
    """Telesign phone type classifications."""

    FIXED_LINE = "1"
    MOBILE = "2"
    PREPAID = "3"
    TOLL_FREE = "4"
    VOIP = "5"
    PAGER = "6"
    PAYPHONE = "7"
    INVALID = "8"
    RESTRICTED = "9"
    PERSONAL = "10"
    OTHER = "0"


# ---------------------------------------------------------------------------
# Input validation models
# ---------------------------------------------------------------------------


class PhoneNumberInput(BaseModel):
    """Validated E.164 phone number input."""

    phone_number: str = Field(
        ...,
        description="Phone number in E.164 format (e.g., +15555550100)",
        min_length=8,
        max_length=16,
    )

    @field_validator("phone_number")
    @classmethod
    def validate_e164(cls, v: str) -> str:
        """Ensure phone number is in E.164 format."""
        if not re.match(r"^\+[1-9]\d{6,14}$", v):
            raise ValueError(f"Phone number must be in E.164 format (e.g., +15555550100), got: {v}")
        return v


class IntelligenceInput(PhoneNumberInput):
    """Input model for Intelligence/Score API."""

    account_lifecycle_event: AccountLifecycleEvent = Field(
        ...,
        description=(
            "The lifecycle event triggering this check: "
            "create, sign-in, transact, update, or delete"
        ),
    )
    originating_ip: str | None = Field(
        default=None,
        description="IP address of the end-user for IP-based risk enrichment",
    )
    email_address: str | None = Field(
        default=None,
        description="Email address for email-based risk enrichment",
    )

    @field_validator("originating_ip")
    @classmethod
    def validate_ip(cls, v: str | None) -> str | None:
        """Basic IP address format validation."""
        if v is None:
            return v
        # Accept IPv4 or IPv6
        import ipaddress

        try:
            ipaddress.ip_address(v)
        except ValueError as err:
            raise ValueError(f"Invalid IP address: {v}") from err
        return v


class PhoneIdInput(PhoneNumberInput):
    """Input model for PhoneID API."""

    addons: list[str] | None = Field(
        default=None,
        description=(
            "Optional PhoneID add-ons to include: contact, number_deactivation, subscriber_status"
        ),
    )


class VerifyInput(PhoneNumberInput):
    """Input model for Verify SMS API."""

    verify_code: str | None = Field(
        default=None,
        description="Custom OTP code. If omitted, Telesign generates one.",
        min_length=4,
        max_length=10,
    )
    template: str | None = Field(
        default=None,
        description=(
            "Custom SMS template. Use $$CODE$$ as placeholder for the OTP. "
            "Example: 'Your code is $$CODE$$. It expires in 5 minutes.'"
        ),
    )
    originating_ip: str | None = Field(
        default=None,
        description="End-user IP for risk-aware verification routing",
    )


class VerifyStatusInput(BaseModel):
    """Input for checking verify transaction status."""

    reference_id: str = Field(
        ...,
        description="Transaction reference ID from the initial verify request",
        min_length=1,
    )
    verify_code: str | None = Field(
        default=None,
        description="OTP code entered by the user to validate",
    )


class EmailInput(BaseModel):
    """Input model for Email Intelligence."""

    email_address: str = Field(
        ...,
        description="Email address to evaluate",
    )

    @field_validator("email_address")
    @classmethod
    def validate_email(cls, v: str) -> str:
        """Basic email format validation."""
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError(f"Invalid email address format: {v}")
        return v


# ---------------------------------------------------------------------------
# Shared response sub-models
# ---------------------------------------------------------------------------


class StatusInfo(BaseModel):
    """Telesign API response status block."""

    code: int = Field(description="Telesign status code (e.g., 300 = success)")
    description: str = Field(description="Human-readable status description")
    updated_on: str | None = Field(default=None, description="ISO timestamp of status update")


class NumberingOriginal(BaseModel):
    """Original phone number as submitted."""

    complete_phone_number: str | None = None
    country_code: str | None = None
    phone_number: str | None = None


class CleansingInfo(BaseModel):
    """Cleansed phone number for a specific channel."""

    country_code: str | None = None
    phone_number: str | None = None
    cleansed_code: int | None = None
    min_length: int | None = None
    max_length: int | None = None


class NumberingCleansing(BaseModel):
    """Cleansed phone numbers for call and SMS delivery."""

    call: CleansingInfo | None = None
    sms: CleansingInfo | None = None


class NumberingInfo(BaseModel):
    """Full numbering block from Telesign response."""

    original: NumberingOriginal | None = None
    cleansing: NumberingCleansing | None = None


class PhoneTypeInfo(BaseModel):
    """Phone type classification."""

    code: str | None = Field(default=None, description="Phone type code")
    description: str | None = Field(
        default=None,
        description="Phone type description (e.g., MOBILE, VOIP, FIXED_LINE)",
    )


class CountryInfo(BaseModel):
    """Country information block."""

    name: str | None = None
    iso2: str | None = None
    iso3: str | None = None


class LocationInfo(BaseModel):
    """Geographic location associated with the phone number."""

    city: str | None = None
    state: str | None = None
    zip: str | None = None
    metro_code: str | None = None
    county: str | None = None
    country: CountryInfo | None = None
    coordinates: dict[str, Any] | None = None
    time_zone: dict[str, Any] | None = None


class CarrierInfo(BaseModel):
    """Telecom carrier information."""

    name: str | None = Field(default=None, description="Carrier name")


class RiskInfo(BaseModel):
    """Risk assessment block from Telesign response."""

    level: str | None = Field(
        default=None, description="Risk level: low, medium-low, medium, medium-high, high"
    )
    recommendation: str | None = Field(
        default=None, description="Action recommendation: allow, flag, or block"
    )
    score: int | None = Field(default=None, description="Risk score 0-1000 (higher = riskier)")


class RiskInsights(BaseModel):
    """Enriched risk insights from Intelligence API."""

    status: int | None = None
    category: list[str] | None = None
    a2p: list[str] | None = None
    p2p: list[str] | None = None
    number_type: list[str] | None = None
    ip: list[str] | None = None
    email: list[str] | None = None


class VerifyInfo(BaseModel):
    """Verify transaction details."""

    code_state: str | None = Field(
        default=None, description="OTP code state: UNKNOWN, VALID, INVALID, EXPIRED"
    )
    code_entered: str | None = Field(
        default=None, description="Code entered by end-user (if checked)"
    )


# ---------------------------------------------------------------------------
# Full response models
# ---------------------------------------------------------------------------


class IntelligenceResponse(BaseModel):
    """Complete response from the Intelligence/Score API.

    POST /v1/score/{phone_number} or POST /intelligence/phone
    """

    reference_id: str = Field(description="Unique transaction identifier")
    status: StatusInfo
    numbering: NumberingInfo | None = None
    phone_type: PhoneTypeInfo | None = None
    location: LocationInfo | None = None
    carrier: CarrierInfo | None = None
    risk: RiskInfo | None = None
    risk_insights: RiskInsights | None = None
    blocklisting: dict[str, Any] | None = None
    # Raw data pass-through for fields we haven't modeled yet
    external_id: str | None = None


class PhoneIdResponse(BaseModel):
    """Complete response from the PhoneID API.

    POST /v1/phoneid/{phone_number}
    """

    reference_id: str = Field(description="Unique transaction identifier")
    status: StatusInfo
    numbering: NumberingInfo | None = None
    phone_type: PhoneTypeInfo | None = None
    location: LocationInfo | None = None
    carrier: CarrierInfo | None = None
    risk: RiskInfo | None = None
    blocklisting: dict[str, Any] | None = None
    # Add-on enrichment fields
    contact: dict[str, Any] | None = None
    number_deactivation: dict[str, Any] | None = None
    subscriber_status: dict[str, Any] | None = None
    live_status: dict[str, Any] | None = None
    external_id: str | None = None


class VerifyResponse(BaseModel):
    """Complete response from the Verify SMS API.

    POST /v1/verify/sms
    """

    reference_id: str = Field(description="Transaction ID for status polling")
    sub_resource: str | None = Field(
        default=None, description="Verify sub-resource type (sms, voice, etc.)"
    )
    errors: list[dict[str, Any]] | None = Field(default=None, description="API errors, if any")
    status: StatusInfo
    verify: VerifyInfo | None = None
    external_id: str | None = None


class EmailIntelligenceResponse(BaseModel):
    """Response from Email Intelligence evaluation.

    This is a composite result combining Telesign email risk
    signals with structured assessment.
    """

    email_address: str = Field(description="The evaluated email address")
    risk: RiskInfo | None = None
    risk_insights: RiskInsights | None = None
    reference_id: str | None = Field(default=None, description="Transaction identifier")
    status: StatusInfo | None = None


# ---------------------------------------------------------------------------
# MCP tool output wrappers
# ---------------------------------------------------------------------------


class ToolSuccess(BaseModel):
    """Standard success wrapper for MCP tool output."""

    success: bool = True
    tool: str = Field(description="Tool name that produced this result")
    data: dict[str, Any] = Field(description="Tool-specific response data")


class ToolError(BaseModel):
    """Standard error wrapper for MCP tool output."""

    success: bool = False
    tool: str = Field(description="Tool name that encountered the error")
    error_type: str = Field(description="Error classification")
    error_message: str = Field(description="Human-readable error description")
    retry_after_seconds: float | None = Field(
        default=None, description="Seconds to wait before retrying (for rate limits)"
    )
