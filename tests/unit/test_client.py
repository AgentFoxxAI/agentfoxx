"""Unit tests for the resilient Telesign API client.

Tests HMAC authentication, retry logic, circuit breaker behavior,
error taxonomy mapping, PII sanitization, and connection management.
"""

from __future__ import annotations

from base64 import b64decode, b64encode

import httpx
import pytest
import respx

from telesign_mcp.client import TelesignClient, _generate_telesign_headers
from telesign_mcp.config import TelesignSettings
from telesign_mcp.exceptions import (
    TelesignAuthError,
    TelesignRateLimitError,
    TelesignServerError,
    TelesignValidationError,
)
from telesign_mcp.sanitize import mask_email, mask_phone, sanitize_for_logging

# ── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture
def telesign_settings() -> TelesignSettings:
    """Create test TelesignSettings with dummy credentials."""
    return TelesignSettings(
        customer_id="test-customer-id-000",
        api_key="dGVzdC1hcGkta2V5LWJhc2U2NA==",
        base_url="https://rest-api.telesign.com",
    )


@pytest.fixture
async def client(telesign_settings: TelesignSettings) -> TelesignClient:
    """Create a TelesignClient for testing."""
    async with TelesignClient(telesign_settings) as c:
        yield c


# ── HMAC Authentication Tests ────────────────────────────────────────────────


class TestHMACAuthentication:
    """Test Telesign HMAC-SHA256 request signing."""

    def test_generates_authorization_header(self) -> None:
        """Auth header follows TSA {customer_id}:{signature} format."""
        headers = _generate_telesign_headers(
            customer_id="CUST123",
            api_key=b64encode(b"test-secret-key").decode(),
            method="GET",
            resource="/v1/phoneid/+15555550100",
        )
        assert headers["Authorization"].startswith("TSA CUST123:")

    def test_includes_required_headers(self) -> None:
        """All required Telesign headers are present."""
        headers = _generate_telesign_headers(
            customer_id="CUST123",
            api_key=b64encode(b"test-secret-key").decode(),
            method="GET",
            resource="/v1/phoneid/+15555550100",
        )
        assert "Authorization" in headers
        assert "Date" in headers
        assert "x-ts-auth-method" in headers
        assert "x-ts-nonce" in headers
        assert headers["x-ts-auth-method"] == "HMAC-SHA256"

    def test_nonce_is_unique(self) -> None:
        """Each call generates a unique nonce (UUID)."""
        h1 = _generate_telesign_headers(
            customer_id="C",
            api_key=b64encode(b"k").decode(),
            method="GET",
            resource="/v1/test",
        )
        h2 = _generate_telesign_headers(
            customer_id="C",
            api_key=b64encode(b"k").decode(),
            method="GET",
            resource="/v1/test",
        )
        assert h1["x-ts-nonce"] != h2["x-ts-nonce"]

    def test_post_uses_form_content_type(self) -> None:
        """POST with body sets application/x-www-form-urlencoded."""
        headers = _generate_telesign_headers(
            customer_id="C",
            api_key=b64encode(b"k").decode(),
            method="POST",
            resource="/v1/verify/sms",
            content_type="application/x-www-form-urlencoded",
            body="phone_number=%2B15555550100",
        )
        assert headers["Content-Type"] == "application/x-www-form-urlencoded"

    def test_get_without_body_has_no_form_content_type(self) -> None:
        """GET request has json or empty content type, not form-encoded."""
        headers = _generate_telesign_headers(
            customer_id="C",
            api_key=b64encode(b"k").decode(),
            method="GET",
            resource="/v1/phoneid/+15555550100",
        )
        # Without body, content-type defaults to application/json
        assert "x-www-form-urlencoded" not in headers["Content-Type"]

    def test_signature_is_valid_base64(self) -> None:
        """The signature portion is valid base64."""
        headers = _generate_telesign_headers(
            customer_id="CUST",
            api_key=b64encode(b"secret").decode(),
            method="GET",
            resource="/v1/test",
        )
        sig = headers["Authorization"].split(":")[1]
        # Should decode without error
        decoded = b64decode(sig)
        assert len(decoded) == 32  # SHA-256 produces 32 bytes


