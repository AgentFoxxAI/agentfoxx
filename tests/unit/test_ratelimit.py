"""Tests for sliding-window rate limiter."""

from __future__ import annotations

import time

import pytest

from telesign_mcp.ratelimit import RateLimitExceeded, SlidingWindowRateLimiter


class TestSlidingWindowRateLimiter:
    """Test rate limiter enforcement."""

    def test_allows_within_limit(self) -> None:
        limiter = SlidingWindowRateLimiter(max_requests=5, window_seconds=60.0)

        for _ in range(5):
            assert limiter.acquire() is True

    def test_rejects_over_limit(self) -> None:
        limiter = SlidingWindowRateLimiter(max_requests=3, window_seconds=60.0)

        for _ in range(3):
            limiter.acquire()

        with pytest.raises(RateLimitExceeded) as exc_info:
            limiter.acquire()

        assert exc_info.value.retry_after_seconds > 0

    def test_window_expiry_allows_new_requests(self) -> None:
        """After the window expires, new requests are allowed."""
        limiter = SlidingWindowRateLimiter(max_requests=2, window_seconds=0.1)

        limiter.acquire()
        limiter.acquire()

        # Wait for the window to expire
        time.sleep(0.15)

        # Should be allowed again
        assert limiter.acquire() is True

    def test_current_usage(self) -> None:
        limiter = SlidingWindowRateLimiter(max_requests=10, window_seconds=60.0)

        assert limiter.current_usage == 0

        limiter.acquire()
        limiter.acquire()

        assert limiter.current_usage == 2

    def test_remaining(self) -> None:
        limiter = SlidingWindowRateLimiter(max_requests=5, window_seconds=60.0)

        assert limiter.remaining == 5

        limiter.acquire()
        limiter.acquire()

        assert limiter.remaining == 3

    def test_status(self) -> None:
        limiter = SlidingWindowRateLimiter(max_requests=60, window_seconds=60.0)
        limiter.acquire()

        status = limiter.status()
        assert status["limit"] == 60
        assert status["window_seconds"] == 60.0
        assert status["current_usage"] == 1
        assert status["remaining"] == 59


class TestRateLimitExceeded:
    """Test rate limit exception."""

    def test_retry_after_attribute(self) -> None:
        exc = RateLimitExceeded(retry_after_seconds=15.5)
        assert exc.retry_after_seconds == 15.5
        assert "15.5" in str(exc)

    def test_message(self) -> None:
        exc = RateLimitExceeded(retry_after_seconds=5.0)
        assert "Rate limit exceeded" in str(exc)
