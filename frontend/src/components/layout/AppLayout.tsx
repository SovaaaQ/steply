import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { useAppData } from "../../app/providers";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";

export function AppLayout({ children }: { children: ReactNode }) {
  const { activeSection } = useAppData();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const resetScroll = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(resetScroll);
  }, [activeSection]);

  return (
    <main className="app-shell">
      <Sidebar />
      <section className="app-main" ref={mainRef}>
        <Header />
        {children}
      </section>
      <MobileNav />
    </main>
  );
}
