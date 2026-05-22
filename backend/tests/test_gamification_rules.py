from app.core.gamification_rules import (
    RECOVERY_FALLBACK_TASK,
    calculatePetLevel,
    calculatePetState,
    getRecoveryTask,
    getXPForCompletion,
    shouldActivateRecoveryMode,
)


def test_calculate_pet_state_from_week_activity() -> None:
    assert calculatePetState({"completed_last_7_days": 7, "missed_last_7_days": 3}) == "happy"
    assert calculatePetState({"completion_rate_last_7": 0.55}) == "neutral"
    assert calculatePetState({"completion_rate_last_7": 0.2}) == "sad"


def test_calculate_pet_level_thresholds() -> None:
    assert calculatePetLevel(0) == 1
    assert calculatePetLevel(100) == 2
    assert calculatePetLevel(250) == 3
    assert calculatePetLevel(500) == 4
    assert calculatePetLevel(1000) == 5


def test_get_xp_for_completion_status() -> None:
    assert getXPForCompletion("completed", "easy") == 5
    assert getXPForCompletion("completed", "medium") == 10
    assert getXPForCompletion("completed", "hard") == 15
    assert getXPForCompletion("recovery_completed", "easy") == 5
    assert getXPForCompletion("recovery_completed", "hard") == 8
    assert getXPForCompletion("missed") == 0


def test_should_activate_recovery_mode() -> None:
    assert shouldActivateRecoveryMode({"completion_rate_last_7": 0.8}, 0.7)
    assert shouldActivateRecoveryMode({"completion_rate_last_7": 0.8, "consecutive_missed": 2}, 0.1)
    assert shouldActivateRecoveryMode({"completion_rate_last_7": 0.3, "total_last_7_days": 5}, 0.1)
    assert not shouldActivateRecoveryMode(
        {"completion_rate_last_7": 0.0, "total_last_7_days": 0, "consecutive_missed": 0},
        0.1,
    )


def test_get_recovery_task() -> None:
    assert getRecoveryTask({"recovery_task": "Прочитать 2 страницы"}) == "Прочитать 2 страницы"
    assert getRecoveryTask({}) == RECOVERY_FALLBACK_TASK
