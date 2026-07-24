"""Entrypoint for the packaged desktop backend (PyInstaller target).

Not used in normal dev/deploy — those run ``uvicorn server:app`` directly.
This module exists so PyInstaller has a single script to freeze: it starts
uvicorn in-process (no ``--reload``, no subprocess spawn) bound to
127.0.0.1 so it's only reachable from the same machine, on the fixed port
the Electron shell expects (see app/desktop/src/main.js).
"""
from __future__ import annotations

import uvicorn

from app.main import app

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
