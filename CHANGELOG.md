# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-03-11

### Added

- **MCP Server** — FastMCP-based server with stdio transport and structured lifespan management.
- **Telesign API Client** — Resilient HTTP client with HMAC-SHA256 authentication, configurable retries with exponential backoff, circuit breaker pattern, and connection pooling.
- **Intelligence Score tool** — Phone number risk scoring via Telesign Score API with optional IP and email enrichment signals.
- **Phone Identity Deep Check tool** — Carrier, line type, and numbering intelligence via Telesign PhoneID API with enrichment add-ons.
- **Adaptive Verify Send tool** — OTP delivery via SMS with support for custom codes and message templates.
- **Adaptive Verify Status tool** — OTP verification status checking against reference IDs.
- **Email Intelligence tool** — Email address risk assessment with optional phone cross-referencing via Score API.
- **Fraud Intent Analysis tool** — Intent-driven orchestration that classifies fraud scenarios and executes multi-tool analysis plans with aggregated risk scoring.
- **Fraud Intent Plan tool** — Plan-only endpoint for previewing execution strategy without running API calls.
- **Health Check tool** — Server health, uptime, rate limiter status, and metrics snapshot.
- **Sliding-window rate limiter** — Configurable requests-per-minute enforcement with automatic expiry.
- **In-memory metrics** — Per-tool call counts, latency percentiles (p50/p95/p99), error rates, and error-type tracking.
- **Structured logging** — JSON-formatted logs via structlog with PII masking for phone numbers and emails.
- **Input validation** — Pydantic v2 models with strict E.164 phone validation and email format checking.
- **Consistent error envelopes** — Typed error responses with retry hints for rate limits, circuit breaker, and transient failures.
- **CI/CD** — GitHub Actions workflows for linting, multi-version testing (3.10–3.12), Docker image builds, and automated releases.
- **Comprehensive test suite** — 272 tests covering unit, integration, end-to-end, fault tolerance, and lifecycle scenarios.

[1.0.0]: https://github.com/AgentFoxxAI/TS-MCP-Server/releases/tag/v1.0.0
