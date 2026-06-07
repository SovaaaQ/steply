import { navigationItems } from "../../app/navigation";
import { useAppData } from "../../app/providers";
import { NavIcon } from "./NavIcon";
import type { MouseEvent } from "react";

export function MobileNav() {
  const { activeSection, setActiveSection } = useAppData();

  return (
    <nav className="mobile-nav" aria-label="Мобильная навигация">
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
            <span className="mobile-nav-icon">
              <NavIcon section={item.id} />
            </span>
            {item.shortLabel}
          </a>
        );
      })}
    </nav>
  );
}
