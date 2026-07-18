from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_auth_service, get_current_user
from app.schemas.auth import LoginIn, RegisterIn
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
def register(body: RegisterIn, auth: AuthService = Depends(get_auth_service)):
    return auth.register(body.email, body.password, body.display_name)


@router.post("/login")
def login(body: LoginIn, auth: AuthService = Depends(get_auth_service)):
    return auth.login(body.email, body.password)


@router.get("/me")
def me(user=Depends(get_current_user)):
    return {"user": user}
