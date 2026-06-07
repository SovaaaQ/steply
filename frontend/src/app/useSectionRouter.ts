import { useCallback, useEffect, useState } from "react";

import { getSectionFromPath, getSectionPath } from "./navigation";
import type { AppSection } from "../types/navigation";

function readInitialSection(): AppSection {
  if (typeof window === "undefined") {
    return "dashboard";
  }

  return getSectionFromPath(window.location.pathname);
}

function normalizeCurrentPath(section: AppSection) {
  if (typeof window === "undefined") {
    return;
  }

  const targetPath = getSectionPath(section);
  const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";

  if (normalizedPath !== targetPath) {
    window.history.replaceState({ section }, "", targetPath);
  }
}

export function useSectionRouter() {
  const [activeSection, setActiveSectionState] = useState<AppSection>(readInitialSection);

  useEffect(() => {
    normalizeCurrentPath(activeSection);

    const syncSectionFromHistory = () => {
      setActiveSectionState(getSectionFromPath(window.location.pathname));
    };

    window.addEventListener("popstate", syncSectionFromHistory);

    return () => window.removeEventListener("popstate", syncSectionFromHistory);
  }, []);

  const setActiveSection = useCallback((section: AppSection) => {
    setActiveSectionState(section);

    if (typeof window === "undefined") {
      return;
    }

    const path = getSectionPath(section);
    const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";

    if (normalizedPath !== path) {
      window.history.pushState({ section }, "", path);
    }
  }, []);

  return { activeSection, setActiveSection };
}
