from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text

from app.core.config import get_settings
from app.db.session import SessionLocal, engine
from app.services.gamification import seed_gamification_definitions


APP_TABLES = {
    "achievements",
    "habit_entries",
    "habits",
    "predictions",
    "goals",
    "recommendations",
    "reward_events",
    "user_achievements",
    "user_gamification_profiles",
    "user_goal_progress",
    "users",
    "xp_history",
}

LEGACY_APP_TABLES = {
    "achievements",
    "habit_entries",
    "habits",
    "predictions",
    "quests",
    "recommendations",
    "reward_events",
    "user_achievements",
    "user_gamification_profiles",
    "user_quest_progress",
    "users",
    "xp_history",
}


def init_db() -> None:
    run_migrations()
    with SessionLocal() as db:
        seed_gamification_definitions(db)


def run_migrations() -> None:
    config = _alembic_config()
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    existing_app_tables = table_names & APP_TABLES
    legacy_app_tables = table_names & LEGACY_APP_TABLES

    if "alembic_version" not in table_names and (existing_app_tables or legacy_app_tables):
        if existing_app_tables == APP_TABLES:
            ensure_legacy_columns()
            command.stamp(config, "head")
            return
        if legacy_app_tables == LEGACY_APP_TABLES:
            ensure_legacy_columns()
            command.stamp(config, "202605210001")
            command.upgrade(config, "head")
            return
        if existing_app_tables != APP_TABLES:
            missing_tables = ", ".join(sorted(APP_TABLES - existing_app_tables))
            raise RuntimeError(
                "Legacy database has only part of the Steply schema. "
                f"Missing tables: {missing_tables}. "
                "Restore the schema or create a clean database before running migrations."
            )
        ensure_legacy_columns()
        command.stamp(config, "head")
        return

    command.upgrade(config, "head")


def _alembic_config() -> Config:
    backend_dir = Path(__file__).resolve().parents[2]
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    config.set_main_option("sqlalchemy.url", str(get_settings().database_url))
    return config


def ensure_legacy_columns() -> None:
    inspector = inspect(engine)
    if "users" in inspector.get_table_names():
        _add_missing_columns(
            "users",
            {
                "pet_type": "VARCHAR(24)",
                "pet_name": "VARCHAR(80)",
                "pet_state": "VARCHAR(24) DEFAULT 'neutral' NOT NULL",
            },
        )
    if "habits" in inspector.get_table_names():
        _add_missing_columns(
            "habits",
            {
                "recovery_task": "TEXT",
                "schedule_days": "JSON DEFAULT '[]' NOT NULL",
            },
        )
    if "habit_entries" in inspector.get_table_names():
        _add_missing_columns(
            "habit_entries",
            {"xp_awarded": "INTEGER DEFAULT 0 NOT NULL"},
        )


def _add_missing_columns(table_name: str, columns: dict[str, str]) -> None:
    existing = {column["name"] for column in inspect(engine).get_columns(table_name)}
    missing = [(name, ddl) for name, ddl in columns.items() if name not in existing]
    if not missing:
        return

    with engine.begin() as connection:
        for name, ddl in missing:
            connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {name} {ddl}"))
