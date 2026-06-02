from __future__ import annotations

from datetime import date, datetime, time
from typing import Any, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, EmailStr, Field


EntryStatus = Literal["completed", "missed", "recovery_completed"]
Difficulty = Literal["easy", "medium", "hard"]
FrequencyType = Literal["daily", "weekly", "custom"]
WeekdayKey = Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
ScheduleDay = Union[WeekdayKey, int]
RiskLevel = Literal["low", "medium", "high"]
GoalType = Literal["onboarding", "daily", "weekly"]
GoalStatus = Literal["active", "completed", "empty"]
StreakStatus = Literal["empty", "active", "at_risk", "restored"]
PetType = Literal["dog", "cat", "parrot", "hamster"]
PetState = Literal["happy", "neutral", "sad"]
XPReason = Literal["completed_on_time", "recovery_completed"]


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=10, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    experience_points: int
    level: int
    lives: int
    pet_type: Optional[PetType] = None
    pet_name: Optional[str] = None
    pet_state: PetState = "neutral"
    pet_xp: int
    pet_level: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class HabitBase(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    description: Optional[str] = Field(default=None, max_length=1200)
    frequency_type: FrequencyType = "daily"
    target_per_week: int = Field(default=7, ge=1, le=7)
    difficulty: Difficulty = "medium"
    preferred_time: Optional[time] = None
    recovery_minutes: int = Field(default=5, ge=1, le=120)
    recovery_task: Optional[str] = Field(default=None, max_length=500)
    schedule_days: list[ScheduleDay] = Field(default_factory=list)


class HabitCreate(HabitBase):
    pass


class HabitUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=160)
    description: Optional[str] = Field(default=None, max_length=1200)
    frequency_type: Optional[FrequencyType] = None
    target_per_week: Optional[int] = Field(default=None, ge=1, le=7)
    difficulty: Optional[Difficulty] = None
    preferred_time: Optional[time] = None
    recovery_minutes: Optional[int] = Field(default=None, ge=1, le=120)
    recovery_task: Optional[str] = Field(default=None, max_length=500)
    schedule_days: Optional[list[ScheduleDay]] = None
    is_active: Optional[bool] = None


class HabitRead(HabitBase):
    id: int
    user_id: int
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HabitEntryCreate(BaseModel):
    entry_date: date
    client_time: Optional[time] = None
    status: EntryStatus
    note: Optional[str] = Field(default=None, max_length=1000)
    completion_value: Optional[float] = Field(default=None, ge=0)


class HabitEntryRead(BaseModel):
    id: int
    habit_id: int
    user_id: int
    entry_date: date
    status: EntryStatus
    note: Optional[str]
    completion_value: Optional[float]
    xp_awarded: int
    meta: dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HabitStats(BaseModel):
    habit_id: int
    title: str
    total_entries: int
    completed_count: int
    missed_count: int
    completion_rate: float
    completed_last_7_days: int
    missed_last_7_days: int
    completion_rate_last_7: float
    consecutive_missed: int
    recovery_mode: bool
    recovery_task: str
    current_streak: int
    longest_streak: int
    days_since_last_completion: Optional[int]
    weekday_success_rates: dict[str, float]


class UserActivitySummary(BaseModel):
    user_id: int
    total_habits: int
    active_habits: int
    total_entries: int
    completed_count: int
    missed_count: int
    completed_last_7_days: int
    missed_last_7_days: int
    completed_last_30_days: int
    missed_last_30_days: int
    completion_rate: float
    activity_score: float
    current_streak: int
    longest_streak: int
    average_current_streak: float
    experience_points: int
    level: int
    lives: int
    recovery_mode: bool


class PredictionRead(BaseModel):
    id: Optional[int] = None
    habit_id: int
    user_id: int
    predicted_for: date
    completion_probability: float
    miss_risk: float
    risk_level: RiskLevel
    features: dict[str, Any]
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class RecommendationRead(BaseModel):
    id: int
    user_id: int
    habit_id: Optional[int]
    prediction_id: Optional[int]
    type: str
    title: str
    message: str
    priority: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GamificationProfileRead(BaseModel):
    level: int
    title: str
    milestone: str
    total_xp: int
    current_level_xp: int
    current_level_min_xp: int
    next_level: int
    next_level_xp: int
    xp_to_next_level: int
    progress_percent: float
    current_streak: int
    longest_streak: int
    last_active_date: Optional[date]
    streak_status: StreakStatus


class PetUpdate(BaseModel):
    pet_type: PetType
    pet_name: str = Field(min_length=1, max_length=80)


class PetRead(BaseModel):
    pet_type: Optional[PetType]
    pet_name: Optional[str]
    pet_state: PetState
    level: int
    xp: int
    progress_percent: float
    next_level: int
    next_level_xp: int
    xp_to_next_level: int
    is_configured: bool


class StreakRead(BaseModel):
    current: int
    best: int
    status: StreakStatus
    label: str
    next_step: str
    is_at_risk: bool
    last_active_date: Optional[date]
    completed_today: int
    scheduled_today: int


class GamificationAchievementRead(BaseModel):
    id: str
    title: str
    description: str
    category: str
    icon: str
    progress: int
    target: int
    reward_xp: int
    unlocked: bool
    unlocked_at: Optional[datetime]


class GamificationGoalRead(BaseModel):
    id: str
    type: GoalType
    tone: str
    title: str
    description: str
    progress: int
    target: int
    reward_xp: int
    status: GoalStatus
    period_key: str
    cta_label: str
    cta_section: str
    next_step: str
    completed_at: Optional[datetime]
    empty: bool


class RewardEventRead(BaseModel):
    id: int
    event_type: str
    xp_amount: int
    description: str
    source_type: Optional[str]
    source_id: Optional[str]
    created_at: datetime
    meta: dict[str, Any]


class XPHistoryRead(BaseModel):
    id: int
    user_id: int
    habit_id: int
    completion_id: Optional[int]
    entry_date: date
    xp_amount: int
    reason: XPReason
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NextBestActionRead(BaseModel):
    title: str
    description: str
    cta_label: str
    cta_section: str


class GamificationSummaryRead(BaseModel):
    profile: GamificationProfileRead
    pet: PetRead
    streak: StreakRead
    achievements: list[GamificationAchievementRead]
    goals: list[GamificationGoalRead]
    recent_events: list[RewardEventRead]
    next_best_action: NextBestActionRead


class DaySyncRead(BaseModel):
    auto_missed_created: int
    gamification: GamificationSummaryRead


class DashboardRead(BaseModel):
    user: UserRead
    habits: list[HabitRead]
    summary: UserActivitySummary
    habit_stats: dict[int, HabitStats]
    habit_entries: dict[int, list[HabitEntryRead]]
    predictions: dict[int, PredictionRead]
    recommendations: list[RecommendationRead]
    gamification: GamificationSummaryRead
