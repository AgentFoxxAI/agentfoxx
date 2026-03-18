"""MCP server entry point with lifespan management.

Implements FastMCP server with structured logging, health checks,
TelesignClient lifecycle, metrics tracking, rate limiting, and
all tool registrations.
"""

from __future__ import annotations

import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any

from fastmcp import Context, FastMCP

from telesign_mcp.client import TelesignClient
from telesign_mcp.config import (
    ServerSettings,
    TelesignSettings,
    load_server_settings,
    load_telesign_settings,
)
from telesign_mcp.logging import get_logger, setup_logging
from telesign_mcp.metrics import ServerMetrics
from telesign_mcp.ratelimit import RateLimitExceeded, SlidingWindowRateLimiter

logger = get_logger(__name__)


@dataclass
class AppState:
    """Application state available during server lifespan.

    Holds validated configuration and shared resources that are
    initialized at startup and cleaned up at shutdown.
    """

    server_settings: ServerSettings
    telesign_settings: TelesignSettings
    telesign_client: TelesignClient
    metrics: ServerMetrics
    rate_limiter: SlidingWindowRateLimiter


def _instrument_tool(state: AppState, tool_name: str) -> None:
    """Apply rate limiting and record metrics preamble for a tool call.

    Raises:
        RateLimitExceeded: If the rate limit is exceeded.
    """
    try:
        state.rate_limiter.acquire()
    except RateLimitExceeded:
        state.metrics.record_rate_limit_rejection()
        raise


@asynccontextmanager
async def server_lifespan(server: FastMCP) -> AsyncIterator[AppState]:
    """Manage server startup and shutdown lifecycle.

    On startup:
        - Load and validate all configuration
        - Configure structured logging
        - Initialize TelesignClient with connection pool
        - Initialize metrics and rate limiter

    On shutdown:
        - Close HTTP connections
        - Flush logs

    Yields:
        AppState: Validated configuration and initialized resources.
    """
    # Load configuration (fails fast on invalid/missing values)
    server_settings = load_server_settings()
    telesign_settings = load_telesign_settings()

    # Configure structured logging
    setup_logging(
        level=server_settings.log_level,
        fmt=server_settings.log_format,
        server_name=server_settings.server_name,
    )

    logger.info(
        "server_starting",
        version=server_settings.server_version,
        transport=server_settings.transport.value,
    )

    # Initialize TelesignClient
    client = TelesignClient(telesign_settings)
    await client.__aenter__()

    # Initialize metrics and rate limiter
    metrics = ServerMetrics()
    rate_limiter = SlidingWindowRateLimiter(
        max_requests=server_settings.rate_limit_per_minute,
        window_seconds=60.0,
    )

    state = AppState(
        server_settings=server_settings,
        telesign_settings=telesign_settings,
        telesign_client=client,
        metrics=metrics,
        rate_limiter=rate_limiter,
    )

    try:
        logger.info("server_ready", tools_registered=8)
        yield state
    finally:
        await client.__aexit__(None, None, None)
        logger.info(
            "server_shutting_down",
            final_metrics=metrics.snapshot(),
        )


