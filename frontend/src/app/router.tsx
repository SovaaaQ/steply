import { DashboardPage } from "../pages/DashboardPage";
import { HabitsPage } from "../pages/HabitsPage";
import { PetScreen } from "../pages/PetScreen";
import { ProfilePage } from "../pages/ProfilePage";
import { TipsScreen } from "../pages/TipsScreen";
import { navigationItems } from "./navigation";
import { useNavigation } from "./providers";

export { navigationItems };

export function AppRouter() {
  const { activeSection } = useNavigation();

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
