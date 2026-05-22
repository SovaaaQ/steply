from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Prediction(Base):
    __tablename__ = "predictions"
    __table_args__ = (
        UniqueConstraint(
            "habit_id",
            "user_id",
            "predicted_for",
            name="uq_predictions_habit_user_date",
        ),
        CheckConstraint(
            "completion_probability BETWEEN 0 AND 1",
            name="ck_predictions_completion_probability",
        ),
        CheckConstraint("miss_risk BETWEEN 0 AND 1", name="ck_predictions_miss_risk"),
        CheckConstraint("risk_level IN ('low', 'medium', 'high')", name="ck_predictions_risk_level"),
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
    predicted_for: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    completion_probability: Mapped[float] = mapped_column(Float, nullable=False)
    miss_risk: Mapped[float] = mapped_column(Float, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(24), nullable=False)
    features: Mapped[dict[str, Any]] = mapped_column(
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

    habit = relationship("Habit", back_populates="predictions")
    user = relationship("User", back_populates="predictions")
    recommendations = relationship("Recommendation", back_populates="prediction")