def create_server() -> FastMCP:
    """Factory function to create and configure the MCP server instance.

    Returns:
        Configured FastMCP server with lifespan management, tools,
        and structured logging ready for transport binding.
    """
    mcp = FastMCP(
        name="telesign-mcp-server",
        instructions=(
            "Telesign Fraud Intelligence MCP Server. "
            "Provides intent-driven fraud detection tools including "
            "Intelligence Score, Phone ID Suite, Adaptive Verify, "
            "and Email Intelligence. Use the fraud_intent_analysis tool "
            "to determine the optimal tool combination for your scenario."
        ),
        lifespan=server_lifespan,
    )

    # ── Health Check ────────────────────────────────────────────────

    @mcp.tool()
    async def health_check(ctx: Context) -> dict[str, Any]:
        """Check server health, metrics, and operational status.

        Returns server status, version, rate limit usage,
        circuit breaker state, and performance metrics.
        Use this to verify the server is operational before making
        fraud detection requests.
        """
        state: AppState = ctx.request_context.lifespan_context
        return {
            "status": "healthy",
            "server": "telesign-mcp-server",
            "version": state.server_settings.server_version,
            "transport": state.server_settings.transport.value,
            "tools": [
                "health_check",
                "intelligence_score",
                "phone_identity_deep_check",
                "adaptive_verify_send",
                "adaptive_verify_status",
                "email_intelligence",
                "fraud_intent_analysis",
                "fraud_intent_plan",
            ],
            "rate_limit": state.rate_limiter.status(),
            "metrics": state.metrics.snapshot(),
        }

    # ── Intelligence Score ──────────────────────────────────────────

    @mcp.tool()
    async def intelligence_score(
        ctx: Context,
        phone_number: str,
        account_lifecycle_event: str,
        originating_ip: str | None = None,
        email_address: str | None = None,
    ) -> dict[str, Any]:
        """Get a real-time fraud risk score for a phone number.

        Queries the Telesign Score API to assess the risk of a phone
        number in the context of a specific account lifecycle event.

        Higher scores (0-1000) indicate higher risk. Returns risk level,
        recommendation (allow/flag/block), carrier info, phone type,
        and location data.

        Args:
            phone_number: Phone number in E.164 format (e.g., +15555550100).
            account_lifecycle_event: Event type — one of:
                create, sign-in, transact, update, delete.
            originating_ip: Optional end-user IP for IP risk enrichment.
            email_address: Optional email for email-based risk enrichment.
        """
        from telesign_mcp.tools.intelligence import (
            intelligence_score as _intelligence_score,
        )

        state: AppState = ctx.request_context.lifespan_context
        _instrument_tool(state, "intelligence_score")

        start = time.monotonic()
        try:
            result = await _intelligence_score(
                client=state.telesign_client,
                phone_number=phone_number,
                account_lifecycle_event=account_lifecycle_event,
                originating_ip=originating_ip,
                email_address=email_address,
            )
            elapsed = (time.monotonic() - start) * 1000
            success = result.get("success", False)
            state.metrics.record_tool_call("intelligence_score", elapsed, success=success)
            return result
        except Exception as exc:
            elapsed = (time.monotonic() - start) * 1000
            state.metrics.record_tool_call("intelligence_score", elapsed, success=False)
            state.metrics.record_error(type(exc).__name__)
            raise

    # ── Phone ID Deep Check ─────────────────────────────────────────

    @mcp.tool()
    async def phone_identity_deep_check(
        ctx: Context,
        phone_number: str,
        addons: list[str] | None = None,
    ) -> dict[str, Any]:
        """Get detailed phone number identity and carrier intelligence.

        Queries the Telesign PhoneID API for comprehensive phone number
        intelligence including carrier, phone type (mobile/VOIP/landline),
        geographic location, and optional enrichment add-ons.

        Use this to identify VOIP numbers, verify carrier before sending
        SMS, check number deactivation status, or confirm subscriber identity.

        Args:
            phone_number: Phone number in E.164 format (e.g., +15555550100).
            addons: Optional enrichment add-ons:
                - "contact": Contact information
                - "number_deactivation": Deactivation status
                - "subscriber_status": Current subscriber status
        """
        from telesign_mcp.tools.phone_identity import (
            phone_identity_deep_check as _phone_identity_deep_check,
        )

        state: AppState = ctx.request_context.lifespan_context
        _instrument_tool(state, "phone_identity_deep_check")

        start = time.monotonic()
        try:
            result = await _phone_identity_deep_check(
                client=state.telesign_client,
                phone_number=phone_number,
                addons=addons,
            )
            elapsed = (time.monotonic() - start) * 1000
            success = result.get("success", False)
            state.metrics.record_tool_call("phone_identity_deep_check", elapsed, success=success)
            return result
        except Exception as exc:
            elapsed = (time.monotonic() - start) * 1000
            state.metrics.record_tool_call("phone_identity_deep_check", elapsed, success=False)
            state.metrics.record_error(type(exc).__name__)
            raise

    # ── Adaptive Verify — Send OTP ──────────────────────────────────

    @mcp.tool()
    async def adaptive_verify_send(
        ctx: Context,
        phone_number: str,
        verify_code: str | None = None,
        template: str | None = None,
        originating_ip: str | None = None,
    ) -> dict[str, Any]:
        """Send an OTP verification code via SMS to a phone number.

        Initiates Telesign SMS verification by sending a one-time
        passcode. The OTP can be auto-generated or custom.

        After calling this, use adaptive_verify_status with the
        returned reference_id to check code validation.

        Args:
            phone_number: Recipient phone in E.164 format.
            verify_code: Optional custom OTP (4-10 chars).
            template: Optional SMS template (use $$CODE$$ for OTP).
            originating_ip: Optional end-user IP for risk-aware routing.
        """
        from telesign_mcp.tools.verify import (
            adaptive_verify_send as _adaptive_verify_send,
        )

        state: AppState = ctx.request_context.lifespan_context
        _instrument_tool(state, "adaptive_verify_send")

        start = time.monotonic()
        try:
            result = await _adaptive_verify_send(
                client=state.telesign_client,
                phone_number=phone_number,
                verify_code=verify_code,
                template=template,
                originating_ip=originating_ip,
            )
            elapsed = (time.monotonic() - start) * 1000
            success = result.get("success", False)
            state.metrics.record_tool_call("adaptive_verify_send", elapsed, success=success)
            return result
        except Exception as exc:
            elapsed = (time.monotonic() - start) * 1000
            state.metrics.record_tool_call("adaptive_verify_send", elapsed, success=False)
            state.metrics.record_error(type(exc).__name__)
            raise

    # ── Adaptive Verify — Check Status ──────────────────────────────

    @mcp.tool()
    async def adaptive_verify_status(
        ctx: Context,
        reference_id: str,
        verify_code: str | None = None,
    ) -> dict[str, Any]:
        """Check the status of a verification transaction.

        Polls Telesign Verify API to check OTP delivery and validation.
        If verify_code is provided, Telesign validates it and returns
        VALID/INVALID/EXPIRED state.

        Args:
            reference_id: Transaction ID from adaptive_verify_send.
            verify_code: Optional OTP entered by the user to validate.
        """
        from telesign_mcp.tools.verify import (
            adaptive_verify_status as _adaptive_verify_status,
        )

        state: AppState = ctx.request_context.lifespan_context
        _instrument_tool(state, "adaptive_verify_status")

        start = time.monotonic()
        try:
            result = await _adaptive_verify_status(
                client=state.telesign_client,
                reference_id=reference_id,
                verify_code=verify_code,
            )
            elapsed = (time.monotonic() - start) * 1000
            success = result.get("success", False)
            state.metrics.record_tool_call("adaptive_verify_status", elapsed, success=success)
            return result
        except Exception as exc:
            elapsed = (time.monotonic() - start) * 1000
            state.metrics.record_tool_call("adaptive_verify_status", elapsed, success=False)
            state.metrics.record_error(type(exc).__name__)
            raise

    # ── Email Intelligence ──────────────────────────────────────────

    @mcp.tool()
    async def email_intelligence(
        ctx: Context,
        email_address: str,
        phone_number: str | None = None,
        originating_ip: str | None = None,
    ) -> dict[str, Any]:
        """Evaluate email address risk with optional phone cross-reference.

        Queries Telesign Intelligence API with an email to assess risk.
        When a phone number is also provided, cross-references both
        signals for comprehensive fraud assessment.

        Use this to validate emails during registration, detect
        disposable addresses, or cross-reference phone+email risk.

        Args:
            email_address: Email address to evaluate.
            phone_number: Optional E.164 phone for cross-referencing.
            originating_ip: Optional end-user IP for enrichment.
        """
        from telesign_mcp.tools.email import (
            email_intelligence as _email_intelligence,
        )

        state: AppState = ctx.request_context.lifespan_context
        _instrument_tool(state, "email_intelligence")

        start = time.monotonic()
        try:
            result = await _email_intelligence(
                client=state.telesign_client,
                email_address=email_address,
                phone_number=phone_number,
                originating_ip=originating_ip,
            )
            elapsed = (time.monotonic() - start) * 1000
            success = result.get("success", False)
            state.metrics.record_tool_call("email_intelligence", elapsed, success=success)
            return result
        except Exception as exc:
            elapsed = (time.monotonic() - start) * 1000
            state.metrics.record_tool_call("email_intelligence", elapsed, success=False)
            state.metrics.record_error(type(exc).__name__)
            raise

    # ── Fraud Intent Analysis (Meta-Tool) ──────────────────────────

    @mcp.tool()
    async def fraud_intent_analysis(
        ctx: Context,
        scenario: str,
        phone_number: str | None = None,
        email_address: str | None = None,
        originating_ip: str | None = None,
        account_lifecycle_event: str | None = None,
    ) -> dict[str, Any]:
        """Analyze a fraud scenario and execute the optimal tool combination.

        This is the primary entry point for fraud detection. Describe your
        scenario in natural language and provide any available signals
        (phone, email, IP). The orchestrator will:

        1. Classify the fraud intent (account creation, ATO, transaction, etc.)
        2. Select the best combination of Telesign tools
        3. Execute them (in parallel where possible)
        4. Aggregate risk signals into a unified assessment
        5. Return a recommended action (allow/flag/challenge/block)

        Use this tool when you're unsure which specific tool to call,
        or when you want a comprehensive multi-signal analysis.

        Args:
            scenario: Natural language description of the fraud scenario,
                e.g., "New user creating account with VOIP number from Nigeria".
            phone_number: Optional E.164 phone number to analyze.
            email_address: Optional email to evaluate.
            originating_ip: Optional end-user IP address.
            account_lifecycle_event: Optional lifecycle event
                (create, sign-in, transact, update, delete).
        """
        from telesign_mcp.models.intent import FraudScenario
        from telesign_mcp.orchestrator import FraudOrchestrator

        state: AppState = ctx.request_context.lifespan_context
        _instrument_tool(state, "fraud_intent_analysis")

        start = time.monotonic()
        try:
            fraud_scenario = FraudScenario(
                scenario=scenario,
                phone_number=phone_number,
                email_address=email_address,
                originating_ip=originating_ip,
                account_lifecycle_event=account_lifecycle_event,
            )

            orchestrator = FraudOrchestrator(state.telesign_client)
            result = await orchestrator.analyze(fraud_scenario)

            elapsed = (time.monotonic() - start) * 1000
            state.metrics.record_tool_call("fraud_intent_analysis", elapsed, success=True)
            return result.model_dump(exclude_none=True)
        except Exception as exc:
            elapsed = (time.monotonic() - start) * 1000
            state.metrics.record_tool_call("fraud_intent_analysis", elapsed, success=False)
            state.metrics.record_error(type(exc).__name__)
            raise

    # ── Fraud Intent Plan (Plan-Only, No Execution) ─────────────────

    @mcp.tool()
    async def fraud_intent_plan(
        ctx: Context,
        scenario: str,
        phone_number: str | None = None,
        email_address: str | None = None,
        originating_ip: str | None = None,
        account_lifecycle_event: str | None = None,
    ) -> dict[str, Any]:
        """Get a fraud analysis plan WITHOUT executing any tools.

        Returns the execution plan that fraud_intent_analysis would use,
        including which tools would be called, in what order, and why.
        Useful for previewing the analysis strategy before committing
        to API calls.

        Args:
            scenario: Natural language fraud scenario description.
            phone_number: Optional E.164 phone number.
            email_address: Optional email address.
            originating_ip: Optional end-user IP.
            account_lifecycle_event: Optional lifecycle event.
        """
        from telesign_mcp.models.intent import FraudScenario
        from telesign_mcp.orchestrator import build_execution_plan, classify_intent

        state: AppState = ctx.request_context.lifespan_context
        _instrument_tool(state, "fraud_intent_plan")

        start = time.monotonic()
        fraud_scenario = FraudScenario(
            scenario=scenario,
            phone_number=phone_number,
            email_address=email_address,
            originating_ip=originating_ip,
            account_lifecycle_event=account_lifecycle_event,
        )

        intent = classify_intent(fraud_scenario)
        plan = build_execution_plan(fraud_scenario, intent)

        elapsed = (time.monotonic() - start) * 1000
        state.metrics.record_tool_call("fraud_intent_plan", elapsed, success=True)

        return plan.model_dump(exclude_none=True)

    return mcp


# Module-level server instance for entry points
mcp = create_server()
