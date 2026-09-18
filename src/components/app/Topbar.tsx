import { useState } from "react";
import { ChevronDown, HelpCircle, Menu, ShieldCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { periods, roles, useAppShell, periodLabel } from "./app-shell-context";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/app/GlobalSearch";
import { NotificationsMenu } from "@/components/app/NotificationsMenu";

function Dropdown({
  label,
  children,
  align = "right",
}: {
  label: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
      >
        {label}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "absolute z-40 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-sm",
                align === "right" ? "right-0" : "left-0",
              )}
            >
              {children(() => setOpen(false))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { period, setPeriod, role } = useAppShell();
  const activeRole = roles.find((r) => r.key === role);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Abrir menu"
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden min-w-0 flex-1 md:block">
          <GlobalSearch />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span
            title="Papel obtido do backend"
            className="hidden items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground sm:inline-flex"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {activeRole?.label ?? "Conta autenticada"}
          </span>

          <Dropdown label={periodLabel(period)}>
            {(close) => (
              <>
                {periods.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      setPeriod(p.key);
                      close();
                    }}
                    className={cn(
                      "flex w-full items-center rounded-md px-2 py-2 text-left text-[13px] transition-colors hover:bg-muted",
                      p.key === period ? "font-medium text-primary" : "text-foreground",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </>
            )}
          </Dropdown>

          <NotificationsMenu />

          <Link
            to="/app/ajuda"
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
