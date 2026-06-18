from datetime import datetime

from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.time import utc_now
from app.db.session import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("experience_points >= 0", name="ck_users_experience_points_non_negative"),
        CheckConstraint("level >= 1", name="ck_users_level_positive"),
        CheckConstraint(
            "pet_type IS NULL OR pet_type IN ('dog', 'cat', 'parrot', 'hamster')",
            name="ck_users_pet_type",
        ),
        CheckConstraint("pet_state IN ('happy', 'neutral', 'sad')", name="ck_users_pet_state"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    experience_points: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default=text("0"),
        nullable=False,
    )
    level: Mapped[int] = mapped_column(Integer, default=1, server_default=text("1"), nullable=False)
    pet_type: Mapped[Optional[str]] = mapped_column(String(24), nullable=True)
    pet_name: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    pet_state: Mapped[str] = mapped_column(
        String(24),
        default="neutral",
        server_default=text("'neutral'"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    habits = relationship("Habit", back_populates="user", cascade="all, delete-orphan")
    entries = relationship("HabitEntry", back_populates="user", cascade="all, delete-orphan")
    predictions = relationship("Prediction", back_populates="user", cascade="all, delete-orphan")
    recommendations = relationship(
        "Recommendation",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    gamification_profile = relationship(
        "UserGamificationProfile",
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    achievements = relationship("UserAchievement", back_populates="user", cascade="all, delete-orphan")
    goal_progress = relationship(
        "UserGoalProgress",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    reward_events = relationship("RewardEvent", back_populates="user", cascade="all, delete-orphan")
    xp_history = relationship("XPHistory", back_populates="user", cascade="all, delete-orphan")

    @property
    def pet_xp(self) -> int:
        return self.experience_points

    @property
    def pet_level(self) -> int:
        return self.level
