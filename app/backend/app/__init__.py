"""Music streaming backend.

Clean, layered FastAPI application:

    api/            HTTP routes (thin controllers) + request dependencies
    schemas/        Pydantic request/response models (the public wire contract)
    services/       Use-case orchestration (search, recommendation, home, ...)
    repositories/   Data access over MongoDB collections
    providers/      External integrations (YouTube, MusicBrainz)
    domain/         Serialization + domain document builders
    core/           Configuration, database, security, logging
    utils/          Pure, dependency-free helpers

The entrypoint is :data:`app.main.app`. A thin ``server.py`` shim at the
backend root keeps the historical ``uvicorn server:app`` command working.
"""
