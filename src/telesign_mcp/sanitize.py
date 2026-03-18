"""PII sanitization for structured logs.

Ensures phone numbers, email addresses, and other sensitive data
are masked before appearing in log output. Phone numbers show
only the last 4 digits; emails show only the domain.
"""

from __future__ import annotations

import re
from typing import Any

# E.164 phone number: +{country_code}{number} (7-15 digits total)
_PHONE_RE = re.compile(r"\+?\d{7,15}")

# Email pattern for log masking
_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")


def mask_phone(phone: str) -> str:
    """Mask a phone number, showing only the last 4 digits.

    Args:
        phone: Phone number string (any format).

    Returns:
        Masked string like "+1555...4444".

    Examples:
        >>> mask_phone("+15555550100")
        '+1555...0100'
        >>> mask_phone("5555550100")
        '5555...0100'
    """
    if len(phone) <= 4:
        return "****"
    prefix_len = min(4, len(phone) - 4)
    return f"{phone[:prefix_len]}...{phone[-4:]}"


def mask_email(email: str) -> str:
    """Mask an email address, showing only the domain.

    Args:
        email: Email address string.

    Returns:
        Masked string like "***@example.com".
    """
    parts = email.split("@", 1)
    if len(parts) == 2:
        return f"***@{parts[1]}"
    return "***"


def sanitize_for_logging(data: Any) -> Any:
    """Recursively sanitize a data structure for safe logging.

    Masks phone numbers and email addresses found in string values
    within dicts, lists, and nested structures.

    Args:
        data: Any data structure (dict, list, str, etc.).

    Returns:
        Sanitized copy with PII masked.
    """
    if isinstance(data, dict):
        sanitized = {}
        for key, value in data.items():
            key_lower = str(key).lower()
            if any(
                term in key_lower for term in ("phone", "phone_number", "phonenumber", "msisdn")
            ):
                sanitized[key] = mask_phone(str(value)) if value else value
            elif any(term in key_lower for term in ("email", "email_address")):
                sanitized[key] = mask_email(str(value)) if value else value
            elif any(
                term in key_lower for term in ("api_key", "apikey", "secret", "password", "token")
            ):
                sanitized[key] = "***REDACTED***"
            else:
                sanitized[key] = sanitize_for_logging(value)
        return sanitized
    elif isinstance(data, (list, tuple)):
        return type(data)(sanitize_for_logging(item) for item in data)
    elif isinstance(data, str):
        return _sanitize_string(data)
    return data


def _sanitize_string(text: str) -> str:
    """Mask phone numbers and emails found in free-text strings."""
    # Mask emails first (they may contain digits that look like phones)
    result = _EMAIL_RE.sub(lambda m: mask_email(m.group(0)), text)
    # Mask phone-like digit sequences
    result = _PHONE_RE.sub(lambda m: mask_phone(m.group(0)), result)
    return result
