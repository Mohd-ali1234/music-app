"""Application entrypoint: builds and configures the FastAPI app.

Exposes ``app`` at module level so ``uvicorn app.main:app`` (and, via the
compatibility shim, ``uvicorn server:app``) both work.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.api.router import api_router
from app.core.config import get_settings
from app.core.database import ensure_indexes
from app.core.logging import configure_logging, get_logger

configure_logging()
log = get_logger("music")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Startup: ensure indexes exist. Non-fatal so a transient DB hiccup at boot
    # does not take the whole service down.
    try:
        ensure_indexes()
        log.info("Mongo indexes ensured")
    except Exception as exc:  # noqa: BLE001
        log.warning("Index setup failed (non-fatal): %s", exc)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Music API", lifespan=lifespan)

    app.include_router(api_router)

    @app.get("/")
    def root_redirect():
        # Platform health checks hit "/"; send them to the API health endpoint.
        return RedirectResponse(url="/api/")

    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    return app


app = create_app()
