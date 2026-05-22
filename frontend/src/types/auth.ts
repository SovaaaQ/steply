export interface User {
  id: number;
  email: string;
  full_name: string;
  experience_points: number;
  level: number;
  lives: number;
  pet_type: PetType | null;
  pet_name: string | null;
  pet_state: PetState;
  pet_xp: number;
  pet_level: number;
  created_at: string;
}

export type PetType = "dog" | "cat" | "parrot" | "hamster";
export type PetState = "happy" | "neutral" | "sad";

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}
