"""Tests for intent classification models."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

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


class TestFraudScenario:
    """Test FraudScenario input model."""

    def test_minimal_scenario(self) -> None:
        s = FraudScenario(scenario="Check this phone for fraud")
        assert s.phone_number is None
        assert s.email_address is None

    def test_full_scenario(self) -> None:
        s = FraudScenario(
            scenario="New user signup from suspicious IP",
            phone_number="+15555550100",
            email_address="user@example.com",
            originating_ip="10.0.0.1",
            account_lifecycle_event="create",
        )
        assert s.phone_number == "+15555550100"
        assert s.account_lifecycle_event == "create"

    def test_scenario_too_short(self) -> None:
        with pytest.raises(ValidationError):
            FraudScenario(scenario="hi")


class TestToolRecommendation:
    """Test ToolRecommendation model."""

    def test_valid(self) -> None:
        rec = ToolRecommendation(
            tool_name="intelligence_score",
            priority=1,
            rationale="Check phone risk",
            parameters={"phone_number": "+15555550100"},
        )
        assert rec.required is True

    def test_priority_bounds(self) -> None:
        with pytest.raises(ValidationError):
            ToolRecommendation(tool_name="test", priority=0, rationale="Bad priority")


class TestAggregatedRisk:
    """Test AggregatedRisk model."""

    def test_defaults(self) -> None:
        risk = AggregatedRisk(recommended_action=RiskAction.ALLOW)
        assert risk.overall_score is None
        assert risk.confidence == 0.0
        assert risk.risk_signals == []

    def test_full(self) -> None:
        risk = AggregatedRisk(
            overall_score=450,
            overall_level="medium",
            recommended_action=RiskAction.CHALLENGE,
            risk_signals=["VOIP detected", "disposable email"],
            confidence=0.85,
        )
        assert risk.overall_score == 450

    def test_confidence_bounds(self) -> None:
        with pytest.raises(ValidationError):
            AggregatedRisk(recommended_action=RiskAction.ALLOW, confidence=1.5)


class TestToolResult:
    """Test ToolResult model."""

    def test_success(self) -> None:
        r = ToolResult(
            tool_name="intelligence_score",
            success=True,
            data={"risk": {"score": 100}},
            execution_time_ms=150.5,
        )
        assert r.success
        assert r.error is None

    def test_failure(self) -> None:
        r = ToolResult(
            tool_name="intelligence_score",
            success=False,
            error="Authentication failed",
        )
        assert not r.success
        assert r.data is None


class TestExecutionPlan:
    """Test ExecutionPlan model."""

    def test_valid_plan(self) -> None:
        plan = ExecutionPlan(
            intent=FraudIntent.ACCOUNT_CREATION,
            strategy=ExecutionStrategy.PARALLEL,
            tools=[
                ToolRecommendation(
                    tool_name="intelligence_score",
                    priority=1,
                    rationale="Score risk",
                ),
            ],
            explanation="Will check phone risk for new account",
        )
        assert plan.intent == FraudIntent.ACCOUNT_CREATION
        assert len(plan.tools) == 1


class TestOrchestratorResult:
    """Test OrchestratorResult model."""

    def test_full_result(self) -> None:
        result = OrchestratorResult(
            scenario="Test scenario",
            execution_plan=ExecutionPlan(
                intent=FraudIntent.PHONE_REPUTATION,
                strategy=ExecutionStrategy.PARALLEL,
                tools=[],
                explanation="No tools available",
            ),
            tool_results=[],
            aggregated_risk=AggregatedRisk(recommended_action=RiskAction.ALLOW),
            summary="No risk detected",
        )
        assert result.scenario == "Test scenario"
