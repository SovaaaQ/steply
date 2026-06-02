from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_client_today, get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas import DaySyncRead
from app.services.gamification import refresh_user_gamification
from app.services.habit_entries import ensure_auto_missed_entries


router = APIRouter(prefix="/day", tags=["day"])


@router.post("/sync", response_model=DaySyncRead)
def sync_day(
    db: Session = Depends(get_db),
    client_today: date = Depends(get_client_today),
    current_user: User = Depends(get_current_user),
) -> DaySyncRead:
    created_count = ensure_auto_missed_entries(db, current_user, client_today)
    gamification = refresh_user_gamification(db, current_user, today=client_today)
    db.commit()
    return DaySyncRead(auto_missed_created=created_count, gamification=gamification)
