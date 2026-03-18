# Telesign MCP Server

Production Model Context Protocol (MCP) server exposing Telesign fraud intelligence APIs for intent-driven fraud detection.

## Quick Start

```bash
# Install
pip install -e ".[dev]"

# Configure
cp .env.example .env
# Edit .env with your Telesign credentials

# Run
python -m telesign_mcp
```

## Roadmap

1. ✅ Foundation & repository architecture (Phase 0)
2. ✅ Core MCP transport & lifespan management (Phase 1)
3. ✅ Resilient Telesign API client with HMAC auth (Phase 2)
4. ✅ MCP tool implementations — Intelligence, Phone ID, Verify, Email (Phase 3)
5. ✅ Intent engine & fraud orchestration layer (Phase 4)
6. ✅ Observability, rate limiting & production hardening (Phase 5)
7. ✅ Integration testing, CI/CD & v1.0.0 release (Phase 6)

## Documentation

See `ARCHITECTURE.md` for design details and `CHANGELOG.md` for release history.
