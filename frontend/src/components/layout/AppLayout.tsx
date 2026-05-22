import type { ReactNode } from "react";

import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";

export function AppLayout({ children }: { children: ReactNode }) {
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
