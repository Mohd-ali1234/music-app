from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class MusicPreferencesIn(BaseModel):
    favorite_artists: list[str] = Field(default_factory=list, max_length=20)
    genres: list[str] = Field(default_factory=list, max_length=12)
    languages: list[str] = Field(default_factory=list, max_length=12)
    moods: list[str] = Field(default_factory=list, max_length=8)
    decades: list[str] = Field(default_factory=list, max_length=8)


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = None
    preferences: MusicPreferencesIn = Field(default_factory=MusicPreferencesIn)


class LoginIn(BaseModel):
    email: EmailStr
    password: str
