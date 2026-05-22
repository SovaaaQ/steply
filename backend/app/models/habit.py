from __future__ import annotations

from datetime import date, datetime, time
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    Time,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Habit(Base):
    __tablename__ = "habits"
    __table_args__ = (
        CheckConstraint(
            "frequency_type IN ('daily', 'weekly', 'custom')",
            name="ck_habits_frequency_type",
        ),
        CheckConstraint("target_per_week BETWEEN 1 AND 7", name="ck_habits_target_per_week"),
        CheckConstraint("difficulty IN ('easy', 'medium', 'hard')", name="ck_habits_difficulty"),
        CheckConstraint(
            "recovery_minutes BETWEEN 1 AND 120",
            name="ck_habits_recovery_minutes",
        ),
        Index("ix_habits_user_active_created", "user_id", "is_active", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    frequency_type: Mapped[str] = mapped_column(
        String(32),
        default="daily",
        server_default=text("'daily'"),
        nullable=False,
    )
    target_per_week: Mapped[int] = mapped_column(
        Integer,
        default=7,
        server_default=text("7"),
        nullable=False,
    )
    difficulty: Mapped[str] = mapped_column(
        String(32),
        default="medium",
        server_default=text("'medium'"),
        nullable=False,
    )
    preferred_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    recovery_minutes: Mapped[int] = mapped_column(
        Integer,
        default=5,
        server_default=text("5"),
        nullable=False,
    )
    recovery_task: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    schedule_days: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        server_default=text("'[]'::json"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    user = relationship("User", back_populates="habits")
    entries = relationship("HabitEntry", back_populates="habit", cascade="all, delete-orphan")
    predictions = relationship("Prediction", back_populates="habit", cascade="all, delete-orphan")
    recommendations = relationship(
        "Recommendation",
        back_populates="habit",
        cascade="all, delete-orphan",
    )
    xp_history = relationship("XPHistory", back_populates="habit", cascade="all, delete-orphan")


class HabitEntry(Base):
    __tablename__ = "habit_entries"
    __table_args__ = (
        UniqueConstraint("habit_id", "entry_date", name="uq_habit_entry_date"),
        CheckConstraint(
            "status IN ('completed', 'missed', 'recovery_completed')",
            name="ck_habit_entries_status",
        ),
        CheckConstraint("xp_awarded >= 0", name="ck_habit_entries_xp_awarded_non_negative"),
        Index("ix_habit_entries_user_date", "user_id", "entry_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    habit_id: Mapped[int] = mapped_column(
        ForeignKey("habits.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    entry_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completion_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    xp_awarded: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default=text("0"),
        nullable=False,
    )
    meta: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        server_default=text("'{}'::json"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    habit = relationship("Habit", back_populates="entries")
    user = relationship("User", back_populates="entries")
    xp_history = relationship("XPHistory", back_populates="completion")
