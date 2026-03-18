"""Telesign Intelligence API tool — Phone reputation scoring.

Exposes the Telesign Score / Intelligence Cloud API as an MCP tool.
Provides real-time risk scoring with optional IP and email enrichment.

Endpoint: POST /v1/score/{phone_number}
   or:    POST /intelligence/phone  (Intelligence Cloud)
"""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from telesign_mcp.client import TelesignClient
from telesign_mcp.exceptions import TelesignError
from telesign_mcp.logging import get_logger
from telesign_mcp.models.schemas import (
    IntelligenceInput,
    IntelligenceResponse,
)
from telesign_mcp.sanitize import mask_phone
from telesign_mcp.tools._helpers import format_error, format_success

logger = get_logger(__name__)

TOOL_NAME = "intelligence_score"


async def intelligence_score(
    client: TelesignClient,
    phone_number: str,
    account_lifecycle_event: str,
    originating_ip: str | None = None,
    email_address: str | None = None,
) -> dict[str, Any]:
    """Get a real-time fraud risk score for a phone number.

    Queries the Telesign Score API to assess the risk of a phone number
    in the context of a specific account lifecycle event (e.g., account
    creation, sign-in, transaction).

    Higher scores (0–1000) indicate higher risk. The response includes
    a risk level, recommendation (allow/flag/block), carrier info,
    phone type, and location data.

    Args:
        client: Initialized TelesignClient instance.
        phone_number: Phone number in E.164 format (e.g., +15555550100).
        account_lifecycle_event: The event type — one of:
            create, sign-in, transact, update, delete.
        originating_ip: Optional end-user IP address for IP risk enrichment.
        email_address: Optional email for email-based risk enrichment.

    Returns:
        Structured dict with success/error envelope containing risk
        score, level, recommendation, carrier, phone type, and location.
    """
    # ── Validate inputs ─────────────────────────────────────────────
    try:
        validated = IntelligenceInput(
            phone_number=phone_number,
            account_lifecycle_event=account_lifecycle_event,
            originating_ip=originating_ip,
            email_address=email_address,
        )
    except ValidationError as exc:
        return format_error(TOOL_NAME, TelesignError(str(exc)))

    logger.info(
        "intelligence_score_request",
        phone=mask_phone(validated.phone_number),
        lifecycle_event=validated.account_lifecycle_event.value,
    )

    # ── Build request params ────────────────────────────────────────
    # Score API: POST /v1/score/{phone_number}
    resource = f"/v1/score/{validated.phone_number}"
    body_params: dict[str, str] = {
        "phone_number": validated.phone_number,
        "account_lifecycle_event": validated.account_lifecycle_event.value,
    }
    if validated.originating_ip:
        body_params["originating_ip"] = validated.originating_ip
    if validated.email_address:
        body_params["email_address"] = validated.email_address

    # ── Execute API call ────────────────────────────────────────────
    try:
        raw_response = await client.post(resource, body_params=body_params)
    except TelesignError as exc:
        return format_error(TOOL_NAME, exc)

    # ── Parse and structure response ────────────────────────────────
    try:
        parsed = IntelligenceResponse(**raw_response)
    except ValidationError:
        # If response doesn't match our model, return raw but wrapped
        logger.warning(
            "intelligence_score_parse_warning",
            msg="Response did not match expected schema, returning raw",
        )
        return format_success(TOOL_NAME, raw_response)

    logger.info(
        "intelligence_score_complete",
        phone=mask_phone(validated.phone_number),
        risk_score=parsed.risk.score if parsed.risk else None,
        risk_level=parsed.risk.level if parsed.risk else None,
    )

    return format_success(TOOL_NAME, parsed.model_dump(exclude_none=True))
