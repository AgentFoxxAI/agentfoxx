# Architecture

Production MCP server exposing Telesign fraud intelligence APIs through intent-driven orchestration.

## System Overview

```
LLM Client (Claude, GPT, etc.)
      │
      ▼
┌─────────────────────────────────────────────────┐
│            FastMCP Transport Layer               │
│         (stdio / SSE / streamable-http)          │
├─────────────────────────────────────────────────┤
│  Rate Limiter  │  Metrics  │  Structured Logging │
├─────────────────────────────────────────────────┤
│              MCP Tool Registry                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Intel    │ │ PhoneID  │ │ Fraud Orchestrator│ │
│  │ Score    │ │ Deep     │ │ (Meta-Tool)       │ │
│  ├──────────┤ ├──────────┤ │  classify_intent  │ │
│  │ Verify   │ │ Email    │ │  build_plan       │ │
│  │ Send/    │ │ Intel    │ │  execute_plan     │ │
│  │ Status   │ │          │ │  aggregate_risk   │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
├─────────────────────────────────────────────────┤
│           TelesignClient (HMAC Auth)             │
│     Retry (tenacity) + Circuit Breaker           │
│          HTTP/2 Connection Pool (httpx)          │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
          Telesign REST API
```

## Module Map

| Module | Purpose |
|---|---|
| `server.py` | FastMCP server factory, tool registration, lifespan management |
| `client.py` | Resilient HTTP client with HMAC-SHA256 signing, retries, circuit breaker |
| `config.py` | Pydantic-settings configuration from environment variables |
| `orchestrator.py` | Intent classification, execution planning, risk aggregation |
| `models/schemas.py` | Pydantic v2 models for tool inputs and API responses |
| `models/intent.py` | Pydantic models for fraud intents and orchestration results |
| `tools/*.py` | Individual tool implementations (intelligence, phone_id, verify, email) |
| `tools/_helpers.py` | Shared error mapping and response envelope formatting |
| `metrics.py` | In-memory metrics: per-tool latency percentiles, error rates, uptime |
| `ratelimit.py` | Sliding-window rate limiter for tool invocation throttling |
| `logging.py` | structlog configuration with JSON/console output |
| `sanitize.py` | PII masking for phone numbers, emails, and API keys in logs |
| `exceptions.py` | Typed exception hierarchy for all Telesign API failure modes |

## Fault Tolerance

The client implements three layers of fault tolerance. Retries use tenacity with exponential backoff and jitter (initial 1s, max 30s) for transient 5xx errors and timeouts only; 4xx errors are never retried. The circuit breaker (configurable via `TELESIGN_CIRCUIT_BREAKER_*` env vars) opens after N consecutive `TelesignServerError` failures and rejects all requests for a recovery period before half-opening. Rate limiting uses a sliding-window algorithm enforcing N requests per minute (configurable via `RATE_LIMIT_PER_MINUTE`), protecting both the server and upstream Telesign quotas.

## Intent-Driven Orchestration

The fraud orchestrator classifies natural-language scenarios into one of 8 intents (account creation, ATO, transaction risk, identity verification, phone reputation, email risk, MFA, comprehensive check) using keyword scoring boosted by lifecycle events and available signals. Each intent maps to a tool combination with priority-based execution: same-priority tools run in parallel via `asyncio.gather`, different priorities run sequentially. Risk aggregation averages scores across tools, detects high-risk signals (VOIP, prepaid, disposable email), and applies intent-sensitive thresholds — account creation and transaction intents use stricter thresholds than reputation checks.

## Observability

Every tool invocation records latency (p50/p95/p99), success/failure counts, and error type distribution in the in-memory `ServerMetrics` collector. The `health_check` tool exposes a full metrics snapshot including uptime, rate limiter status, per-tool performance, and error rates. All log entries are structured JSON (production) or colored console (development), with PII automatically redacted before emission.

## Configuration

All settings are loaded from environment variables (with `.env` file support) using pydantic-settings. Telesign credentials use the `TELESIGN_` prefix. The server validates all configuration at startup and fails fast on missing or invalid values.

## Docker

The Dockerfile uses a multi-stage build: stage 1 builds the wheel, stage 2 installs it in a clean slim image running as a non-root `mcp` user. The default entrypoint runs stdio transport; override via `TRANSPORT` environment variable for SSE or streamable-http.