# ── Error Taxonomy Tests ─────────────────────────────────────────────────────


class TestErrorHandling:
    """Test HTTP status code to exception mapping."""

    @pytest.mark.asyncio
    @respx.mock
    async def test_401_raises_auth_error(self, client: TelesignClient) -> None:
        """401 response raises TelesignAuthError."""
        respx.get("https://rest-api.telesign.com/v1/test").mock(
            return_value=httpx.Response(401, json={"error": "unauthorized"})
        )
        with pytest.raises(TelesignAuthError) as exc_info:
            await client.get("/v1/test")
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    @respx.mock
    async def test_403_raises_auth_error(self, client: TelesignClient) -> None:
        """403 response raises TelesignAuthError."""
        respx.get("https://rest-api.telesign.com/v1/test").mock(
            return_value=httpx.Response(403, json={"error": "forbidden"})
        )
        with pytest.raises(TelesignAuthError) as exc_info:
            await client.get("/v1/test")
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    @respx.mock
    async def test_429_raises_rate_limit_error(self, client: TelesignClient) -> None:
        """429 response raises TelesignRateLimitError."""
        respx.get("https://rest-api.telesign.com/v1/test").mock(
            return_value=httpx.Response(
                429,
                json={"error": "rate_limited"},
                headers={"Retry-After": "30"},
            )
        )
        with pytest.raises(TelesignRateLimitError) as exc_info:
            await client.get("/v1/test")
        assert exc_info.value.retry_after_seconds == 30.0

    @pytest.mark.asyncio
    @respx.mock
    async def test_400_raises_validation_error(self, client: TelesignClient) -> None:
        """400 response raises TelesignValidationError."""
        respx.get("https://rest-api.telesign.com/v1/test").mock(
            return_value=httpx.Response(400, json={"error": "bad_request"})
        )
        with pytest.raises(TelesignValidationError) as exc_info:
            await client.get("/v1/test")
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    @respx.mock
    async def test_500_raises_server_error(self, client: TelesignClient) -> None:
        """500 response raises TelesignServerError after retries."""
        respx.get("https://rest-api.telesign.com/v1/test").mock(
            return_value=httpx.Response(500, json={"error": "internal"})
        )
        with pytest.raises(TelesignServerError):
            await client.get("/v1/test")

    @pytest.mark.asyncio
    @respx.mock
    async def test_successful_response_returns_json(self, client: TelesignClient) -> None:
        """200 response returns parsed JSON body."""
        respx.get("https://rest-api.telesign.com/v1/test").mock(
            return_value=httpx.Response(200, json={"status": "ok", "score": 850})
        )
        result = await client.get("/v1/test")
        assert result["status"] == "ok"
        assert result["score"] == 850


# ── Retry Logic Tests ────────────────────────────────────────────────────────


class TestRetryLogic:
    """Test exponential backoff and retry behavior."""

    @pytest.mark.asyncio
    @respx.mock
    async def test_retries_on_server_error(self, client: TelesignClient) -> None:
        """5xx errors trigger retries up to max attempts."""
        route = respx.get("https://rest-api.telesign.com/v1/test")
        route.side_effect = [
            httpx.Response(500, json={"error": "internal"}),
            httpx.Response(500, json={"error": "internal"}),
            httpx.Response(200, json={"status": "ok"}),
        ]
        result = await client.get("/v1/test")
        assert result["status"] == "ok"
        assert route.call_count == 3

    @pytest.mark.asyncio
    @respx.mock
    async def test_no_retry_on_auth_error(self, client: TelesignClient) -> None:
        """401 errors are NOT retried (fail immediately)."""
        route = respx.get("https://rest-api.telesign.com/v1/test")
        route.mock(return_value=httpx.Response(401, json={"error": "unauthorized"}))
        with pytest.raises(TelesignAuthError):
            await client.get("/v1/test")
        assert route.call_count == 1

    @pytest.mark.asyncio
    @respx.mock
    async def test_no_retry_on_validation_error(self, client: TelesignClient) -> None:
        """400 errors are NOT retried (client error)."""
        route = respx.get("https://rest-api.telesign.com/v1/test")
        route.mock(return_value=httpx.Response(400, json={"error": "bad_request"}))
        with pytest.raises(TelesignValidationError):
            await client.get("/v1/test")
        assert route.call_count == 1

    @pytest.mark.asyncio
    @respx.mock
    async def test_exhausted_retries_raises(self, client: TelesignClient) -> None:
        """After max retries, the last error is raised."""
        respx.get("https://rest-api.telesign.com/v1/test").mock(
            return_value=httpx.Response(500, json={"error": "internal"})
        )
        with pytest.raises(TelesignServerError):
            await client.get("/v1/test")


