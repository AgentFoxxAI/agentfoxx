"""Phase 0 smoke tests - verify package structure and imports."""

from __future__ import annotations


def test_version_import() -> None:
    """Verify the package is importable and exposes __version__."""
    from telesign_mcp import __version__

    assert __version__ == "1.0.0"


def test_submodules_importable() -> None:
    """Verify all submodule placeholders import without error."""
