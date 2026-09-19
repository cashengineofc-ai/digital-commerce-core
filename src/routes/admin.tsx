import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShellProvider, useAppShell } from "@/components/app/app-shell-context";
import {
  DesktopSidebar,
  MobileSidebar,
} from "@/components/app/admin/AdminSidebar";
import { Bell, HelpCircle, Lock, Menu, Search } from "lucide-react";
import { useTempAuth } from "@/lib/auth-temp";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformAdminGuard } from "@/components/app/security/PlatformAdminGuard";
import { supabase } from "@/integrations/supabase/client";

type AdminSearchResult = {
  tipo: "empresa" | "usuario" | "pedido";
  id: string;
  titulo: string;
  subtitulo: string | null;
  destino: "/admin/empresas" | "/admin/usuarios" | "/admin/financeiro";
};

function AdminGlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    let active = true;
    setSearchError(null);
    setResults([]);
    if (normalized.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const { data, error } = await (supabase as any).rpc("fn_admin_pesquisa_global", {
          p_query: normalized,
          p_limit: 12,
        });
        if (!active) return;
        if (error) throw error;
        setResults((data ?? []) as AdminSearchResult[]);
      } catch {
        if (active) {
          setSearchError(
            "Não foi possível consultar a busca. Verifique a conexão e a configuração do banco.",
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="relative ml-4 hidden min-w-0 flex-1 md:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        type="search"
        aria-label="Buscar empresas, usuários ou pedidos"
        placeholder="Buscar empresa, usuário ou pedido..."
        className="h-9 w-full max-w-md rounded-md border border-border bg-card pl-9 pr-14 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-destructive focus:ring-2 focus:ring-destructive/15"
      />
      <kbd className="pointer-events-none absolute left-[23.5rem] top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:block">
        ⌘K
      </kbd>
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute z-50 mt-2 w-full max-w-xl overflow-hidden rounded-md border border-border bg-card shadow-lg">
          {searchError ? (
            <p role="alert" className="px-3 py-3 text-sm text-destructive">
              {searchError}
            </p>
          ) : isLoading ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Buscando dados reais...</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Nenhum resultado encontrado.</p>
          ) : (
            results.map((result) => (
              <Link
                key={`${result.tipo}-${result.id}`}
                to={result.destino}
                preload="intent"
                onClick={() => setIsOpen(false)}
                className="block border-b border-border/70 px-3 py-2.5 last:border-0 hover:bg-muted"
              >
                <p className="text-sm font-medium text-foreground">{result.titulo}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {result.tipo} · {result.subtitulo || "Sem detalhes adicionais"}
                </p>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AdminTopbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-destructive/30 bg-destructive/5 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Abrir menu"
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-destructive-foreground">
            <Lock className="h-3 w-3" />
            Admin Global
          </span>
        </div>

        <AdminGlobalSearch />

        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/admin/comunicados"
            preload="intent"
            aria-label="Notificações"
            className="relative rounded-md border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
          </Link>

          <Link
            to="/admin/suporte"
            preload="intent"
            aria-label="Ajuda"
            className="rounded-md border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <HelpCircle className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function AdminShellInner() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isAuthed, isLoading } = useTempAuth();
  const { setRole } = useAppShell();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthed) {
      navigate({ to: "/login", replace: true }).catch(() => {});
    }
  }, [isAuthed, isLoading, navigate]);

  useEffect(() => {
    if (user?.role) {
      setRole(user.role);
    }
  }, [user?.role, setRole]);

  if (isLoading) {
    return (
      <div className="app-light min-h-screen bg-background text-foreground antialiased">
        <div className="hidden w-64 lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:flex-col lg:border-r lg:border-border lg:bg-card">
          <Skeleton className="mx-4 my-5 h-8 w-40" />
          <div className="flex-1 space-y-6 px-3 pb-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="mx-3 h-8" />
            ))}
          </div>
          <Skeleton className="m-3 h-16" />
        </div>
        <div className="lg:pl-64">
          <Skeleton className="h-16 w-full border-b border-border" />
          <main className="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
            <Skeleton className="h-10 w-1/3" />
            <div className="grid gap-4 md:grid-cols-3">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
            <Skeleton className="h-80" />
          </main>
        </div>
      </div>
    );
  }

  if (!isAuthed) {
    return null;
  }

  return (
    <div className="app-light ce-workspace min-h-screen bg-background text-foreground antialiased">
      <DesktopSidebar />
      <MobileSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="lg:pl-64">
        <AdminTopbar onOpenMenu={() => setMenuOpen(true)} />
        <main className="min-w-0 px-2 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6 xl:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function AdminShell() {
  return (
    <PlatformAdminGuard>
      <AdminShellInner />
    </PlatformAdminGuard>
  );
}

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Global · Cash Engine PRO" },
      {
        name: "description",
        content: "Painel administrativo global da Cash Engine PRO.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <AppShellProvider>
      <AdminShell />
    </AppShellProvider>
  );
}
