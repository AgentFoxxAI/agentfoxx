"""Shared test fixtures for Telesign MCP Server tests.

Provides mock configurations, fake credentials, and common
test utilities used across unit and integration test suites.
"""

from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _mock_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ensure tests never use real credentials.

    Sets dummy environment variables so pydantic-settings
    doesn't fail during test collection. Real integration
    tests override these with pytest marks.
    """
    monkeypatch.setenv("TELESIGN_CUSTOMER_ID", "test-customer-id-000")
    monkeypatch.setenv("TELESIGN_API_KEY", "dGVzdC1hcGkta2V5LWJhc2U2NA==")  # base64 dummy


@pytest.fixture
def sample_phone_e164() -> str:
    """Return a valid E.164 formatted test phone number."""
    return "+15555550100"


@pytest.fixture
def sample_email() -> str:
    """Return a test email address."""
    return "test@example.com"
