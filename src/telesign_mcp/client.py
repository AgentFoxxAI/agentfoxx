"""Resilient Telesign HTTP client with HMAC authentication.

Provides connection pooling, retry logic with exponential backoff,
circuit breaker pattern, and PII-sanitized logging.
"""

from __future__ import annotations

import hashlib
import hmac
import uuid
from base64 import b64decode, b64encode
from datetime import datetime, timezone
from email.utils import formatdate
from time import mktime
from typing import Any
from urllib.parse import urlencode

import httpx
from circuitbreaker import CircuitBreakerError, circuit
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from telesign_mcp.config import TelesignSettings
from telesign_mcp.exceptions import (
    CircuitOpenError,
    TelesignAuthError,
    TelesignRateLimitError,
    TelesignServerError,
    TelesignTimeoutError,
    TelesignValidationError,
)
from telesign_mcp.logging import get_logger
from telesign_mcp.sanitize import sanitize_for_logging

logger = get_logger(__name__)


def _generate_telesign_headers(
    customer_id: str,
    api_key: str,
    method: str,
    resource: str,
    content_type: str = "",
    body: str = "",
) -> dict[str, str]:
    """Generate Telesign HMAC-SHA256 authentication headers.

    Implements the Telesign REST API signing specification:
    https://developer.telesign.com/enterprise/docs/authentication

    Args:
        customer_id: Telesign Customer ID.
        api_key: Base64-encoded Telesign API key.
        method: HTTP method (GET, POST, PUT, DELETE).
        resource: API resource path (e.g., /v1/phoneid/15555550100).
        content_type: Content-Type header value.
        body: URL-encoded request body (for POST/PUT).

    Returns:
        Dict of authentication headers to include in the request.
    """
    now = datetime.now(timezone.utc)
    date_rfc2616 = formatdate(timeval=mktime(now.timetuple()), usegmt=True)
    nonce = str(uuid.uuid4())
    auth_method = "HMAC-SHA256"

    # Build string-to-sign per Telesign spec
    # Headers starting with x-ts- MUST be in alphabetical order
    parts = [method.upper()]
    parts.append(f"\n{content_type}")
    parts.append(f"\n{date_rfc2616}")
    parts.append(f"\nx-ts-auth-method:{auth_method}")
    parts.append(f"\nx-ts-nonce:{nonce}")

    if content_type and body:
        parts.append(f"\n{body}")

    parts.append(f"\n{resource}")

    string_to_sign = "".join(parts)

    # Generate HMAC-SHA256 signature
    decoded_key = b64decode(api_key)
    signer = hmac.new(decoded_key, string_to_sign.encode("utf-8"), hashlib.sha256)
    signature = b64encode(signer.digest()).decode("utf-8")

    return {
        "Authorization": f"TSA {customer_id}:{signature}",
        "Date": date_rfc2616,
        "Content-Type": content_type or "application/json",
        "x-ts-auth-method": auth_method,
        "x-ts-nonce": nonce,
    }


