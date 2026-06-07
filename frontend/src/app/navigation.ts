import type { AppSection, NavigationItem } from "../types/navigation";

export const navigationItems: NavigationItem[] = [
  { id: "dashboard", label: "Главная", shortLabel: "Главная", path: "/" },
  { id: "habits", label: "Привычки", shortLabel: "Привычки", path: "/habits" },
  { id: "pet", label: "Питомец", shortLabel: "Питомец", path: "/pet" },
  { id: "recommendations", label: "Советы", shortLabel: "Советы", path: "/recommendations" },
  { id: "profile", label: "Профиль", shortLabel: "Профиль", path: "/profile" }
];

const sectionByPath = new Map(navigationItems.map((item) => [item.path, item.id]));
const pathBySection = new Map(navigationItems.map((item) => [item.id, item.path]));

export function getSectionPath(section: AppSection) {
  return pathBySection.get(section) ?? "/";
}

export function getSectionFromPath(pathname: string): AppSection {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  return sectionByPath.get(normalizedPath) ?? "dashboard";
}
