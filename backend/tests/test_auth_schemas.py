from pydantic import ValidationError
import pytest

from app.schemas import UserCreate


def test_register_password_requires_at_least_ten_characters() -> None:
    with pytest.raises(ValidationError):
        UserCreate(
            email="user@example.com",
            full_name="Test User",
            password="short123",
        )


def test_register_password_accepts_ten_characters() -> None:
    payload = UserCreate(
        email="user@example.com",
        full_name="Test User",
        password="longpass10",
    )

    assert payload.password == "longpass10"
