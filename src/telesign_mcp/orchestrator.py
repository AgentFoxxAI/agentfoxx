"""Fraud intent analysis and tool orchestration engine.

Maps fraud scenarios to optimal tool combinations with execution
strategies (parallel, sequential, conditional). This is the "brain"
of the MCP server — it determines which Telesign APIs to query
and how to interpret the combined results.

The orchestrator does NOT call tools directly. Instead, it produces
an ExecutionPlan with recommendations. The MCP meta-tool then
executes the plan and aggregates results.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

from telesign_mcp.client import TelesignClient
from telesign_mcp.logging import get_logger
from telesign_mcp.models.intent import (
    AggregatedRisk,
    ExecutionPlan,
    ExecutionStrategy,
    FraudIntent,
    FraudScenario,
    OrchestratorResult,
    RiskAction,
    ToolRecommendation,
    ToolResult,
)
from telesign_mcp.tools.email import email_intelligence
from telesign_mcp.tools.intelligence import intelligence_score
from telesign_mcp.tools.phone_identity import phone_identity_deep_check
from telesign_mcp.tools.verify import adaptive_verify_send

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Intent classification
# ---------------------------------------------------------------------------

# Keywords that map to specific intents
_INTENT_KEYWORDS: dict[FraudIntent, list[str]] = {
    FraudIntent.ACCOUNT_CREATION: [
        "create",
        "register",
        "signup",
        "sign-up",
        "sign up",
        "new account",
        "onboard",
        "enrollment",
    ],
    FraudIntent.ACCOUNT_TAKEOVER: [
        "takeover",
        "take over",
        "ato",
        "compromise",
        "hijack",
        "unauthorized access",
        "suspicious login",
        "credential",
    ],
    FraudIntent.TRANSACTION_RISK: [
        "transaction",
        "purchase",
        "payment",
        "transfer",
        "buy",
        "checkout",
        "order",
        "financial",
    ],
    FraudIntent.IDENTITY_VERIFICATION: [
        "verify identity",
        "identity check",
        "kyc",
        "know your customer",
        "prove identity",
        "id verification",
    ],
    FraudIntent.PHONE_REPUTATION: [
        "phone reputation",
        "phone check",
        "voip",
        "virtual number",
        "carrier",
        "phone type",
        "phone risk",
    ],
    FraudIntent.EMAIL_RISK: [
        "email",
        "email risk",
        "disposable email",
        "email verification",
        "email fraud",
    ],
    FraudIntent.MULTI_FACTOR_AUTH: [
        "mfa",
        "2fa",
        "otp",
        "verify phone",
        "send code",
        "two-factor",
        "multi-factor",
        "verification code",
    ],
}


def classify_intent(scenario: FraudScenario) -> FraudIntent:
    """Classify a fraud scenario into a FraudIntent.

    Uses keyword matching against the scenario description
    and available signals (phone, email, IP) to determine
    the most appropriate intent.

    Args:
        scenario: The fraud scenario to classify.

    Returns:
        The best-matching FraudIntent.
    """
    text = scenario.scenario.lower()

    # Score each intent by keyword matches
    scores: dict[FraudIntent, int] = {}
    for intent, keywords in _INTENT_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[intent] = score

    # If we have both phone and email, boost comprehensive
    if scenario.phone_number and scenario.email_address:
        scores[FraudIntent.COMPREHENSIVE_CHECK] = scores.get(FraudIntent.COMPREHENSIVE_CHECK, 0) + 2

    # If lifecycle event is specified, use it as a strong signal
    if scenario.account_lifecycle_event:
        event = scenario.account_lifecycle_event.lower()
        if event == "create":
            scores[FraudIntent.ACCOUNT_CREATION] = scores.get(FraudIntent.ACCOUNT_CREATION, 0) + 3
        elif event == "sign-in":
            scores[FraudIntent.ACCOUNT_TAKEOVER] = scores.get(FraudIntent.ACCOUNT_TAKEOVER, 0) + 3
        elif event == "transact":
            scores[FraudIntent.TRANSACTION_RISK] = scores.get(FraudIntent.TRANSACTION_RISK, 0) + 3

    if not scores:
        # Default: if phone is present, do phone reputation;
        # if email is present, do email risk; otherwise comprehensive
        if scenario.phone_number:
            return FraudIntent.PHONE_REPUTATION
        elif scenario.email_address:
            return FraudIntent.EMAIL_RISK
        return FraudIntent.COMPREHENSIVE_CHECK

    return max(scores, key=scores.get)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# Plan generation
# ---------------------------------------------------------------------------

# Maps each intent to the tools it should use
_INTENT_TOOL_MAP: dict[FraudIntent, list[dict[str, Any]]] = {
    FraudIntent.ACCOUNT_CREATION: [
        {
            "tool": "intelligence_score",
            "priority": 1,
            "rationale": "Score phone risk in account creation context",
            "required": True,
        },
        {
            "tool": "phone_identity_deep_check",
            "priority": 1,
            "rationale": "Identify VOIP/virtual numbers commonly used in fake registrations",
            "required": True,
        },
        {
            "tool": "email_intelligence",
            "priority": 2,
            "rationale": "Check email for disposable/temporary domains",
            "required": False,
            "needs_email": True,
        },
    ],
    FraudIntent.ACCOUNT_TAKEOVER: [
        {
            "tool": "intelligence_score",
            "priority": 1,
            "rationale": "Score phone risk in sign-in context to detect ATO",
            "required": True,
        },
        {
            "tool": "phone_identity_deep_check",
            "priority": 1,
            "rationale": "Check if phone type changed (SIM swap indicator)",
            "required": True,
        },
        {
            "tool": "adaptive_verify_send",
            "priority": 2,
            "rationale": "Send OTP to verify account holder",
            "required": False,
        },
    ],
    FraudIntent.TRANSACTION_RISK: [
        {
            "tool": "intelligence_score",
            "priority": 1,
            "rationale": "Score phone risk in transaction context",
            "required": True,
        },
        {
            "tool": "email_intelligence",
            "priority": 1,
            "rationale": "Cross-reference phone + email for transaction risk",
            "required": False,
            "needs_email": True,
        },
    ],
    FraudIntent.IDENTITY_VERIFICATION: [
        {
            "tool": "phone_identity_deep_check",
            "priority": 1,
            "rationale": "Deep identity verification via carrier data",
            "required": True,
            "addons": ["contact", "subscriber_status"],
        },
        {
            "tool": "intelligence_score",
            "priority": 2,
            "rationale": "Additional risk scoring for identity validation",
            "required": True,
        },
    ],
    FraudIntent.PHONE_REPUTATION: [
        {
            "tool": "intelligence_score",
            "priority": 1,
            "rationale": "Get comprehensive phone risk score",
            "required": True,
        },
        {
            "tool": "phone_identity_deep_check",
            "priority": 1,
            "rationale": "Identify phone type, carrier, and location",
            "required": True,
        },
    ],
    FraudIntent.EMAIL_RISK: [
        {
            "tool": "email_intelligence",
            "priority": 1,
            "rationale": "Evaluate email risk signals",
            "required": True,
        },
    ],
    FraudIntent.MULTI_FACTOR_AUTH: [
        {
            "tool": "phone_identity_deep_check",
            "priority": 1,
            "rationale": "Verify phone can receive SMS before sending OTP",
            "required": True,
        },
        {
            "tool": "adaptive_verify_send",
            "priority": 2,
            "rationale": "Send OTP verification code",
            "required": True,
        },
    ],
    FraudIntent.COMPREHENSIVE_CHECK: [
        {
            "tool": "intelligence_score",
            "priority": 1,
            "rationale": "Full risk scoring with all available signals",
            "required": True,
        },
        {
            "tool": "phone_identity_deep_check",
            "priority": 1,
            "rationale": "Deep phone identity and carrier intelligence",
            "required": True,
        },
        {
            "tool": "email_intelligence",
            "priority": 2,
            "rationale": "Email risk with phone cross-reference",
            "required": False,
            "needs_email": True,
        },
    ],
}


def build_execution_plan(
    scenario: FraudScenario,
    intent: FraudIntent,
) -> ExecutionPlan:
    """Generate an execution plan for the classified intent.

    Builds tool recommendations with appropriate parameters
    based on the available signals in the scenario.

    Args:
        scenario: The fraud scenario with available signals.
        intent: The classified fraud intent.

    Returns:
        An ExecutionPlan with ordered tool recommendations.
    """
    tool_configs = _INTENT_TOOL_MAP.get(intent, _INTENT_TOOL_MAP[FraudIntent.COMPREHENSIVE_CHECK])
    recommendations: list[ToolRecommendation] = []

    for config in tool_configs:
        # Skip email tools if no email provided
        if config.get("needs_email") and not scenario.email_address:
            continue

        # Build parameters based on tool type
        params: dict[str, Any] = {}
        tool_name = config["tool"]

        if tool_name == "intelligence_score" and scenario.phone_number:
            params["phone_number"] = scenario.phone_number
            params["account_lifecycle_event"] = (
                scenario.account_lifecycle_event or _intent_to_lifecycle(intent)
            )
            if scenario.originating_ip:
                params["originating_ip"] = scenario.originating_ip
            if scenario.email_address:
                params["email_address"] = scenario.email_address

        elif tool_name == "phone_identity_deep_check" and scenario.phone_number:
            params["phone_number"] = scenario.phone_number
            if config.get("addons"):
                params["addons"] = config["addons"]

        elif tool_name == "adaptive_verify_send" and scenario.phone_number:
            params["phone_number"] = scenario.phone_number
            if scenario.originating_ip:
                params["originating_ip"] = scenario.originating_ip

        elif tool_name == "email_intelligence" and scenario.email_address:
            params["email_address"] = scenario.email_address
            if scenario.phone_number:
                params["phone_number"] = scenario.phone_number
            if scenario.originating_ip:
                params["originating_ip"] = scenario.originating_ip

        # Skip tools without enough params to run
        if not params:
            continue

        recommendations.append(
            ToolRecommendation(
                tool_name=tool_name,
                priority=config["priority"],
                rationale=config["rationale"],
                parameters=params,
                required=config["required"],
            )
        )

    # Determine execution strategy
    priorities = {r.priority for r in recommendations}
    strategy = ExecutionStrategy.SEQUENTIAL if len(priorities) > 1 else ExecutionStrategy.PARALLEL

    explanation = _build_explanation(intent, recommendations, scenario)

    return ExecutionPlan(
        intent=intent,
        strategy=strategy,
        tools=recommendations,
        explanation=explanation,
    )


def _intent_to_lifecycle(intent: FraudIntent) -> str:
    """Map a fraud intent to a default lifecycle event."""
    mapping = {
        FraudIntent.ACCOUNT_CREATION: "create",
        FraudIntent.ACCOUNT_TAKEOVER: "sign-in",
        FraudIntent.TRANSACTION_RISK: "transact",
        FraudIntent.IDENTITY_VERIFICATION: "create",
        FraudIntent.PHONE_REPUTATION: "create",
        FraudIntent.EMAIL_RISK: "create",
        FraudIntent.MULTI_FACTOR_AUTH: "sign-in",
        FraudIntent.COMPREHENSIVE_CHECK: "create",
    }
    return mapping.get(intent, "create")


def _build_explanation(
    intent: FraudIntent,
    tools: list[ToolRecommendation],
    scenario: FraudScenario,
) -> str:
    """Build a human-readable explanation of the execution plan."""
    tool_names = [t.tool_name for t in tools]
    signals = []
    if scenario.phone_number:
        signals.append("phone number")
    if scenario.email_address:
        signals.append("email address")
    if scenario.originating_ip:
        signals.append("IP address")

    signal_str = ", ".join(signals) if signals else "scenario description"
    tool_str = ", ".join(tool_names)

    return (
        f"Classified as '{intent.value}' intent. "
        f"Will execute {len(tools)} tool(s) [{tool_str}] "
        f"using available signals: {signal_str}."
    )


# ---------------------------------------------------------------------------
# Execution engine
# ---------------------------------------------------------------------------

# Map tool names to their implementation functions
_TOOL_FUNCTIONS = {
    "intelligence_score": intelligence_score,
    "phone_identity_deep_check": phone_identity_deep_check,
    "adaptive_verify_send": adaptive_verify_send,
    "email_intelligence": email_intelligence,
}


async def _execute_tool(
    client: TelesignClient,
    recommendation: ToolRecommendation,
) -> ToolResult:
    """Execute a single tool and capture the result.

    Args:
        client: Initialized TelesignClient.
        recommendation: Tool recommendation with parameters.

    Returns:
        ToolResult with success/failure and timing data.
    """
    tool_fn = _TOOL_FUNCTIONS.get(recommendation.tool_name)
    if not tool_fn:
        return ToolResult(
            tool_name=recommendation.tool_name,
            success=False,
            error=f"Unknown tool: {recommendation.tool_name}",
        )

    start = time.monotonic()
    try:
        result = await tool_fn(client=client, **recommendation.parameters)
        elapsed = (time.monotonic() - start) * 1000

        return ToolResult(
            tool_name=recommendation.tool_name,
            success=result.get("success", False),
            data=result.get("data") if result.get("success") else None,
            error=result.get("error_message") if not result.get("success") else None,
            execution_time_ms=round(elapsed, 2),
        )
    except Exception as exc:
        elapsed = (time.monotonic() - start) * 1000
        logger.error(
            "orchestrator_tool_error",
            tool=recommendation.tool_name,
            error=str(exc),
        )
        return ToolResult(
            tool_name=recommendation.tool_name,
            success=False,
            error=str(exc),
            execution_time_ms=round(elapsed, 2),
        )


async def execute_plan(
    client: TelesignClient,
    plan: ExecutionPlan,
) -> list[ToolResult]:
    """Execute all tools in an execution plan.

    Respects the execution strategy:
    - PARALLEL: Run all same-priority tools concurrently
    - SEQUENTIAL: Run tools in priority order

    Args:
        client: Initialized TelesignClient.
        plan: Execution plan with tool recommendations.

    Returns:
        List of ToolResults in execution order.
    """
    results: list[ToolResult] = []

    if plan.strategy == ExecutionStrategy.PARALLEL:
        # Run all tools concurrently
        tasks = [_execute_tool(client, rec) for rec in plan.tools]
        results = list(await asyncio.gather(*tasks))
    else:
        # Group by priority, run each group in parallel
        priority_groups: dict[int, list[ToolRecommendation]] = {}
        for rec in plan.tools:
            priority_groups.setdefault(rec.priority, []).append(rec)

        for priority in sorted(priority_groups.keys()):
            group = priority_groups[priority]
            if len(group) == 1:
                results.append(await _execute_tool(client, group[0]))
            else:
                tasks = [_execute_tool(client, rec) for rec in group]
                results.extend(await asyncio.gather(*tasks))

    return results


# ---------------------------------------------------------------------------
# Risk aggregation
# ---------------------------------------------------------------------------


def aggregate_risk(
    tool_results: list[ToolResult],
    intent: FraudIntent,
) -> AggregatedRisk:
    """Aggregate risk signals from multiple tool results.

    Combines risk scores, levels, and specific signals into a
    unified risk assessment with a recommended action.

    Args:
        tool_results: Results from executed tools.
        intent: The fraud intent (affects risk thresholds).

    Returns:
        AggregatedRisk with overall assessment.
    """
    risk_scores: list[int] = []
    risk_levels: list[str] = []
    risk_signals: list[str] = []
    successful_tools = 0

    for result in tool_results:
        if not result.success or not result.data:
            risk_signals.append(f"{result.tool_name}: failed ({result.error})")
            continue

        successful_tools += 1
        data = result.data

        # Extract risk from the data
        risk = data.get("risk", {})
        if isinstance(risk, dict):
            if risk.get("score") is not None:
                risk_scores.append(risk["score"])
            if risk.get("level"):
                risk_levels.append(risk["level"])
            if risk.get("recommendation"):
                risk_signals.append(f"{result.tool_name}: recommendation={risk['recommendation']}")

        # Check for VOIP (high risk indicator)
        phone_type = data.get("phone_type", {})
        if isinstance(phone_type, dict) and phone_type.get("description"):
            pt_desc = phone_type["description"].upper()
            if "VOIP" in pt_desc:
                risk_signals.append(f"{result.tool_name}: VOIP number detected")
            elif "PREPAID" in pt_desc:
                risk_signals.append(f"{result.tool_name}: prepaid number detected")

        # Check risk insights
        insights = data.get("risk_insights", {})
        if isinstance(insights, dict):
            for key in ("email", "category", "ip"):
                values = insights.get(key, [])
                if isinstance(values, list):
                    for v in values:
                        if isinstance(v, str) and any(
                            term in v.lower()
                            for term in ["disposable", "suspicious", "fraud", "risk"]
                        ):
                            risk_signals.append(f"{result.tool_name}: {key} signal — {v}")

    # Calculate overall score (weighted average)
    overall_score = None
    if risk_scores:
        overall_score = int(sum(risk_scores) / len(risk_scores))

    # Determine overall level
    overall_level = _score_to_level(overall_score) if overall_score is not None else None

    # Determine recommended action
    action = _determine_action(overall_score, risk_signals, intent)

    # Calculate confidence based on how many tools succeeded
    total_tools = len(tool_results)
    confidence = round(successful_tools / total_tools, 2) if total_tools > 0 else 0.0

    return AggregatedRisk(
        overall_score=overall_score,
        overall_level=overall_level,
        recommended_action=action,
        risk_signals=risk_signals,
        confidence=confidence,
    )


def _score_to_level(score: int) -> str:
    """Convert a numeric risk score to a level string."""
    if score <= 200:
        return "low"
    elif score <= 400:
        return "medium-low"
    elif score <= 600:
        return "medium"
    elif score <= 800:
        return "medium-high"
    return "high"


def _determine_action(
    score: int | None,
    signals: list[str],
    intent: FraudIntent,
) -> RiskAction:
    """Determine recommended action from risk signals.

    Uses score thresholds adjusted by intent sensitivity.
    Account creation and transactions have lower thresholds
    (more cautious) than phone reputation checks.
    """
    # Count high-risk signals
    high_risk_signal_count = sum(
        1
        for s in signals
        if any(term in s.lower() for term in ["voip", "disposable", "fraud", "block"])
    )

    # Intent-specific thresholds
    sensitive_intents = {
        FraudIntent.ACCOUNT_CREATION,
        FraudIntent.TRANSACTION_RISK,
        FraudIntent.ACCOUNT_TAKEOVER,
    }

    if score is not None:
        if intent in sensitive_intents:
            # Stricter thresholds for sensitive operations
            if score >= 700 or high_risk_signal_count >= 2:
                return RiskAction.BLOCK
            elif score >= 400 or high_risk_signal_count >= 1:
                return RiskAction.CHALLENGE
            elif score >= 200:
                return RiskAction.FLAG
            return RiskAction.ALLOW
        else:
            # Standard thresholds
            if score >= 800 or high_risk_signal_count >= 2:
                return RiskAction.BLOCK
            elif score >= 500 or high_risk_signal_count >= 1:
                return RiskAction.FLAG
            return RiskAction.ALLOW

    # No score available — decide from signals alone
    if high_risk_signal_count >= 2:
        return RiskAction.BLOCK
    elif high_risk_signal_count >= 1:
        return RiskAction.FLAG
    return RiskAction.ALLOW


# ---------------------------------------------------------------------------
# Summary generation
# ---------------------------------------------------------------------------


def generate_summary(
    scenario: FraudScenario,
    plan: ExecutionPlan,
    results: list[ToolResult],
    risk: AggregatedRisk,
) -> str:
    """Generate a human-readable summary of the orchestration results.

    Produces a concise report suitable for LLM consumption.

    Args:
        scenario: Original fraud scenario.
        plan: Execution plan that was used.
        results: Tool execution results.
        risk: Aggregated risk assessment.

    Returns:
        Multi-line summary string.
    """
    lines = [
        f"Fraud Analysis: {plan.intent.value.replace('_', ' ').title()}",
        f"Action: {risk.recommended_action.value.upper()}",
    ]

    if risk.overall_score is not None:
        lines.append(f"Risk Score: {risk.overall_score}/1000 ({risk.overall_level})")

    lines.append(f"Confidence: {risk.confidence:.0%}")

    # Tool results summary
    succeeded = sum(1 for r in results if r.success)
    lines.append(f"Tools: {succeeded}/{len(results)} succeeded")

    for result in results:
        status = "✓" if result.success else "✗"
        timing = f" ({result.execution_time_ms:.0f}ms)" if result.execution_time_ms else ""
        lines.append(f"  {status} {result.tool_name}{timing}")

    # Risk signals
    if risk.risk_signals:
        lines.append("Signals:")
        for signal in risk.risk_signals:
            lines.append(f"  • {signal}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main orchestrator function
# ---------------------------------------------------------------------------


class FraudOrchestrator:
    """Orchestrates fraud analysis across multiple Telesign tools.

    Given a fraud scenario, the orchestrator:
    1. Classifies the intent
    2. Builds an execution plan
    3. Executes tools (respecting parallelism)
    4. Aggregates risk signals
    5. Generates a human-readable summary

    Usage:
        orchestrator = FraudOrchestrator(client)
        result = await orchestrator.analyze(scenario)
    """

    def __init__(self, client: TelesignClient) -> None:
        self._client = client

    async def analyze(self, scenario: FraudScenario) -> OrchestratorResult:
        """Run full fraud analysis for a scenario.

        Args:
            scenario: The fraud scenario to analyze.

        Returns:
            Complete OrchestratorResult with plan, results, and risk.
        """
        logger.info(
            "orchestrator_analyze_start",
            scenario=scenario.scenario[:100],
            has_phone=scenario.phone_number is not None,
            has_email=scenario.email_address is not None,
        )

        # 1. Classify intent
        intent = classify_intent(scenario)
        logger.info("orchestrator_intent_classified", intent=intent.value)

        # 2. Build execution plan
        plan = build_execution_plan(scenario, intent)
        logger.info(
            "orchestrator_plan_built",
            tools=[t.tool_name for t in plan.tools],
            strategy=plan.strategy.value,
        )

        # 3. Execute tools
        results = await execute_plan(self._client, plan)

        # 4. Aggregate risk
        risk = aggregate_risk(results, intent)

        # 5. Generate summary
        summary = generate_summary(scenario, plan, results, risk)

        logger.info(
            "orchestrator_analyze_complete",
            intent=intent.value,
            action=risk.recommended_action.value,
            overall_score=risk.overall_score,
        )

        return OrchestratorResult(
            scenario=scenario.scenario,
            execution_plan=plan,
            tool_results=results,
            aggregated_risk=risk,
            summary=summary,
        )
