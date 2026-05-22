import { navigationItems } from "../../app/router";
import { useAppData } from "../../app/providers";
import { NavIcon } from "./NavIcon";

export function Sidebar() {
  const { activeSection, setActiveSection, completedToday, habitsForToday } = useAppData();

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <span className="brand-mark">S</span>
        <div>
          <strong>Steply</strong>
          <span>маленькие шаги к устойчивым привычкам</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Основная навигация">
        {navigationItems.map((item) => (
          <button
            type="button"
            className={activeSection === item.id ? "active" : ""}
            key={item.id}
            onClick={() => setActiveSection(item.id)}
          >
            <span className="nav-icon">
              <NavIcon section={item.id} />
            </span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-progress">
        <span>Сегодня</span>
        <strong>{completedToday}/{habitsForToday.length}</strong>
        <div className="mini-progress">
          <span style={{ width: `${habitsForToday.length ? (completedToday / habitsForToday.length) * 100 : 0}%` }} />
        </div>
        <small>Выполни привычку, чтобы поддержать питомца</small>
      </div>
    </aside>
  );
}
