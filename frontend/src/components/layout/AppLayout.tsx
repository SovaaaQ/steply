import { useLayoutEffect } from "react";
import type { ReactNode } from "react";

import { useAppData } from "../../app/providers";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";

export function AppLayout({ children }: { children: ReactNode }) {
  const { activeSection } = useAppData();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeSection]);

  return (
    <main className="app-shell">
      <Sidebar />
      <section className="app-main">
        <Header />
        {children}
      </section>
      <MobileNav />
    </main>
  );
}
