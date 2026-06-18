import type { RiskLevel } from "./habit";

export interface Prediction {
  id: number | null;
  habit_id: number;
  user_id: number;
  predicted_for: string;
  completion_probability: number;
  miss_risk: number;
  risk_level: RiskLevel;
  features: Record<string, unknown>;
  created_at: string | null;
}

export interface Recommendation {
  id: number;
  user_id: number;
  habit_id: number | null;
  prediction_id: number | null;
  type: string;
  title: string;
  message: string;
  priority: string;
  is_read: boolean;
  created_at: string;
  ai_source?: "bothub" | "heuristic" | "not_requested" | null;
}
