import { navigationItems } from "../../app/navigation";
import { useDashboardData, useNavigation } from "../../app/providers";
import { NavIcon } from "./NavIcon";
import type { MouseEvent } from "react";

export function Sidebar() {
  const { activeSection, setActiveSection } = useNavigation();
  const { completedToday, habitsForToday } = useDashboardData();

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
        {navigationItems.map((item) => {
          const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
              return;
            }

            event.preventDefault();
            setActiveSection(item.id);
          };

          return (
            <a
              className={activeSection === item.id ? "active" : ""}
              href={item.path}
              key={item.id}
              onClick={handleClick}
            >
              <span className="nav-icon">
                <NavIcon section={item.id} />
              </span>
              {item.label}
            </a>
          );
        })}
      </nav>

      <div className="sidebar-progress">
        <span>Сегодня</span>
        <strong>{completedToday}/{habitsForToday.length}</strong>
        <div className="mini-progress">
          <span style={{ width: `${habitsForToday.length ? (completedToday / habitsForToday.length) * 100 : 0}%` }} />
        </div>
          <small>Отметьте привычку, чтобы питомец рос</small>
      </div>
    </aside>
  );
}