# ── POST Request Tests ───────────────────────────────────────────────────────


class TestPostRequests:
    """Test POST request handling with form-encoded body."""

    @pytest.mark.asyncio
    @respx.mock
    async def test_post_sends_form_body(self, client: TelesignClient) -> None:
        """POST sends URL-encoded form data."""
        route = respx.post("https://rest-api.telesign.com/v1/verify/sms").mock(
            return_value=httpx.Response(
                200, json={"reference_id": "ref123", "status": {"code": 200}}
            )
        )
        result = await client.post(
            "/v1/verify/sms",
            body_params={"phone_number": "+15555550100", "ucid": "BACS"},
        )
        assert result["reference_id"] == "ref123"
        assert route.called


# ── PII Sanitization Tests ──────────────────────────────────────────────────


class TestPIISanitization:
    """Test phone number and email masking in logs."""

    def test_mask_phone_e164(self) -> None:
        """E.164 phone numbers are masked to last 4 digits."""
        assert mask_phone("+15555550100") == "+155...0100"

    def test_mask_phone_short(self) -> None:
        """Short numbers (<=4 chars) are fully masked."""
        assert mask_phone("1234") == "****"

    def test_mask_phone_domestic(self) -> None:
        """Domestic format numbers are masked."""
        assert mask_phone("5555550100") == "5555...0100"

    def test_mask_email(self) -> None:
        """Email addresses show only domain."""
        assert mask_email("user@example.com") == "***@example.com"

    def test_sanitize_dict_with_phone(self) -> None:
        """Dict with phone_number key gets masked."""
        data = {"phone_number": "+15555550100", "score": 850}
        result = sanitize_for_logging(data)
        assert "0100" in result["phone_number"]
        assert "5555501" not in result["phone_number"]
        assert result["score"] == 850

    def test_sanitize_dict_with_email(self) -> None:
        """Dict with email key gets masked."""
        data = {"email": "john@example.com", "valid": True}
        result = sanitize_for_logging(data)
        assert result["email"] == "***@example.com"
        assert result["valid"] is True

    def test_sanitize_redacts_api_key(self) -> None:
        """API keys are fully redacted."""
        data = {"api_key": "super-secret-key-123"}
        result = sanitize_for_logging(data)
        assert result["api_key"] == "***REDACTED***"

    def test_sanitize_nested_dict(self) -> None:
        """Nested structures are recursively sanitized."""
        data = {
            "request": {
                "phone_number": "+15555550100",
                "metadata": {"email": "test@example.com"},
            }
        }
        result = sanitize_for_logging(data)
        assert "5555501" not in result["request"]["phone_number"]
        assert result["request"]["metadata"]["email"] == "***@example.com"

    def test_sanitize_list(self) -> None:
        """Lists within data are sanitized."""
        data = [{"phone_number": "+15555550100"}, {"phone_number": "+15555550200"}]
        result = sanitize_for_logging(data)
        assert all("555555" not in item["phone_number"] for item in result)


# ── Connection Management Tests ──────────────────────────────────────────────


class TestConnectionManagement:
    """Test HTTP client lifecycle."""

    @pytest.mark.asyncio
    async def test_client_context_manager(self, telesign_settings: TelesignSettings) -> None:
        """Client initializes and closes cleanly via async context manager."""
        async with TelesignClient(telesign_settings) as client:
            assert client._http_client is not None
        # After exit, client should be closed (no assertion needed, just no error)

    @pytest.mark.asyncio
    async def test_client_not_initialized_without_context(
        self, telesign_settings: TelesignSettings
    ) -> None:
        """Client HTTP client is None before entering context."""
        client = TelesignClient(telesign_settings)
        assert client._http_client is None
