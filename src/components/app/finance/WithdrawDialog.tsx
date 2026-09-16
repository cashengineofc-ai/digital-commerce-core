import { useState } from "react";
import { toast } from "sonner";
import { Banknote } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";

type BankAccount = {
  id: string;
  label: string;
};

export function WithdrawDialog({ onSuccess }: { onSuccess?: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [available, setAvailable] = useState(0);
  const [account, setAccount] = useState("");
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const value = Number.isFinite(amount) ? Math.min(Math.max(amount, 0), available) : 0;

  async function loadFinanceData() {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (!profile?.empresa_id) return;

      const [{ data: balance, error: balanceError }, { data: accounts, error: accountsError }] =
        await Promise.all([
          supabase
            .from("saldos")
            .select("saldo_disponivel")
            .eq("empresa_id", profile.empresa_id)
            .maybeSingle(),
          supabase
            .from("contas_bancarias")
            .select("id,banco_nome,agencia,conta,conta_dv,chave_pix,principal")
            .eq("empresa_id", profile.empresa_id)
            .is("deleted_at", null)
            .order("principal", { ascending: false }),
        ]);

      if (balanceError) throw balanceError;
      if (accountsError) throw accountsError;

      const availableValue = Number(balance?.saldo_disponivel ?? 0);
      const mapped = (accounts ?? []).map((item) => ({
        id: item.id,
        label: `${item.banco_nome} · Ag. ${item.agencia} · Conta ${item.conta}${item.conta_dv ? `-${item.conta_dv}` : ""}`,
      }));

      setAvailable(availableValue);
      setAmount(availableValue);
      setBankAccounts(mapped);
      setAccount(mapped[0]?.id ?? "");
    } catch (error) {
      console.error("Falha ao carregar dados para saque", error);
      toast.error("Não foi possível carregar seu saldo e suas contas bancárias.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) await loadFinanceData();
  }

  async function submitWithdrawal() {
    if (!account || value <= 0 || value > available) return;
    setSubmitting(true);
    try {
      const { error } = await (supabase.rpc as any)("fn_solicitar_saque", {
        p_valor: value,
        p_conta_bancaria_id: account,
      });
      if (error) throw error;

      setOpen(false);
      toast.success("Saque solicitado", {
        description: `${formatBRL(value)} foram reservados para processamento.`,
      });
      await onSuccess?.();
    } catch (error: any) {
      console.error("Falha ao solicitar saque", error);
      toast.error("Não foi possível solicitar o saque", {
        description: error?.message ?? "Confira seu saldo e a conta de destino.",
      });
      await loadFinanceData();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90">
          <Banknote className="h-4 w-4" />
          Solicitar saque
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar saque</DialogTitle>
          <DialogDescription>
            Disponível para saque: {loading ? "Carregando..." : formatBRL(available)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Valor do saque</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={value}
              onChange={(e) => setAmount(Number(e.target.value))}
              disabled={loading}
              className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Conta de destino</span>
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              disabled={loading || bankAccounts.length === 0}
              className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/60 disabled:opacity-60"
            >
              {bankAccounts.length === 0 ? (
                <option value="">Nenhuma conta bancária cadastrada</option>
              ) : (
                bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))
              )}
            </select>
          </label>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            O valor será reservado imediatamente. A taxa de saque, quando houver, será calculada no banco conforme o plano e a configuração vigente da operação.
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={submitWithdrawal}
            disabled={loading || submitting || value <= 0 || value > available || !account}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Solicitando..." : "Confirmar saque"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
