"""Telesign Phone ID Suite tool — Deep identity verification.

Exposes the Telesign PhoneID API as an MCP tool. Returns carrier,
phone type, location, and optional enrichment add-ons (contact,
number deactivation, subscriber status).

Endpoint: POST /v1/phoneid/{phone_number}
"""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from telesign_mcp.client import TelesignClient
from telesign_mcp.exceptions import TelesignError
from telesign_mcp.logging import get_logger
from telesign_mcp.models.schemas import PhoneIdInput, PhoneIdResponse
from telesign_mcp.sanitize import mask_phone
from telesign_mcp.tools._helpers import format_error, format_success

logger = get_logger(__name__)

TOOL_NAME = "phone_identity_deep_check"

# Valid PhoneID add-on names
VALID_ADDONS = frozenset(
    {
        "contact",
        "number_deactivation",
        "subscriber_status",
    }
)


async def phone_identity_deep_check(
    client: TelesignClient,
    phone_number: str,
    addons: list[str] | None = None,
) -> dict[str, Any]:
    """Get detailed phone number identity and carrier intelligence.

    Queries the Telesign PhoneID API for comprehensive phone number
    intelligence including carrier, phone type (mobile/VOIP/landline),
    geographic location, and optional enrichment add-ons.

    Use this to:
    - Identify VOIP numbers (common in fraud)
    - Verify carrier before sending SMS
    - Check number deactivation status
    - Get subscriber identity confirmation

    Args:
        client: Initialized TelesignClient instance.
        phone_number: Phone number in E.164 format (e.g., +15555550100).
        addons: Optional list of enrichment add-ons to include:
            - "contact": Contact information attributes
            - "number_deactivation": Whether the number has been deactivated
            - "subscriber_status": Current subscriber status

    Returns:
        Structured dict with phone type, carrier, location, risk data,
        and any requested add-on enrichment.
    """
    # ── Validate inputs ─────────────────────────────────────────────
    try:
        validated = PhoneIdInput(
            phone_number=phone_number,
            addons=addons,
        )
    except ValidationError as exc:
        return format_error(TOOL_NAME, TelesignError(str(exc)))

    # Validate addon names
    if validated.addons:
        invalid = set(validated.addons) - VALID_ADDONS
        if invalid:
            return format_error(
                TOOL_NAME,
                TelesignError(f"Invalid addons: {invalid}. Valid options: {sorted(VALID_ADDONS)}"),
            )

    logger.info(
        "phone_identity_request",
        phone=mask_phone(validated.phone_number),
        addons=validated.addons,
    )

    # ── Build request ───────────────────────────────────────────────
    resource = f"/v1/phoneid/{validated.phone_number}"
    body_params: dict[str, Any] = {
        "phone_number": validated.phone_number,
    }

    # Add-ons are sent as a JSON-encoded addons parameter
    if validated.addons:
        import json

        addon_dict = {addon: {} for addon in validated.addons}
        body_params["addons"] = json.dumps(addon_dict)

    # ── Execute API call ────────────────────────────────────────────
    try:
        raw_response = await client.post(resource, body_params=body_params)
    except TelesignError as exc:
        return format_error(TOOL_NAME, exc)

    # ── Parse and structure response ────────────────────────────────
    try:
        parsed = PhoneIdResponse(**raw_response)
    except ValidationError:
        logger.warning(
            "phone_identity_parse_warning",
            msg="Response did not match expected schema, returning raw",
        )
        return format_success(TOOL_NAME, raw_response)

    logger.info(
        "phone_identity_complete",
        phone=mask_phone(validated.phone_number),
        phone_type=parsed.phone_type.description if parsed.phone_type else None,
        carrier=parsed.carrier.name if parsed.carrier else None,
    )

    return format_success(TOOL_NAME, parsed.model_dump(exclude_none=True))
