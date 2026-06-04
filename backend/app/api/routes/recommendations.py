from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_client_today, get_current_user
from app.db.session import get_db
from app.models import Recommendation, User
from app.schemas import RecommendationRead
from app.services.gamification import record_recommendation_read
from app.services.habit_entries import ensure_auto_missed_entries
from app.services.recommendations import generate_recommendations, list_current_recommendations

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("", response_model=list[RecommendationRead])
def list_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Recommendation]:
    return list_current_recommendations(db, current_user)


@router.post("/generate", response_model=list[RecommendationRead])
def generate_user_recommendations(
    db: Session = Depends(get_db),
    client_today: date = Depends(get_client_today),
    current_user: User = Depends(get_current_user),
) -> list[Recommendation]:
    ensure_auto_missed_entries(db, current_user, client_today)
    recommendations = generate_recommendations(db, current_user, client_today)
    db.commit()
    return recommendations


@router.patch("/{recommendation_id}/read", response_model=RecommendationRead)
def mark_recommendation_read(
    recommendation_id: int,
    db: Session = Depends(get_db),
    client_today: date = Depends(get_client_today),
    current_user: User = Depends(get_current_user),
) -> Recommendation:
    recommendation = db.get(Recommendation, recommendation_id)
    if not recommendation or recommendation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recommendation not found",
        )
    was_read = recommendation.is_read
    recommendation.is_read = True
    if not was_read:
        record_recommendation_read(db, current_user, recommendation, client_today)
    db.commit()
    db.refresh(recommendation)
    return recommendation
