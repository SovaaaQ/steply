from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.config import (
    DEFAULT_BACKEND_CORS_ORIGIN_REGEX,
    DEFAULT_BACKEND_CORS_ORIGINS,
    Settings,
)


PRODUCTION_SETTINGS = {
    "environment": "production",
    "secret_key": "prod-secret-key-please-replace-with-a-long-random-value",
    "auto_init_db": False,
    "backend_cors_origins": "https://steply.example.com",
    "backend_cors_origin_regex": "",
}


def make_production_settings(**overrides: object) -> Settings:
    data = {**PRODUCTION_SETTINGS, **overrides}
    return Settings(**data)


def assert_invalid_production_setting(message: str, **overrides: object) -> None:
    with pytest.raises(ValidationError, match=message):
        make_production_settings(**overrides)


def test_local_settings_keep_dev_defaults_enabled() -> None:
    settings = Settings(
        environment="local",
        auto_init_db=True,
        secret_key="change-this-secret-key",
        backend_cors_origins=DEFAULT_BACKEND_CORS_ORIGINS,
        backend_cors_origin_regex=DEFAULT_BACKEND_CORS_ORIGIN_REGEX,
    )

    assert settings.environment == "local"
    assert settings.auto_init_db is True
    assert settings.cors_origin_regex


def test_non_local_rejects_default_secret_key() -> None:
    assert_invalid_production_setting(
        "SECRET_KEY must be set outside local environment",
        secret_key="change-this-secret-key-in-production",
    )


def test_non_local_rejects_cors_origin_regex() -> None:
    assert_invalid_production_setting(
        "Use explicit CORS origins outside local environment",
        backend_cors_origin_regex=r"^https?://example\.com$",
    )


def test_non_local_rejects_auto_init_db() -> None:
    assert_invalid_production_setting(
        "AUTO_INIT_DB must be false outside local environment",
        auto_init_db=True,
    )


def test_non_local_rejects_default_cors_origins() -> None:
    assert_invalid_production_setting(
        "Explicit BACKEND_CORS_ORIGINS are required outside local environment",
        backend_cors_origins=DEFAULT_BACKEND_CORS_ORIGINS,
    )


def test_non_local_accepts_explicit_cors_without_startup_migration() -> None:
    settings = make_production_settings()

    assert settings.cors_origins == ["https://steply.example.com"]
    assert settings.cors_origin_regex is None
    assert settings.auto_init_db is False
