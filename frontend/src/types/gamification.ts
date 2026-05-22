import type { AppSection } from "./navigation";
import type { PetState, PetType } from "./auth";

export type QuestTone = "daily" | "weekly" | "recovery" | "onboarding" | "insight";
export type QuestType = "onboarding" | "daily" | "weekly";
export type QuestStatus = "active" | "completed" | "empty";
export type StreakStatus = "empty" | "active" | "at_risk" | "restored";

export interface Quest {
  id: string;
  type: QuestType;
  tone: QuestTone;
  title: string;
  description: string;
  progress: number;
  target: number;
  reward_xp: number;
  status: QuestStatus;
  period_key: string;
  cta_label: string;
  cta_section: AppSection;
  next_step: string;
  completed_at: string | null;
  empty: boolean;
}

export interface StreakState {
  current: number;
  best: number;
  status: StreakStatus;
  label: string;
  next_step: string;
  is_at_risk: boolean;
  last_active_date: string | null;
  completed_today: number;
  scheduled_today: number;
}

export interface RewardPreview {
  title: string;
  detail: string;
  xp: number;
}

export interface GamificationProfile {
  level: number;
  title: string;
  milestone: string;
  total_xp: number;
  current_level_xp: number;
  current_level_min_xp: number;
  next_level: number;
  next_level_xp: number;
  xp_to_next_level: number;
  progress_percent: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  streak_status: StreakStatus;
}

export interface GamificationAchievement {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  progress: number;
  target: number;
  reward_xp: number;
  unlocked: boolean;
  unlocked_at: string | null;
}

export interface RewardEvent {
  id: number;
  event_type: string;
  xp_amount: number;
  description: string;
  source_type: string | null;
  source_id: string | null;
  created_at: string;
  meta: Record<string, unknown>;
}

export interface Pet {
  pet_type: PetType | null;
  pet_name: string | null;
  pet_state: PetState;
  level: number;
  xp: number;
  progress_percent: number;
  next_level: number;
  next_level_xp: number;
  xp_to_next_level: number;
  is_configured: boolean;
}

export interface NextBestAction {
  title: string;
  description: string;
  cta_label: string;
  cta_section: AppSection;
}

export interface GamificationSummary {
  profile: GamificationProfile;
  pet: Pet;
  streak: StreakState;
  achievements: GamificationAchievement[];
  quests: Quest[];
  recent_events: RewardEvent[];
  next_best_action: NextBestAction;
}
