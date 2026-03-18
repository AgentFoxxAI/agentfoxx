"""Tests for fraud intent orchestration engine.

Covers intent classification, execution plan generation,
tool execution, risk aggregation, summary generation,
and the full FraudOrchestrator.analyze pipeline.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from telesign_mcp.models.intent import (
    AggregatedRisk,
    ExecutionPlan,
    ExecutionStrategy,
    FraudIntent,
    FraudScenario,
    RiskAction,
    ToolRecommendation,
    ToolResult,
)
from telesign_mcp.orchestrator import (
    FraudOrchestrator,
    _determine_action,
    _score_to_level,
    aggregate_risk,
    build_execution_plan,
    classify_intent,
    execute_plan,
    generate_summary,
)

# ---------------------------------------------------------------------------
# classify_intent tests
# ---------------------------------------------------------------------------


class TestClassifyIntent:
    """Test keyword-based intent classification."""

    def test_account_creation_keywords(self) -> None:
        scenario = FraudScenario(scenario="New user trying to create an account")
        assert classify_intent(scenario) == FraudIntent.ACCOUNT_CREATION

    def test_account_takeover_keywords(self) -> None:
        scenario = FraudScenario(scenario="Suspicious login, possible account takeover")
        assert classify_intent(scenario) == FraudIntent.ACCOUNT_TAKEOVER

    def test_transaction_risk_keywords(self) -> None:
        scenario = FraudScenario(scenario="Verify this purchase transaction for fraud")
        assert classify_intent(scenario) == FraudIntent.TRANSACTION_RISK

    def test_identity_verification_keywords(self) -> None:
        scenario = FraudScenario(scenario="Need to verify identity with KYC check")
        assert classify_intent(scenario) == FraudIntent.IDENTITY_VERIFICATION

    def test_phone_reputation_keywords(self) -> None:
        scenario = FraudScenario(scenario="Check phone reputation for VOIP risk")
        assert classify_intent(scenario) == FraudIntent.PHONE_REPUTATION

    def test_email_risk_keywords(self) -> None:
        scenario = FraudScenario(scenario="Check email risk for disposable email domain")
        assert classify_intent(scenario) == FraudIntent.EMAIL_RISK

    def test_mfa_keywords(self) -> None:
        scenario = FraudScenario(scenario="Send OTP code for 2FA verification")
        assert classify_intent(scenario) == FraudIntent.MULTI_FACTOR_AUTH

    def test_lifecycle_event_create_boosts_account_creation(self) -> None:
        scenario = FraudScenario(
            scenario="Check this phone number",
            phone_number="+15555550100",
            account_lifecycle_event="create",
        )
        assert classify_intent(scenario) == FraudIntent.ACCOUNT_CREATION

    def test_lifecycle_event_signin_boosts_ato(self) -> None:
        scenario = FraudScenario(
            scenario="Check this phone number",
            phone_number="+15555550100",
            account_lifecycle_event="sign-in",
        )
        assert classify_intent(scenario) == FraudIntent.ACCOUNT_TAKEOVER

    def test_lifecycle_event_transact_boosts_transaction(self) -> None:
        scenario = FraudScenario(
            scenario="Check this phone number",
            phone_number="+15555550100",
            account_lifecycle_event="transact",
        )
        assert classify_intent(scenario) == FraudIntent.TRANSACTION_RISK

    def test_phone_and_email_boosts_comprehensive(self) -> None:
        scenario = FraudScenario(
            scenario="Evaluate this user",
            phone_number="+15555550100",
            email_address="user@example.com",
        )
        assert classify_intent(scenario) == FraudIntent.COMPREHENSIVE_CHECK

    def test_fallback_phone_only(self) -> None:
        """No keyword matches + phone → PHONE_REPUTATION."""
        scenario = FraudScenario(
            scenario="Assess this data point",
            phone_number="+15555550100",
        )
        assert classify_intent(scenario) == FraudIntent.PHONE_REPUTATION

    def test_fallback_email_only(self) -> None:
        """No keyword matches + email → EMAIL_RISK."""
        scenario = FraudScenario(
            scenario="Assess this data point",
            email_address="user@example.com",
        )
        assert classify_intent(scenario) == FraudIntent.EMAIL_RISK

    def test_fallback_no_signals(self) -> None:
        """No keyword matches, no signals → COMPREHENSIVE_CHECK."""
        scenario = FraudScenario(scenario="Assess this data point")
        assert classify_intent(scenario) == FraudIntent.COMPREHENSIVE_CHECK

    def test_case_insensitive(self) -> None:
        scenario = FraudScenario(scenario="ACCOUNT CREATION for SIGNUP")
        assert classify_intent(scenario) == FraudIntent.ACCOUNT_CREATION

    def test_highest_score_wins(self) -> None:
        """When multiple intents match, the one with highest score wins."""
        # "register" + "signup" + "new account" → 3 hits for ACCOUNT_CREATION
        # "email" → 1 hit for EMAIL_RISK
        scenario = FraudScenario(
            scenario="Register a new account via signup. Also check email.",
        )
        assert classify_intent(scenario) == FraudIntent.ACCOUNT_CREATION


# ---------------------------------------------------------------------------
# build_execution_plan tests
# ---------------------------------------------------------------------------


class TestBuildExecutionPlan:
    """Test execution plan generation."""

    def test_account_creation_plan_with_phone(self) -> None:
        scenario = FraudScenario(
            scenario="New user signup",
            phone_number="+15555550100",
        )
        plan = build_execution_plan(scenario, FraudIntent.ACCOUNT_CREATION)

        assert plan.intent == FraudIntent.ACCOUNT_CREATION
        tool_names = [t.tool_name for t in plan.tools]
        assert "intelligence_score" in tool_names
        assert "phone_identity_deep_check" in tool_names
        # No email → email_intelligence skipped
        assert "email_intelligence" not in tool_names

    def test_account_creation_plan_with_phone_and_email(self) -> None:
        scenario = FraudScenario(
            scenario="New user signup",
            phone_number="+15555550100",
            email_address="user@example.com",
        )
        plan = build_execution_plan(scenario, FraudIntent.ACCOUNT_CREATION)

        tool_names = [t.tool_name for t in plan.tools]
        assert "intelligence_score" in tool_names
        assert "phone_identity_deep_check" in tool_names
        assert "email_intelligence" in tool_names

    def test_email_risk_plan(self) -> None:
        scenario = FraudScenario(
            scenario="Check email risk",
            email_address="user@example.com",
        )
        plan = build_execution_plan(scenario, FraudIntent.EMAIL_RISK)

        assert len(plan.tools) == 1
        assert plan.tools[0].tool_name == "email_intelligence"
        assert plan.strategy == ExecutionStrategy.PARALLEL  # single tool → parallel

    def test_identity_verification_includes_addons(self) -> None:
        scenario = FraudScenario(
            scenario="KYC check",
            phone_number="+15555550100",
        )
        plan = build_execution_plan(scenario, FraudIntent.IDENTITY_VERIFICATION)

        phone_id_tool = next(t for t in plan.tools if t.tool_name == "phone_identity_deep_check")
        assert "addons" in phone_id_tool.parameters
        assert "contact" in phone_id_tool.parameters["addons"]
        assert "subscriber_status" in phone_id_tool.parameters["addons"]

    def test_mfa_plan_sequential(self) -> None:
        """MFA has priority 1 (phone check) then priority 2 (send OTP) → sequential."""
        scenario = FraudScenario(
            scenario="Send MFA code",
            phone_number="+15555550100",
        )
        plan = build_execution_plan(scenario, FraudIntent.MULTI_FACTOR_AUTH)

        assert plan.strategy == ExecutionStrategy.SEQUENTIAL
        tool_names = [t.tool_name for t in plan.tools]
        assert "phone_identity_deep_check" in tool_names
        assert "adaptive_verify_send" in tool_names

    def test_parallel_strategy_when_same_priority(self) -> None:
        """PHONE_REPUTATION has all priority-1 tools → parallel."""
        scenario = FraudScenario(
            scenario="Phone reputation check",
            phone_number="+15555550100",
        )
        plan = build_execution_plan(scenario, FraudIntent.PHONE_REPUTATION)

        assert plan.strategy == ExecutionStrategy.PARALLEL

    def test_tools_without_params_are_skipped(self) -> None:
        """Comprehensive check without phone or email → no runnable tools."""
        scenario = FraudScenario(scenario="Comprehensive analysis requested")
        plan = build_execution_plan(scenario, FraudIntent.COMPREHENSIVE_CHECK)

        # No phone or email → all tools need at least one, so none should run
        assert len(plan.tools) == 0

    def test_plan_includes_ip_when_available(self) -> None:
        scenario = FraudScenario(
            scenario="Signup risk check",
            phone_number="+15555550100",
            originating_ip="10.0.0.1",
        )
        plan = build_execution_plan(scenario, FraudIntent.ACCOUNT_CREATION)

        intel_tool = next(t for t in plan.tools if t.tool_name == "intelligence_score")
        assert intel_tool.parameters.get("originating_ip") == "10.0.0.1"

    def test_plan_explanation_contains_intent(self) -> None:
        scenario = FraudScenario(
            scenario="Check phone",
            phone_number="+15555550100",
        )
        plan = build_execution_plan(scenario, FraudIntent.PHONE_REPUTATION)

        assert "phone_reputation" in plan.explanation

    def test_default_lifecycle_event_for_intent(self) -> None:
        """When no lifecycle event is specified, plan uses intent-mapped default."""
        scenario = FraudScenario(
            scenario="Check creation fraud",
            phone_number="+15555550100",
        )
        plan = build_execution_plan(scenario, FraudIntent.ACCOUNT_CREATION)

        intel_tool = next(t for t in plan.tools if t.tool_name == "intelligence_score")
        assert intel_tool.parameters["account_lifecycle_event"] == "create"

    def test_explicit_lifecycle_event_overrides_default(self) -> None:
        scenario = FraudScenario(
            scenario="Check creation fraud",
            phone_number="+15555550100",
            account_lifecycle_event="update",
        )
        plan = build_execution_plan(scenario, FraudIntent.ACCOUNT_CREATION)

        intel_tool = next(t for t in plan.tools if t.tool_name == "intelligence_score")
        assert intel_tool.parameters["account_lifecycle_event"] == "update"


# ---------------------------------------------------------------------------
# execute_plan tests
# ---------------------------------------------------------------------------


class TestExecutePlan:
    """Test plan execution with mocked tool functions."""

    @pytest.mark.asyncio
    async def test_parallel_execution(self) -> None:
        """Parallel plan runs all tools concurrently."""
        mock_intel_result = {"success": True, "data": {"risk": {"score": 200}}}
        mock_phoneid_result = {"success": True, "data": {"phone_type": {"description": "MOBILE"}}}

        plan = ExecutionPlan(
            intent=FraudIntent.PHONE_REPUTATION,
            strategy=ExecutionStrategy.PARALLEL,
            tools=[
                ToolRecommendation(
                    tool_name="intelligence_score",
                    priority=1,
                    rationale="Score risk",
                    parameters={
                        "phone_number": "+15555550100",
                        "account_lifecycle_event": "create",
                    },
                ),
                ToolRecommendation(
                    tool_name="phone_identity_deep_check",
                    priority=1,
                    rationale="Check phone",
                    parameters={"phone_number": "+15555550100"},
                ),
            ],
            explanation="Test plan",
        )

        with patch.dict(
            "telesign_mcp.orchestrator._TOOL_FUNCTIONS",
            {
                "intelligence_score": AsyncMock(return_value=mock_intel_result),
                "phone_identity_deep_check": AsyncMock(return_value=mock_phoneid_result),
            },
        ):
            mock_client = AsyncMock()
            results = await execute_plan(mock_client, plan)

        assert len(results) == 2
        assert all(r.success for r in results)
        assert results[0].execution_time_ms is not None

    @pytest.mark.asyncio
    async def test_sequential_execution_respects_priority(self) -> None:
        """Sequential plan runs tools in priority order."""
        call_order: list[str] = []

        async def mock_phone_check(**kwargs):
            call_order.append("phone_identity_deep_check")
            return {"success": True, "data": {"phone_type": {"description": "MOBILE"}}}

        async def mock_verify(**kwargs):
            call_order.append("adaptive_verify_send")
            return {"success": True, "data": {"reference_id": "ref-123"}}

        plan = ExecutionPlan(
            intent=FraudIntent.MULTI_FACTOR_AUTH,
            strategy=ExecutionStrategy.SEQUENTIAL,
            tools=[
                ToolRecommendation(
                    tool_name="phone_identity_deep_check",
                    priority=1,
                    rationale="Check phone first",
                    parameters={"phone_number": "+15555550100"},
                ),
                ToolRecommendation(
                    tool_name="adaptive_verify_send",
                    priority=2,
                    rationale="Then send OTP",
                    parameters={"phone_number": "+15555550100"},
                ),
            ],
            explanation="Test sequential plan",
        )

        with patch.dict(
            "telesign_mcp.orchestrator._TOOL_FUNCTIONS",
            {
                "phone_identity_deep_check": mock_phone_check,
                "adaptive_verify_send": mock_verify,
            },
        ):
            mock_client = AsyncMock()
            results = await execute_plan(mock_client, plan)

        assert len(results) == 2
        assert call_order == ["phone_identity_deep_check", "adaptive_verify_send"]

    @pytest.mark.asyncio
    async def test_unknown_tool_returns_failure(self) -> None:
        """Unknown tool names return a failed ToolResult."""
        plan = ExecutionPlan(
            intent=FraudIntent.PHONE_REPUTATION,
            strategy=ExecutionStrategy.PARALLEL,
            tools=[
                ToolRecommendation(
                    tool_name="nonexistent_tool",
                    priority=1,
                    rationale="Should fail",
                    parameters={"foo": "bar"},
                ),
            ],
            explanation="Unknown tool test",
        )

        mock_client = AsyncMock()
        results = await execute_plan(mock_client, plan)

        assert len(results) == 1
        assert results[0].success is False
        assert "Unknown tool" in results[0].error

    @pytest.mark.asyncio
    async def test_tool_exception_is_caught(self) -> None:
        """Exceptions in tool functions are caught and wrapped in ToolResult."""

        async def failing_tool(**kwargs):
            raise RuntimeError("Connection refused")

        plan = ExecutionPlan(
            intent=FraudIntent.PHONE_REPUTATION,
            strategy=ExecutionStrategy.PARALLEL,
            tools=[
                ToolRecommendation(
                    tool_name="intelligence_score",
                    priority=1,
                    rationale="Will fail",
                    parameters={
                        "phone_number": "+15555550100",
                        "account_lifecycle_event": "create",
                    },
                ),
            ],
            explanation="Exception test",
        )

        with patch.dict(
            "telesign_mcp.orchestrator._TOOL_FUNCTIONS",
            {"intelligence_score": failing_tool},
        ):
            mock_client = AsyncMock()
            results = await execute_plan(mock_client, plan)

        assert len(results) == 1
        assert results[0].success is False
        assert "Connection refused" in results[0].error

    @pytest.mark.asyncio
    async def test_empty_plan_returns_empty_results(self) -> None:
        """Plan with no tools returns an empty result list."""
        plan = ExecutionPlan(
            intent=FraudIntent.COMPREHENSIVE_CHECK,
            strategy=ExecutionStrategy.PARALLEL,
            tools=[],
            explanation="Empty plan",
        )

        mock_client = AsyncMock()
        results = await execute_plan(mock_client, plan)

        assert results == []


# ---------------------------------------------------------------------------
# aggregate_risk tests
# ---------------------------------------------------------------------------


class TestAggregateRisk:
    """Test risk aggregation from tool results."""

    def test_low_risk_allows(self) -> None:
        results = [
            ToolResult(
                tool_name="intelligence_score",
                success=True,
                data={"risk": {"score": 100, "level": "low", "recommendation": "allow"}},
            ),
        ]
        risk = aggregate_risk(results, FraudIntent.PHONE_REPUTATION)

        assert risk.overall_score == 100
        assert risk.overall_level == "low"
        assert risk.recommended_action == RiskAction.ALLOW
        assert risk.confidence == 1.0

    def test_high_risk_blocks_sensitive_intent(self) -> None:
        results = [
            ToolResult(
                tool_name="intelligence_score",
                success=True,
                data={"risk": {"score": 750, "level": "high", "recommendation": "block"}},
            ),
        ]
        risk = aggregate_risk(results, FraudIntent.ACCOUNT_CREATION)

        assert risk.overall_score == 750
        assert risk.recommended_action == RiskAction.BLOCK

    def test_high_risk_flags_non_sensitive_intent(self) -> None:
        """Same score but non-sensitive intent → FLAG instead of BLOCK."""
        results = [
            ToolResult(
                tool_name="intelligence_score",
                success=True,
                data={"risk": {"score": 600, "level": "medium"}},
            ),
        ]
        risk = aggregate_risk(results, FraudIntent.PHONE_REPUTATION)

        assert risk.recommended_action == RiskAction.FLAG

    def test_voip_detection_adds_signal(self) -> None:
        results = [
            ToolResult(
                tool_name="phone_identity_deep_check",
                success=True,
                data={
                    "phone_type": {"description": "VOIP"},
                    "risk": {"score": 300},
                },
            ),
        ]
        risk = aggregate_risk(results, FraudIntent.ACCOUNT_CREATION)

        voip_signals = [s for s in risk.risk_signals if "VOIP" in s]
        assert len(voip_signals) >= 1
        # VOIP signal + sensitive intent → CHALLENGE
        assert risk.recommended_action == RiskAction.CHALLENGE

    def test_prepaid_detection_adds_signal(self) -> None:
        results = [
            ToolResult(
                tool_name="phone_identity_deep_check",
                success=True,
                data={
                    "phone_type": {"description": "PREPAID"},
                    "risk": {"score": 200},
                },
            ),
        ]
        risk = aggregate_risk(results, FraudIntent.PHONE_REPUTATION)

        prepaid_signals = [s for s in risk.risk_signals if "prepaid" in s]
        assert len(prepaid_signals) >= 1

    def test_disposable_email_insight_adds_signal(self) -> None:
        results = [
            ToolResult(
                tool_name="email_intelligence",
                success=True,
                data={
                    "risk": {"score": 400},
                    "risk_insights": {"email": ["disposable_email_domain"]},
                },
            ),
        ]
        risk = aggregate_risk(results, FraudIntent.EMAIL_RISK)

        disposable_signals = [s for s in risk.risk_signals if "disposable" in s]
        assert len(disposable_signals) >= 1

    def test_multiple_tool_score_averaging(self) -> None:
        results = [
            ToolResult(
                tool_name="intelligence_score",
                success=True,
                data={"risk": {"score": 200}},
            ),
            ToolResult(
                tool_name="phone_identity_deep_check",
                success=True,
                data={"risk": {"score": 400}},
            ),
        ]
        risk = aggregate_risk(results, FraudIntent.PHONE_REPUTATION)

        # Average of 200 and 400
        assert risk.overall_score == 300

    def test_failed_tool_reduces_confidence(self) -> None:
        results = [
            ToolResult(
                tool_name="intelligence_score",
                success=True,
                data={"risk": {"score": 200}},
            ),
            ToolResult(
                tool_name="phone_identity_deep_check",
                success=False,
                error="API timeout",
            ),
        ]
        risk = aggregate_risk(results, FraudIntent.PHONE_REPUTATION)

        assert risk.confidence == 0.5  # 1/2 tools succeeded

    def test_all_tools_failed(self) -> None:
        results = [
            ToolResult(
                tool_name="intelligence_score",
                success=False,
                error="Auth failed",
            ),
        ]
        risk = aggregate_risk(results, FraudIntent.PHONE_REPUTATION)

        assert risk.overall_score is None
        assert risk.confidence == 0.0
        assert risk.recommended_action == RiskAction.ALLOW

    def test_empty_results(self) -> None:
        risk = aggregate_risk([], FraudIntent.PHONE_REPUTATION)

        assert risk.overall_score is None
        assert risk.confidence == 0.0
        assert risk.recommended_action == RiskAction.ALLOW

    def test_two_high_risk_signals_blocks_sensitive(self) -> None:
        """Two VOIP/disposable signals → BLOCK for sensitive intents."""
        results = [
            ToolResult(
                tool_name="phone_identity_deep_check",
                success=True,
                data={
                    "phone_type": {"description": "VOIP"},
                    "risk": {"score": 350},
                },
            ),
            ToolResult(
                tool_name="email_intelligence",
                success=True,
                data={
                    "risk": {"score": 400},
                    "risk_insights": {"email": ["disposable_email_domain"]},
                },
            ),
        ]
        risk = aggregate_risk(results, FraudIntent.ACCOUNT_CREATION)

        assert risk.recommended_action == RiskAction.BLOCK


# ---------------------------------------------------------------------------
# _score_to_level tests
# ---------------------------------------------------------------------------


class TestScoreToLevel:
    """Test numeric score to level mapping."""

    @pytest.mark.parametrize(
        "score,expected",
        [
            (0, "low"),
            (100, "low"),
            (200, "low"),
            (201, "medium-low"),
            (400, "medium-low"),
            (401, "medium"),
            (600, "medium"),
            (601, "medium-high"),
            (800, "medium-high"),
            (801, "high"),
            (1000, "high"),
        ],
    )
    def test_score_levels(self, score: int, expected: str) -> None:
        assert _score_to_level(score) == expected


# ---------------------------------------------------------------------------
# _determine_action tests
# ---------------------------------------------------------------------------


class TestDetermineAction:
    """Test action determination with intent-sensitive thresholds."""

    def test_sensitive_intent_blocks_at_700(self) -> None:
        action = _determine_action(700, [], FraudIntent.ACCOUNT_CREATION)
        assert action == RiskAction.BLOCK

    def test_sensitive_intent_challenges_at_400(self) -> None:
        action = _determine_action(400, [], FraudIntent.ACCOUNT_CREATION)
        assert action == RiskAction.CHALLENGE

    def test_sensitive_intent_flags_at_200(self) -> None:
        action = _determine_action(200, [], FraudIntent.ACCOUNT_CREATION)
        assert action == RiskAction.FLAG

    def test_sensitive_intent_allows_below_200(self) -> None:
        action = _determine_action(100, [], FraudIntent.ACCOUNT_CREATION)
        assert action == RiskAction.ALLOW

    def test_standard_intent_blocks_at_800(self) -> None:
        action = _determine_action(800, [], FraudIntent.PHONE_REPUTATION)
        assert action == RiskAction.BLOCK

    def test_standard_intent_flags_at_500(self) -> None:
        action = _determine_action(500, [], FraudIntent.PHONE_REPUTATION)
        assert action == RiskAction.FLAG

    def test_standard_intent_allows_below_500(self) -> None:
        action = _determine_action(300, [], FraudIntent.PHONE_REPUTATION)
        assert action == RiskAction.ALLOW

    def test_no_score_two_signals_blocks(self) -> None:
        signals = [
            "phone_identity_deep_check: VOIP number detected",
            "email_intelligence: email signal — disposable_email_domain",
        ]
        action = _determine_action(None, signals, FraudIntent.PHONE_REPUTATION)
        assert action == RiskAction.BLOCK

    def test_no_score_one_signal_flags(self) -> None:
        signals = ["phone_identity_deep_check: VOIP number detected"]
        action = _determine_action(None, signals, FraudIntent.PHONE_REPUTATION)
        assert action == RiskAction.FLAG

    def test_no_score_no_signals_allows(self) -> None:
        action = _determine_action(None, [], FraudIntent.PHONE_REPUTATION)
        assert action == RiskAction.ALLOW


# ---------------------------------------------------------------------------
# generate_summary tests
# ---------------------------------------------------------------------------


class TestGenerateSummary:
    """Test human-readable summary generation."""

    def test_summary_contains_intent(self) -> None:
        plan = ExecutionPlan(
            intent=FraudIntent.ACCOUNT_CREATION,
            strategy=ExecutionStrategy.PARALLEL,
            tools=[],
            explanation="Test",
        )
        risk = AggregatedRisk(recommended_action=RiskAction.ALLOW)
        scenario = FraudScenario(scenario="Test scenario")

        summary = generate_summary(scenario, plan, [], risk)

        assert "Account Creation" in summary

    def test_summary_contains_action(self) -> None:
        plan = ExecutionPlan(
            intent=FraudIntent.PHONE_REPUTATION,
            strategy=ExecutionStrategy.PARALLEL,
            tools=[],
            explanation="Test",
        )
        risk = AggregatedRisk(recommended_action=RiskAction.BLOCK)
        scenario = FraudScenario(scenario="Test scenario")

        summary = generate_summary(scenario, plan, [], risk)

        assert "BLOCK" in summary

    def test_summary_contains_score(self) -> None:
        plan = ExecutionPlan(
            intent=FraudIntent.PHONE_REPUTATION,
            strategy=ExecutionStrategy.PARALLEL,
            tools=[],
            explanation="Test",
        )
        risk = AggregatedRisk(
            overall_score=450,
            overall_level="medium",
            recommended_action=RiskAction.FLAG,
        )
        scenario = FraudScenario(scenario="Test scenario")

        summary = generate_summary(scenario, plan, [], risk)

        assert "450/1000" in summary
        assert "medium" in summary

    def test_summary_tool_counts(self) -> None:
        plan = ExecutionPlan(
            intent=FraudIntent.PHONE_REPUTATION,
            strategy=ExecutionStrategy.PARALLEL,
            tools=[],
            explanation="Test",
        )
        risk = AggregatedRisk(recommended_action=RiskAction.ALLOW)
        results = [
            ToolResult(tool_name="intelligence_score", success=True, data={}),
            ToolResult(tool_name="phone_identity_deep_check", success=False, error="err"),
        ]
        scenario = FraudScenario(scenario="Test scenario")

        summary = generate_summary(scenario, plan, results, risk)

        assert "1/2 succeeded" in summary
        assert "✓ intelligence_score" in summary
        assert "✗ phone_identity_deep_check" in summary

    def test_summary_risk_signals(self) -> None:
        plan = ExecutionPlan(
            intent=FraudIntent.PHONE_REPUTATION,
            strategy=ExecutionStrategy.PARALLEL,
            tools=[],
            explanation="Test",
        )
        risk = AggregatedRisk(
            recommended_action=RiskAction.FLAG,
            risk_signals=["phone_identity_deep_check: VOIP number detected"],
        )
        scenario = FraudScenario(scenario="Test scenario")

        summary = generate_summary(scenario, plan, [], risk)

        assert "VOIP number detected" in summary


# ---------------------------------------------------------------------------
# FraudOrchestrator.analyze integration tests
# ---------------------------------------------------------------------------


class TestFraudOrchestratorAnalyze:
    """Test the full analyze pipeline with mocked tools."""

    @pytest.mark.asyncio
    async def test_full_pipeline_success(self) -> None:
        """Full orchestrator pipeline: classify → plan → execute → aggregate → summarize."""

        async def mock_intel(**kwargs):
            return {
                "success": True,
                "data": {
                    "risk": {"score": 300, "level": "medium-low", "recommendation": "allow"},
                    "phone_type": {"description": "MOBILE"},
                },
            }

        async def mock_phoneid(**kwargs):
            return {
                "success": True,
                "data": {
                    "risk": {"score": 250},
                    "phone_type": {"description": "MOBILE"},
                    "carrier": {"name": "AT&T"},
                },
            }

        scenario = FraudScenario(
            scenario="New user signup from web",
            phone_number="+15555550100",
            account_lifecycle_event="create",
        )

        with patch.dict(
            "telesign_mcp.orchestrator._TOOL_FUNCTIONS",
            {
                "intelligence_score": mock_intel,
                "phone_identity_deep_check": mock_phoneid,
                "adaptive_verify_send": AsyncMock(return_value={"success": True, "data": {}}),
                "email_intelligence": AsyncMock(return_value={"success": True, "data": {}}),
            },
        ):
            orchestrator = FraudOrchestrator(client=AsyncMock())
            result = await orchestrator.analyze(scenario)

        assert result.scenario == "New user signup from web"
        assert result.execution_plan.intent == FraudIntent.ACCOUNT_CREATION
        assert len(result.tool_results) >= 2
        assert result.aggregated_risk.overall_score is not None
        assert result.aggregated_risk.recommended_action in list(RiskAction)
        assert len(result.summary) > 0

    @pytest.mark.asyncio
    async def test_pipeline_with_failed_tool(self) -> None:
        """Pipeline handles partial tool failures gracefully."""

        async def mock_intel(**kwargs):
            return {
                "success": True,
                "data": {"risk": {"score": 500}},
            }

        async def mock_phoneid_fail(**kwargs):
            return {
                "success": False,
                "error_type": "timeout_error",
                "error_message": "Request timed out",
            }

        scenario = FraudScenario(
            scenario="Check phone reputation",
            phone_number="+15555550100",
        )

        with patch.dict(
            "telesign_mcp.orchestrator._TOOL_FUNCTIONS",
            {
                "intelligence_score": mock_intel,
                "phone_identity_deep_check": mock_phoneid_fail,
                "adaptive_verify_send": AsyncMock(return_value={"success": True, "data": {}}),
                "email_intelligence": AsyncMock(return_value={"success": True, "data": {}}),
            },
        ):
            orchestrator = FraudOrchestrator(client=AsyncMock())
            result = await orchestrator.analyze(scenario)

        assert result.aggregated_risk.confidence < 1.0
        failed = [r for r in result.tool_results if not r.success]
        assert len(failed) >= 1

    @pytest.mark.asyncio
    async def test_pipeline_email_only(self) -> None:
        """Pipeline works with email-only scenario."""

        async def mock_email(**kwargs):
            return {
                "success": True,
                "data": {
                    "risk": {"score": 150, "level": "low"},
                    "risk_insights": {"email": ["valid_domain"]},
                },
            }

        scenario = FraudScenario(
            scenario="Check email risk for disposable email",
            email_address="user@example.com",
        )

        with patch.dict(
            "telesign_mcp.orchestrator._TOOL_FUNCTIONS",
            {
                "intelligence_score": AsyncMock(return_value={"success": True, "data": {}}),
                "phone_identity_deep_check": AsyncMock(return_value={"success": True, "data": {}}),
                "adaptive_verify_send": AsyncMock(return_value={"success": True, "data": {}}),
                "email_intelligence": mock_email,
            },
        ):
            orchestrator = FraudOrchestrator(client=AsyncMock())
            result = await orchestrator.analyze(scenario)

        assert result.execution_plan.intent == FraudIntent.EMAIL_RISK
        assert len(result.tool_results) >= 1

    @pytest.mark.asyncio
    async def test_result_is_serializable(self) -> None:
        """OrchestratorResult can be serialized via model_dump."""

        async def mock_intel(**kwargs):
            return {"success": True, "data": {"risk": {"score": 100}}}

        scenario = FraudScenario(
            scenario="Quick phone check",
            phone_number="+15555550100",
        )

        with patch.dict(
            "telesign_mcp.orchestrator._TOOL_FUNCTIONS",
            {
                "intelligence_score": mock_intel,
                "phone_identity_deep_check": AsyncMock(
                    return_value={
                        "success": True,
                        "data": {"phone_type": {"description": "MOBILE"}},
                    }
                ),
                "adaptive_verify_send": AsyncMock(return_value={"success": True, "data": {}}),
                "email_intelligence": AsyncMock(return_value={"success": True, "data": {}}),
            },
        ):
            orchestrator = FraudOrchestrator(client=AsyncMock())
            result = await orchestrator.analyze(scenario)

        dumped = result.model_dump(exclude_none=True)
        assert isinstance(dumped, dict)
        assert "scenario" in dumped
        assert "execution_plan" in dumped
        assert "aggregated_risk" in dumped
        assert "summary" in dumped
