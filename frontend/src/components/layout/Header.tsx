import { navigationItems } from "../../app/navigation";
import { useHabitForm, useNavigation } from "../../app/providers";
import { useAuth } from "../../hooks/useAuth";

export function Header() {
  const { activeSection } = useNavigation();
  const { openHabitCreator } = useHabitForm();
  const { user, logout } = useAuth();
  const title = navigationItems.find((item) => item.id === activeSection)?.label ?? "Главная";
  const showQuickAdd = activeSection !== "habits";

  return (
    <header className="app-header">
      <div>
        <span className="page-kicker">Steply</span>
        <h1>{title}</h1>
      </div>

      <div className="header-actions">
        {showQuickAdd && (
          <button type="button" className="quick-add" onClick={openHabitCreator}>
            Новая привычка
          </button>
        )}
        <span className="header-pill">{user?.full_name ?? "Пользователь"}</span>
        <button type="button" className="ghost-button" onClick={logout}>
          Выйти
        </button>
      </div>
    </header>
  );
}
