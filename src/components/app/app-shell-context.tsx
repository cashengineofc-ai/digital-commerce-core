import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type PeriodKey = "hoje" | "7d" | "30d" | "90d" | "12m";
export type RoleKey = "super-admin" | "produtor" | "afiliado";

export const periods: { key: PeriodKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "12m", label: "12 meses" },
];

export const roles: { key: RoleKey; label: string; description: string }[] = [
  { key: "super-admin", label: "Super Admin", description: "Visão global da plataforma" },
  { key: "produtor", label: "Produtor", description: "Vendas, produtos e carteira" },
  { key: "afiliado", label: "Afiliado", description: "Comissões e marketplace" },
];

type AppShellState = {
  period: PeriodKey;
  setPeriod: (p: PeriodKey) => void;
  role: RoleKey;
  setRole: (r: RoleKey) => void;
};

const AppShellContext = createContext<AppShellState | null>(null);

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [role, setRole] = useState<RoleKey>("super-admin");

  const value = useMemo(() => ({ period, setPeriod, role, setRole }), [period, role]);

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell() {
  const ctx = useContext(AppShellContext);
  if (!ctx) throw new Error("useAppShell precisa estar dentro de AppShellProvider");
  return ctx;
}

export function periodLabel(key: PeriodKey) {
  return periods.find((p) => p.key === key)?.label ?? "30 dias";
}
