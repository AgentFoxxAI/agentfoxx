"""Entry point for `python -m telesign_mcp`.

Starts the MCP server with configured transport.
"""

from __future__ import annotations

import sys

from pydantic import ValidationError


def main() -> None:
    """Start the Telesign MCP server.

    Loads configuration, validates environment, and starts the server
    on the configured transport (stdio by default).

    Exits with code 1 if configuration is invalid.
    """
    try:
        from telesign_mcp.config import load_server_settings

        settings = load_server_settings()
    except ValidationError as exc:
        print(f"Configuration error:\n{exc}", file=sys.stderr)
        sys.exit(1)

    from telesign_mcp.server import mcp

    transport = settings.transport.value

    if transport == "stdio":
        mcp.run(transport="stdio")
    elif transport in ("sse", "streamable-http"):
        mcp.run(
            transport=transport,
            host=settings.host,
            port=settings.port,
        )
    else:
        print(f"Unsupported transport: {transport}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
