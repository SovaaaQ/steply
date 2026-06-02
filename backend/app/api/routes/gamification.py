from __future__ import annotations

from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_client_today, get_current_user
from app.db.session import get_db
from app.models import User, XPHistory
from app.schemas import (
    GamificationAchievementRead,
    GamificationGoalRead,
    GamificationSummaryRead,
    PetRead,
    PetUpdate,
    RewardEventRead,
    XPHistoryRead,
)
from app.services.gamification import read_user_gamification_summary, refresh_user_gamification
from app.services.habit_entries import ensure_auto_missed_entries

router = APIRouter(prefix="/gamification", tags=["gamification"])


@router.get("/summary", response_model=GamificationSummaryRead)
def get_gamification_summary(
    db: Session = Depends(get_db),
    client_today: date = Depends(get_client_today),
    current_user: User = Depends(get_current_user),
) -> dict:
    return read_user_gamification_summary(db, current_user, today=client_today)


@router.get("/achievements", response_model=list[GamificationAchievementRead])
def get_achievements(
    db: Session = Depends(get_db),
    client_today: date = Depends(get_client_today),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    summary = read_user_gamification_summary(db, current_user, today=client_today)
    return summary["achievements"]


@router.get("/goals", response_model=list[GamificationGoalRead])
def get_goals(
    db: Session = Depends(get_db),
    client_today: date = Depends(get_client_today),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    summary = read_user_gamification_summary(db, current_user, today=client_today)
    return summary["goals"]


@router.get("/events", response_model=list[RewardEventRead])
def get_reward_events(
    db: Session = Depends(get_db),
    client_today: date = Depends(get_client_today),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    summary = read_user_gamification_summary(db, current_user, today=client_today)
    return summary["recent_events"]


@router.put("/pet", response_model=PetRead)
def update_pet(
    payload: PetUpdate,
    db: Session = Depends(get_db),
    client_today: date = Depends(get_client_today),
    current_user: User = Depends(get_current_user),
) -> dict:
    was_configured = bool(current_user.pet_type and current_user.pet_name)
    current_user.pet_type = payload.pet_type
    current_user.pet_name = payload.pet_name.strip()
    ensure_auto_missed_entries(db, current_user, client_today)
    summary = refresh_user_gamification(
        db,
        current_user,
        award_milestones=was_configured,
        today=client_today,
    )
    db.commit()
    return summary["pet"]


@router.get("/xp-history", response_model=list[XPHistoryRead])
def get_xp_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[XPHistory]:
    return list(
        db.scalars(
            select(XPHistory)
            .where(XPHistory.user_id == current_user.id)
            .order_by(XPHistory.created_at.desc(), XPHistory.id.desc())
            .limit(30)
        )
    )
