# =============================================================================
# Telesign MCP Server - Production Docker Image
# Multi-stage build for minimal attack surface
# =============================================================================

# --- Stage 1: Build dependencies ---
FROM python:3.12-slim AS builder

WORKDIR /build

# Install build dependencies
RUN pip install --no-cache-dir --upgrade pip hatchling

# Copy only dependency specification first (cache layer)
COPY pyproject.toml .
COPY src/ src/

# Build wheel
RUN pip wheel --no-cache-dir --wheel-dir /wheels .

# --- Stage 2: Production runtime ---
FROM python:3.12-slim AS runtime

# Security: run as non-root
RUN groupadd --gid 1000 mcp && \
    useradd --uid 1000 --gid mcp --shell /bin/bash --create-home mcp

WORKDIR /app

# Install runtime dependencies from pre-built wheels
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir --no-index --find-links /wheels telesign-mcp-server && \
    rm -rf /wheels

# Switch to non-root user
USER mcp

# Health check: verify the module is importable
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "from telesign_mcp import __version__; print(__version__)" || exit 1

# Default: run via stdio transport
ENTRYPOINT ["python", "-m", "telesign_mcp"]

# Labels
LABEL org.opencontainers.image.title="telesign-mcp-server" \
      org.opencontainers.image.description="Production MCP server for Telesign fraud intelligence APIs" \
      org.opencontainers.image.source="https://github.com/AgentFoxxAI/TS-MCP-Server"
