"""Telesign Email Intelligence tool — Email validation and risk assessment.

Exposes the Telesign Intelligence API's email enrichment capability
as a standalone MCP tool. When used with a phone number + email
combination, provides cross-referenced fraud signals.

Primary endpoint: POST /v1/score/{phone_number} with email_address param
Standalone mode: Validates email format and provides risk context
"""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from telesign_mcp.client import TelesignClient
from telesign_mcp.exceptions import TelesignError
from telesign_mcp.logging import get_logger
from telesign_mcp.models.schemas import (
    EmailInput,
    EmailIntelligenceResponse,
    IntelligenceResponse,
)
from telesign_mcp.sanitize import mask_email
from telesign_mcp.tools._helpers import format_error, format_success

logger = get_logger(__name__)

TOOL_NAME = "email_intelligence"


async def email_intelligence(
    client: TelesignClient,
    email_address: str,
    phone_number: str | None = None,
    originating_ip: str | None = None,
) -> dict[str, Any]:
    """Evaluate email address risk with optional phone cross-reference.

    Queries Telesign's Intelligence API with an email address to
    assess risk signals. When a phone number is also provided,
    the API cross-references both signals for a more comprehensive
    fraud assessment.

    Use this to:
    - Validate email addresses during account registration
    - Detect disposable/temporary email addresses
    - Cross-reference phone + email for multi-factor risk assessment
    - Check email-based risk before transactional operations

    Args:
        client: Initialized TelesignClient instance.
        email_address: Email address to evaluate.
        phone_number: Optional E.164 phone number for cross-referencing.
            When provided, enables phone+email correlation risk signals.
        originating_ip: Optional end-user IP for enrichment.

    Returns:
        Structured dict with email risk assessment, and if phone_number
        was provided, the full Intelligence API response with both
        phone and email risk signals.
    """
    # ── Validate inputs ─────────────────────────────────────────────
    try:
        validated_email = EmailInput(email_address=email_address)
    except ValidationError as exc:
        return format_error(TOOL_NAME, TelesignError(str(exc)))

    logger.info(
        "email_intelligence_request",
        email=mask_email(validated_email.email_address),
        has_phone=phone_number is not None,
    )

    # ── Build request ───────────────────────────────────────────────
    # Telesign's email intelligence works through the Score/Intelligence
    # API with email_address as an enrichment parameter.
    # If no phone number is provided, we use a minimal score request
    # with the email as the primary signal.

    if phone_number:
        # Full cross-referenced intelligence request
        from telesign_mcp.models.schemas import PhoneNumberInput

        try:
            validated_phone = PhoneNumberInput(phone_number=phone_number)
        except ValidationError as exc:
            return format_error(TOOL_NAME, TelesignError(str(exc)))

        resource = f"/v1/score/{validated_phone.phone_number}"
        body_params: dict[str, str] = {
            "phone_number": validated_phone.phone_number,
            "account_lifecycle_event": "create",
            "email_address": validated_email.email_address,
        }
        if originating_ip:
            body_params["originating_ip"] = originating_ip

        try:
            raw_response = await client.post(resource, body_params=body_params)
        except TelesignError as exc:
            return format_error(TOOL_NAME, exc)

        # Parse full intelligence response
        try:
            parsed = IntelligenceResponse(**raw_response)
            result = parsed.model_dump(exclude_none=True)
            # Add the email to the output for clarity
            result["queried_email"] = validated_email.email_address
        except ValidationError:
            logger.warning(
                "email_intelligence_parse_warning",
                msg="Response did not match expected schema, returning raw",
            )
            result = raw_response
            result["queried_email"] = validated_email.email_address

    else:
        # Email-only mode: build a minimal intelligence request
        # Use the Intelligence Cloud endpoint which accepts email directly
        resource = "/v1/score/email"
        body_params = {
            "email_address": validated_email.email_address,
            "account_lifecycle_event": "create",
        }
        if originating_ip:
            body_params["originating_ip"] = originating_ip

        try:
            raw_response = await client.post(resource, body_params=body_params)
        except TelesignError as exc:
            return format_error(TOOL_NAME, exc)

        # Parse email-specific response
        try:
            parsed_email = EmailIntelligenceResponse(
                email_address=validated_email.email_address,
                **raw_response,
            )
            result = parsed_email.model_dump(exclude_none=True)
        except ValidationError:
            logger.warning(
                "email_intelligence_parse_warning",
                msg="Response did not match expected schema, returning raw",
            )
            result = raw_response
            result["queried_email"] = validated_email.email_address

    logger.info(
        "email_intelligence_complete",
        email=mask_email(validated_email.email_address),
    )

    return format_success(TOOL_NAME, result)
