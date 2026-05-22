import { DashboardPage } from "../pages/DashboardPage";
import { HabitsPage } from "../pages/HabitsPage";
import { PetScreen } from "../pages/PetScreen";
import { ProfilePage } from "../pages/ProfilePage";
import { TipsScreen } from "../pages/TipsScreen";
import { useAppData } from "./providers";
import type { NavigationItem } from "../types/navigation";

export const navigationItems: NavigationItem[] = [
  { id: "dashboard", label: "Главная", shortLabel: "Главная" },
  { id: "habits", label: "Привычки", shortLabel: "Привычки" },
  { id: "pet", label: "Питомец", shortLabel: "Питомец" },
  { id: "recommendations", label: "Советы", shortLabel: "Советы" },
  { id: "profile", label: "Профиль", shortLabel: "Профиль" }
];

export function AppRouter() {
  const { activeSection } = useAppData();

  switch (activeSection) {
    case "habits":
      return <HabitsPage />;
    case "pet":
      return <PetScreen />;
    case "recommendations":
      return <TipsScreen />;
    case "profile":
      return <ProfilePage />;
    case "dashboard":
    default:
      return <DashboardPage />;
  }
}
