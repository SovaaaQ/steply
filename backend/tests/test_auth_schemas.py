from pydantic import ValidationError
import pytest

from app.schemas import HabitCreate, PetUpdate, UserCreate


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


def test_text_fields_strip_whitespace_and_reject_blank_values() -> None:
    user = UserCreate(email="user@example.com", full_name="  Test User  ", password="longpass10")
    pet = PetUpdate(pet_type="cat", pet_name="  Мика  ")

    assert user.full_name == "Test User"
    assert pet.pet_name == "Мика"

    with pytest.raises(ValidationError):
        UserCreate(email="blank@example.com", full_name="   ", password="longpass10")
    with pytest.raises(ValidationError):
        PetUpdate(pet_type="cat", pet_name="   ")


def test_habit_frequency_and_schedule_are_validated() -> None:
    with pytest.raises(ValidationError):
        HabitCreate(title="Диплом", frequency_type="weekly", difficulty="hard")

    with pytest.raises(ValidationError):
        HabitCreate(title="Диплом", frequency_type="custom", difficulty="hard", schedule_days=[])

    with pytest.raises(ValidationError):
        HabitCreate(title="Диплом", frequency_type="custom", difficulty="hard", schedule_days=[7])

    habit = HabitCreate(
        title="  Диплом  ",
        frequency_type="custom",
        difficulty="hard",
        schedule_days=[0, "wed"],
    )
    assert habit.title == "Диплом"
