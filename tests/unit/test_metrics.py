"""Tests for in-memory metrics tracking."""

from __future__ import annotations

import time

from telesign_mcp.metrics import ServerMetrics


class TestServerMetrics:
    """Test centralized metrics collector."""

    def test_initial_snapshot(self) -> None:
        metrics = ServerMetrics()
        snap = metrics.snapshot()

        assert snap["total_requests"] == 0
        assert snap["total_errors"] == 0
        assert snap["error_rate"] == 0.0
        assert snap["rate_limit_rejections"] == 0
        assert snap["tools"] == {}
        assert snap["error_types"] == {}
        assert snap["uptime_seconds"] >= 0

    def test_record_successful_tool_call(self) -> None:
        metrics = ServerMetrics()
        metrics.record_tool_call("intelligence_score", 150.0, success=True)

        snap = metrics.snapshot()
        assert snap["total_requests"] == 1
        assert snap["total_errors"] == 0
        assert "intelligence_score" in snap["tools"]
        assert snap["tools"]["intelligence_score"]["calls"] == 1
        assert snap["tools"]["intelligence_score"]["errors"] == 0
        assert snap["tools"]["intelligence_score"]["error_rate"] == 0.0

    def test_record_failed_tool_call(self) -> None:
        metrics = ServerMetrics()
        metrics.record_tool_call("intelligence_score", 50.0, success=False)

        snap = metrics.snapshot()
        assert snap["total_requests"] == 1
        assert snap["total_errors"] == 1
        assert snap["error_rate"] == 1.0
        assert snap["tools"]["intelligence_score"]["errors"] == 1
        assert snap["tools"]["intelligence_score"]["error_rate"] == 1.0

    def test_multiple_tool_calls(self) -> None:
        metrics = ServerMetrics()
        metrics.record_tool_call("intelligence_score", 100.0, success=True)
        metrics.record_tool_call("intelligence_score", 200.0, success=True)
        metrics.record_tool_call("phone_identity_deep_check", 150.0, success=True)
        metrics.record_tool_call("phone_identity_deep_check", 50.0, success=False)

        snap = metrics.snapshot()
        assert snap["total_requests"] == 4
        assert snap["total_errors"] == 1
        assert snap["tools"]["intelligence_score"]["calls"] == 2
        assert snap["tools"]["phone_identity_deep_check"]["calls"] == 2
        assert snap["tools"]["phone_identity_deep_check"]["errors"] == 1

    def test_latency_percentiles(self) -> None:
        metrics = ServerMetrics()
        for i in range(100):
            metrics.record_tool_call("test_tool", float(i + 1), success=True)

        snap = metrics.snapshot()
        lat = snap["tools"]["test_tool"]["latency"]
        assert lat["count"] == 100
        assert lat["p50"] is not None
        assert lat["p95"] is not None
        assert lat["p99"] is not None
        # p50 should be around 50, p95 around 95
        assert 45 <= lat["p50"] <= 55
        assert 90 <= lat["p95"] <= 100

    def test_record_error_type(self) -> None:
        metrics = ServerMetrics()
        metrics.record_error("TelesignAuthError")
        metrics.record_error("TelesignAuthError")
        metrics.record_error("TelesignServerError")

        snap = metrics.snapshot()
        assert snap["error_types"]["TelesignAuthError"] == 2
        assert snap["error_types"]["TelesignServerError"] == 1

    def test_record_rate_limit_rejection(self) -> None:
        metrics = ServerMetrics()
        metrics.record_rate_limit_rejection()
        metrics.record_rate_limit_rejection()

        snap = metrics.snapshot()
        assert snap["rate_limit_rejections"] == 2

    def test_uptime_increases(self) -> None:
        metrics = ServerMetrics()
        time.sleep(0.05)
        assert metrics.uptime_seconds >= 0.04

    def test_empty_latency_percentiles(self) -> None:
        metrics = ServerMetrics()
        metrics.record_tool_call("test_tool", 100.0, success=True)
        snap = metrics.snapshot()

        lat = snap["tools"]["test_tool"]["latency"]
        assert lat["count"] == 1
        assert lat["p50"] == 100.0
