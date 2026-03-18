"""Fraud intent classification and orchestration plan models.

Defines the data structures for the intent engine:
    - FraudScenario: What the caller is trying to assess
    - ToolRecommendation: Which tool to run, with what params
    - ExecutionPlan: Ordered set of tool calls with parallelism hints
    - OrchestratorResult: Complete analysis output
"""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class FraudIntent(str, Enum):
    """High-level fraud intent classifications.

    Each intent maps to a specific combination of Telesign tools
    that provides the most relevant signals for that use case.
    """

    ACCOUNT_CREATION = "account_creation"
    ACCOUNT_TAKEOVER = "account_takeover"
    TRANSACTION_RISK = "transaction_risk"
    IDENTITY_VERIFICATION = "identity_verification"
    PHONE_REPUTATION = "phone_reputation"
    EMAIL_RISK = "email_risk"
    MULTI_FACTOR_AUTH = "multi_factor_auth"
    COMPREHENSIVE_CHECK = "comprehensive_check"


class ExecutionStrategy(str, Enum):
    """How to execute multiple tool calls."""

    PARALLEL = "parallel"
    SEQUENTIAL = "sequential"
    CONDITIONAL = "conditional"  # Run next only if previous flags risk


class RiskAction(str, Enum):
    """Recommended action based on aggregated risk."""

    ALLOW = "allow"
    FLAG = "flag"
    CHALLENGE = "challenge"  # Require additional verification
    BLOCK = "block"


# ---------------------------------------------------------------------------
# Input model
# ---------------------------------------------------------------------------


class FraudScenario(BaseModel):
    """Input describing the fraud scenario to analyze.

    The orchestrator uses these signals to determine which tools
    to invoke and in what order.
    """

    scenario: str = Field(
        ...,
        description=(
            "Natural language description of the fraud scenario, e.g., "
            "'New user creating account with a VOIP number from Nigeria'"
        ),
        min_length=5,
    )
    phone_number: str | None = Field(
        default=None,
        description="Phone number in E.164 format, if available",
    )
    email_address: str | None = Field(
        default=None,
        description="Email address to evaluate, if available",
    )
    originating_ip: str | None = Field(
        default=None,
        description="End-user IP address, if available",
    )
    account_lifecycle_event: str | None = Field(
        default=None,
        description="Lifecycle event: create, sign-in, transact, update, delete",
    )


# ---------------------------------------------------------------------------
# Recommendation models
# ---------------------------------------------------------------------------


class ToolRecommendation(BaseModel):
    """A single tool invocation recommendation."""

    tool_name: str = Field(description="MCP tool name to invoke (e.g., 'intelligence_score')")
    priority: int = Field(
        description="Execution priority (1 = highest, run first)",
        ge=1,
        le=10,
    )
    rationale: str = Field(description="Why this tool is recommended for this scenario")
    parameters: dict[str, Any] = Field(
        default_factory=dict,
        description="Suggested parameters for the tool call",
    )
    required: bool = Field(
        default=True,
        description="Whether this tool is required or optional for the scenario",
    )


class ExecutionPlan(BaseModel):
    """Ordered plan of tool invocations for a fraud scenario."""

    intent: FraudIntent = Field(description="Classified fraud intent")
    strategy: ExecutionStrategy = Field(description="How to execute the tools")
    tools: list[ToolRecommendation] = Field(description="Ordered list of tool recommendations")
    explanation: str = Field(description="Human-readable explanation of the analysis plan")


# ---------------------------------------------------------------------------
# Output models
# ---------------------------------------------------------------------------


class AggregatedRisk(BaseModel):
    """Combined risk assessment from multiple tool results."""

    overall_score: int | None = Field(
        default=None,
        description="Aggregated risk score 0-1000",
    )
    overall_level: str | None = Field(
        default=None,
        description="Aggregated risk level",
    )
    recommended_action: RiskAction = Field(
        description="Recommended action based on combined signals"
    )
    risk_signals: list[str] = Field(
        default_factory=list,
        description="Individual risk signals detected across tools",
    )
    confidence: float = Field(
        default=0.0,
        description="Confidence in the assessment (0.0-1.0)",
        ge=0.0,
        le=1.0,
    )


class ToolResult(BaseModel):
    """Result from a single tool execution within the orchestrator."""

    tool_name: str
    success: bool
    data: dict[str, Any] | None = None
    error: str | None = None
    execution_time_ms: float | None = None


class OrchestratorResult(BaseModel):
    """Complete output from the fraud intent analysis orchestrator.

    Contains the execution plan, individual tool results, and
    an aggregated risk assessment across all signals.
    """

    scenario: str = Field(description="Original scenario description")
    execution_plan: ExecutionPlan = Field(description="The plan that was executed")
    tool_results: list[ToolResult] = Field(
        default_factory=list,
        description="Results from each tool invocation",
    )
    aggregated_risk: AggregatedRisk = Field(description="Combined risk assessment")
    summary: str = Field(
        description=(
            "Human-readable summary of findings, suitable for "
            "LLM consumption and downstream reasoning"
        ),
    )
