from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Recommendation(Base):
    __tablename__ = "recommendations"
    __table_args__ = (
        CheckConstraint("priority IN ('low', 'normal', 'high')", name="ck_recommendations_priority"),
        Index(
            "ix_recommendations_user_read_created",
            "user_id",
            "is_read",
            "created_at",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    habit_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("habits.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )
    prediction_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("predictions.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    type: Mapped[str] = mapped_column(String(48), nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(
        String(24),
        default="normal",
        server_default=text("'normal'"),
        nullable=False,
    )
    is_read: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    user = relationship("User", back_populates="recommendations")
    habit = relationship("Habit", back_populates="recommendations")
    prediction = relationship("Prediction", back_populates="recommendations")
