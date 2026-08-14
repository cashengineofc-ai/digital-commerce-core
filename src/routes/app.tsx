import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { AppShellProvider } from "@/components/app/app-shell-context";
import { DesktopSidebar, MobileSidebar } from "@/components/app/Sidebar";
import { Topbar } from "@/components/app/Topbar";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Plataforma · Cash Engine PRO" },
      {
        name: "description",
        content: "Central operacional da sua infraestrutura de pagamentos.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppLayout,
});

function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <AppShellProvider>
      <div className="app-light min-h-screen bg-background text-foreground antialiased">
        <DesktopSidebar />
        <MobileSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="lg:pl-64">
          <Topbar onOpenMenu={() => setMenuOpen(true)} />
          <main className="px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </AppShellProvider>
  );
}
