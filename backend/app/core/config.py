from __future__ import annotations

import json
from functools import lru_cache
from typing import Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_BACKEND_CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
DEFAULT_BACKEND_CORS_ORIGIN_REGEX = (
    r"^https?://(?:localhost|127\.0\.0\.1|10(?:\.[0-9]+)+|"
    r"192\.168(?:\.[0-9]+)+|172\.(?:1[6-9]|2[0-9]|3[01])"
    r"(?:\.[0-9]+)+)(?::[0-9]+)?$"
)
DEFAULT_SECRET_KEY_PREFIX = "change-this"


class Settings(BaseSettings):
    app_name: str = "Steply"
    environment: str = "local"
    auto_init_db: bool = True
    secret_key: str = "change-this-secret-key"
    access_token_expire_minutes: int = 60 * 24 * 7
    postgres_user: str = "steply_user"
    postgres_password: str = "steply_password"
    postgres_db: str = "steply_db"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    database_url: Optional[str] = None
    backend_cors_origins: str = DEFAULT_BACKEND_CORS_ORIGINS
    backend_cors_origin_regex: str = DEFAULT_BACKEND_CORS_ORIGIN_REGEX
    ai_enabled: bool = False
    ai_provider: str = "bothub"
    ai_request_timeout_seconds: float = 12.0
    ai_daily_recommendation_limit: int = 5
    bothub_api_key: str = ""
    bothub_base_url: str = "https://openai.bothub.chat/v1"
    bothub_model: str = "gpt-5.4-mini"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        value = self.backend_cors_origins.strip()
        if value.startswith("["):
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        return [item.strip() for item in value.split(",") if item.strip()]

    @property
    def cors_origin_regex(self) -> Optional[str]:
        value = self.backend_cors_origin_regex.strip()
        return value or None

    @model_validator(mode="after")
    def build_database_url(self) -> "Settings":
        if not self.database_url:
            self.database_url = (
                f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
                f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
            )
        elif self.database_url.startswith("postgresql://"):
            self.database_url = self.database_url.replace(
                "postgresql://",
                "postgresql+psycopg://",
                1,
            )
        return self

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.environment.strip().lower() == "local":
            return self

        if self.secret_key.strip().startswith(DEFAULT_SECRET_KEY_PREFIX):
            raise ValueError("SECRET_KEY must be set outside local environment")

        if self.cors_origin_regex:
            raise ValueError("Use explicit CORS origins outside local environment")

        if self.auto_init_db:
            raise ValueError("AUTO_INIT_DB must be false outside local environment")

        if not self.cors_origins or self.backend_cors_origins.strip() == DEFAULT_BACKEND_CORS_ORIGINS:
            raise ValueError(
                "Explicit BACKEND_CORS_ORIGINS are required outside local environment",
            )

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
