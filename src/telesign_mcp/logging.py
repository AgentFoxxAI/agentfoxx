"""Structured logging configuration using structlog.

Provides JSON-formatted logs for production and human-readable
console output for development. All logs include correlation
fields (server_name, transport) for observability.
"""

from __future__ import annotations

import logging
import sys
from typing import Any

import structlog

from telesign_mcp.config import LogFormat, LogLevel


def setup_logging(level: LogLevel, fmt: LogFormat, server_name: str) -> None:
    """Configure structlog with the given level and format.

    Args:
        level: Minimum log severity.
        fmt: Output format (json or console).
        server_name: Server name added to all log entries.
    """
    shared_processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if fmt == LogFormat.JSON:
        renderer: Any = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=sys.stderr.isatty())

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(getattr(logging, level.value))

    # Suppress noisy third-party loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("uvicorn").setLevel(logging.WARNING)

    # Bind server context to all future log calls
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(server=server_name)


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Get a named structlog logger instance.

    Args:
        name: Logger name (typically __name__).

    Returns:
        Configured bound logger.
    """
    return structlog.get_logger(name)