class TelesignClient:
    """Async HTTP client for Telesign REST API.

    Implements HMAC-SHA256 request signing, connection pooling,
    and fault tolerance patterns (retries + circuit breaker).

    Usage:
        async with TelesignClient(settings) as client:
            result = await client.get("/v1/phoneid/+15555550100")
    """

    def __init__(self, settings: TelesignSettings) -> None:
        self._settings = settings
        self._customer_id = settings.customer_id
        self._api_key = settings.api_key
        self._base_url = settings.base_url

        # Configure circuit breaker from settings
        self._circuit_breaker = circuit(
            failure_threshold=settings.circuit_breaker_failure_threshold,
            recovery_timeout=settings.circuit_breaker_recovery_timeout,
            expected_exception=TelesignServerError,
        )

        self._http_client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> TelesignClient:
        """Initialize HTTP client with connection pooling."""
        self._http_client = httpx.AsyncClient(
            base_url=self._base_url,
            limits=httpx.Limits(
                max_connections=self._settings.max_connections,
                max_keepalive_connections=self._settings.max_connections_per_host,
            ),
            timeout=httpx.Timeout(
                connect=self._settings.connect_timeout,
                read=self._settings.read_timeout,
                write=10.0,
                pool=5.0,
            ),
            http2=True,
        )
        logger.info(
            "telesign_client_initialized",
            base_url=self._base_url,
            max_connections=self._settings.max_connections,
        )
        return self

    async def __aexit__(self, *args: Any) -> None:
        """Close HTTP client and release connections."""
        if self._http_client:
            await self._http_client.aclose()
            logger.info("telesign_client_closed")

    def _sign_request(
        self,
        method: str,
        resource: str,
        body: str = "",
    ) -> dict[str, str]:
        """Generate authentication headers for a request.

        Args:
            method: HTTP method.
            resource: API resource path.
            body: URL-encoded body for POST/PUT.

        Returns:
            Authentication headers dict.
        """
        content_type = (
            "application/x-www-form-urlencoded"
            if method.upper() in ("POST", "PUT") and body
            else ""
        )
        return _generate_telesign_headers(
            customer_id=self._customer_id,
            api_key=self._api_key,
            method=method,
            resource=resource,
            content_type=content_type,
            body=body,
        )

    def _raise_for_status(self, response: httpx.Response) -> None:
        """Map HTTP status codes to typed exceptions.

        Args:
            response: httpx response object.

        Raises:
            TelesignAuthError: For 401/403 responses.
            TelesignRateLimitError: For 429 responses.
            TelesignValidationError: For 400 responses.
            TelesignServerError: For 5xx responses.
        """
        status = response.status_code
        if 200 <= status < 300:
            return

        try:
            body = response.json()
        except Exception:
            body = {"raw": response.text[:500]}

        if status in (401, 403):
            raise TelesignAuthError(
                f"Telesign authentication failed: {status}",
                status_code=status,
                response_body=body,
            )
        elif status == 429:
            retry_after = response.headers.get("Retry-After")
            retry_seconds = float(retry_after) if retry_after else None
            raise TelesignRateLimitError(
                "Telesign rate limit exceeded",
                retry_after_seconds=retry_seconds,
                status_code=status,
                response_body=body,
            )
        elif status == 400:
            raise TelesignValidationError(
                f"Telesign validation error: {body}",
                status_code=status,
                response_body=body,
            )
        elif status >= 500:
            raise TelesignServerError(
                f"Telesign server error: {status}",
                status_code=status,
                response_body=body,
            )

    @retry(
        retry=retry_if_exception_type((TelesignServerError, TelesignTimeoutError)),
        wait=wait_exponential_jitter(initial=1, max=30, jitter=2),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    async def _execute_request(
        self,
        method: str,
        resource: str,
        params: dict[str, Any] | None = None,
        body_params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Execute an HTTP request with retry logic.

        This is the core request method wrapped with tenacity retry
        for transient failures (5xx, timeouts).

        Args:
            method: HTTP method.
            resource: API resource path (e.g., /v1/phoneid/+15555550100).
            params: Query string parameters.
            body_params: Form body parameters (for POST/PUT).

        Returns:
            Parsed JSON response body.

        Raises:
            TelesignAuthError: For 401/403.
            TelesignRateLimitError: For 429.
            TelesignValidationError: For 400.
            TelesignServerError: For 5xx (after retries exhausted).
            TelesignTimeoutError: On timeout (after retries exhausted).
        """
        assert self._http_client is not None, "Client not initialized. Use async with."

        body = urlencode(body_params) if body_params else ""
        headers = self._sign_request(method, resource, body)

        # Log request (sanitized)
        logger.debug(
            "telesign_request",
            method=method,
            resource=resource,
            params=sanitize_for_logging(params or {}),
        )

        try:
            response = await self._http_client.request(
                method=method,
                url=resource,
                params=params,
                content=body if body else None,
                headers=headers,
            )
        except httpx.TimeoutException as exc:
            logger.warning("telesign_timeout", resource=resource)
            raise TelesignTimeoutError(f"Request to {resource} timed out") from exc
        except httpx.ConnectError as exc:
            logger.error("telesign_connection_error", resource=resource, error=str(exc))
            raise TelesignServerError(f"Connection to Telesign failed: {exc}") from exc

        self._raise_for_status(response)

        result = response.json()

        # Log response (sanitized)
        logger.debug(
            "telesign_response",
            resource=resource,
            status=response.status_code,
            body=sanitize_for_logging(result),
        )

        return result

    async def get(
        self,
        resource: str,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Execute a GET request to the Telesign API.

        Args:
            resource: API resource path.
            params: Query string parameters.

        Returns:
            Parsed JSON response.

        Raises:
            CircuitOpenError: If circuit breaker is open.
        """
        try:
            return await self._circuit_breaker(self._execute_request)(
                "GET", resource, params=params
            )
        except CircuitBreakerError as err:
            raise CircuitOpenError(
                "Circuit breaker is open — Telesign API is experiencing failures. "
                "Requests will resume automatically after recovery timeout."
            ) from err

    async def post(
        self,
        resource: str,
        body_params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Execute a POST request to the Telesign API.

        Args:
            resource: API resource path.
            body_params: Form-encoded body parameters.

        Returns:
            Parsed JSON response.

        Raises:
            CircuitOpenError: If circuit breaker is open.
        """
        try:
            return await self._circuit_breaker(self._execute_request)(
                "POST", resource, body_params=body_params
            )
        except CircuitBreakerError as err:
            raise CircuitOpenError(
                "Circuit breaker is open — Telesign API is experiencing failures. "
                "Requests will resume automatically after recovery timeout."
            ) from err
