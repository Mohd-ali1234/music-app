"""Backwards-compatibility shim.

The application has been restructured into the ``app`` package. This module
keeps the historical entrypoint working so existing run/deploy commands
(``uvicorn server:app``, ``start.ps1``) need no changes.

New code should import from :mod:`app.main` directly.
"""
from app.main import app  # noqa: F401

__all__ = ["app"]
