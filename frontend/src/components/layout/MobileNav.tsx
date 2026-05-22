import { navigationItems } from "../../app/router";
import { useAppData } from "../../app/providers";
import { NavIcon } from "./NavIcon";

export function MobileNav() {
  const { activeSection, setActiveSection } = useAppData();

  return (
    <nav className="mobile-nav" aria-label="Мобильная навигация">
      {navigationItems.map((item) => (
        <button
          type="button"
          className={activeSection === item.id ? "active" : ""}
          key={item.id}
          onClick={() => setActiveSection(item.id)}
        >
          <span className="mobile-nav-icon">
            <NavIcon section={item.id} />
          </span>
          {item.shortLabel}
        </button>
      ))}
    </nav>
  );
}
