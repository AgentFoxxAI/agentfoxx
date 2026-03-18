"""End-to-end integration tests for the Fraud Orchestrator.

Tests the full fraud_intent_analysis pipeline:
scenario → intent classification → plan → execution → risk aggregation → recommendation.
"""

from __future__ import annotations

import pytest
import respx

from telesign_mcp.client import TelesignClient
from telesign_mcp.models.intent import FraudScenario
from telesign_mcp.orchestrator import (
    FraudOrchestrator,
    build_execution_plan,
    classify_intent,
)

TELESIGN_BASE = "https://rest-api.telesign.com"


class TestOrchestratorFullPipeline:
    """End-to-end orchestrator tests with mocked HTTP."""

    @pytest.mark.asyncio
    async def test_account_creation_scenario(
        self,
        telesign_client: TelesignClient,
        mock_intelligence_success: respx.Route,
        mock_phoneid_success: respx.Route,
    ) -> None:
        """Account creation scenario runs intelligence + phone ID."""
        scenario = FraudScenario(
            scenario="New user creating account with phone number",
            phone_number="+15555550100",
            account_lifecycle_event="create",
        )

        orchestrator = FraudOrchestrator(telesign_client)
        result = await orchestrator.analyze(scenario)

        assert result.execution_plan.intent is not None
        assert result.aggregated_risk is not None
        assert result.aggregated_risk.recommended_action in ("allow", "flag", "challenge", "block")
        assert result.summary is not None
        assert len(result.tool_results) >= 1

    @pytest.mark.asyncio
    async def test_email_risk_scenario(
        self,
        telesign_client: TelesignClient,
        mock_email_success: respx.Route,
    ) -> None:
        """Email risk scenario runs email intelligence."""
        scenario = FraudScenario(
            scenario="Check email address for disposable or suspicious patterns",
            email_address="user@example.com",
        )

        orchestrator = FraudOrchestrator(telesign_client)
        result = await orchestrator.analyze(scenario)

        assert result.execution_plan.intent is not None
        assert result.aggregated_risk is not None
        assert mock_email_success.called

    @pytest.mark.asyncio
    async def test_comprehensive_multi_signal_scenario(
        self,
        telesign_client: TelesignClient,
        mock_intelligence_success: respx.Route,
        mock_phoneid_success: respx.Route,
        mock_email_success: respx.Route,
    ) -> None:
        """Comprehensive scenario with phone + email runs multiple tools."""
        scenario = FraudScenario(
            scenario="Verify new user identity with phone and email for account creation",
            phone_number="+15555550100",
            email_address="user@example.com",
            originating_ip="192.168.1.1",
            account_lifecycle_event="create",
        )

        orchestrator = FraudOrchestrator(telesign_client)
        result = await orchestrator.analyze(scenario)

        assert result.execution_plan.intent is not None
        assert result.aggregated_risk is not None
        assert len(result.tool_results) >= 2
        assert result.aggregated_risk.recommended_action in ("allow", "flag", "challenge", "block")

    @pytest.mark.asyncio
    async def test_result_is_serializable(
        self,
        telesign_client: TelesignClient,
        mock_intelligence_success: respx.Route,
    ) -> None:
        """OrchestratorResult can be serialized to dict for MCP transport."""
        scenario = FraudScenario(
            scenario="Score this phone for fraud risk",
            phone_number="+15555550100",
            account_lifecycle_event="transact",
        )

        orchestrator = FraudOrchestrator(telesign_client)
        result = await orchestrator.analyze(scenario)

        output = result.model_dump(exclude_none=True)
        assert isinstance(output, dict)
        assert "execution_plan" in output
        assert "aggregated_risk" in output
        assert "summary" in output

    @pytest.mark.asyncio
    async def test_partial_api_failure_still_produces_result(
        self,
        telesign_client: TelesignClient,
        mock_intelligence_success: respx.Route,
        respx_mock: respx.MockRouter,
    ) -> None:
        """If one tool fails (500), orchestrator still returns a result from others."""
        # PhoneID returns 500
        respx_mock.post(url__regex=r".*/v1/phoneid/\+?15555550100").respond(
            500,
            json={"status": {"code": 500, "description": "Internal Server Error"}},
        )

        scenario = FraudScenario(
            scenario="Verify identity for account creation with phone",
            phone_number="+15555550100",
            account_lifecycle_event="create",
        )

        orchestrator = FraudOrchestrator(telesign_client)
        result = await orchestrator.analyze(scenario)

        assert result.execution_plan.intent is not None
        assert result.aggregated_risk is not None
        assert result.aggregated_risk.confidence <= 1.0


class TestPlanOnly:
    """Tests for the plan-only endpoint (no execution)."""

    def test_plan_for_account_creation(self) -> None:
        """Plan for account creation recommends correct tools."""
        scenario = FraudScenario(
            scenario="New user signing up with phone number",
            phone_number="+15555550100",
            account_lifecycle_event="create",
        )

        intent = classify_intent(scenario)
        plan = build_execution_plan(scenario, intent)

        assert plan.intent is not None
        assert len(plan.tools) >= 1
        tool_names = [t.tool_name for t in plan.tools]
        assert "intelligence_score" in tool_names

    def test_plan_for_email_risk(self) -> None:
        """Plan for email risk recommends email intelligence."""
        scenario = FraudScenario(
            scenario="Check email for disposable or suspicious address",
            email_address="user@example.com",
        )

        intent = classify_intent(scenario)
        plan = build_execution_plan(scenario, intent)

        tool_names = [t.tool_name for t in plan.tools]
        assert "email_intelligence" in tool_names

    def test_plan_serializable(self) -> None:
        """Execution plan can be serialized to dict."""
        scenario = FraudScenario(
            scenario="Verify phone identity",
            phone_number="+15555550100",
        )

        intent = classify_intent(scenario)
        plan = build_execution_plan(scenario, intent)

        output = plan.model_dump(exclude_none=True)
        assert isinstance(output, dict)
        assert "tools" in output
        assert "strategy" in output
