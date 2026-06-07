export type AuthMode = "login" | "register";

export type AppSection =
  | "dashboard"
  | "habits"
  | "pet"
  | "recommendations"
  | "profile";

export interface NavigationItem {
  id: AppSection;
  label: string;
  shortLabel: string;
  path: string;
}
