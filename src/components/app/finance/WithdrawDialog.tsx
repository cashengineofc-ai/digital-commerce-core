import { useRef, useState } from "react";
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
import { useTempAuth } from "@/lib/auth-temp";
import { formatBRL } from "@/lib/format";

type BankAccount = { id: string; label: string };

export function WithdrawDialog({ onSuccess }: { onSuccess?: () => void | Promise<void> }) {
  const { user } = useTempAuth();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [available, setAvailable] = useState(0);
  const [account, setAccount] = useState("");
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const requestKey = useRef(crypto.randomUUID());

  async function loadFinanceData() {
    setLoading(true);
    try {
      if (!user?.empresaId) throw new Error("Empresa não identificada.");

      const [{ data: balanceData, error: balanceError }, { data: bankData, error: bankError }] =
        await Promise.all([
          (supabase as any).rpc("fn_financeiro_saldo", { p_entidade: "empresa" }),
          supabase
            .from("contas_bancarias")
            .select("id,banco_nome,agencia,conta,conta_dv,chave_pix,principal")
            .eq("empresa_id", user.empresaId)
            .is("deleted_at", null)
            .order("principal", { ascending: false }),
        ]);

      if (balanceError) throw balanceError;
      if (bankError) throw bankError;

      const balance = Array.isArray(balanceData) ? balanceData[0] : balanceData;
      const availableValue = Number(balance?.disponivel ?? 0);
      const mapped = (bankData ?? []).map((item) => ({
        id: item.id,
        label: item.chave_pix
          ? `${item.banco_nome} · Pix ${item.chave_pix}`
          : `${item.banco_nome} · Ag. ${item.agencia} · Conta ${item.conta}${item.conta_dv ? `-${item.conta_dv}` : ""}`,
      }));

      setAvailable(availableValue);
      setAmount(availableValue);
      setAccounts(mapped);
      setAccount(mapped[0]?.id ?? "");
    } catch (cause) {
      toast.error("Não foi possível carregar o saque", {
        description: cause instanceof Error ? cause.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      requestKey.current = crypto.randomUUID();
      await loadFinanceData();
    }
  }

  async function submitWithdrawal() {
    const value = Number(amount);
    if (!account || !Number.isFinite(value) || value <= 0 || value > available) return;

    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any).rpc("fn_solicitar_saque_v2", {
        p_valor: value,
        p_conta_bancaria_id: account,
        p_idempotency_key: requestKey.current,
        p_entidade: "empresa",
      });
      if (error) throw error;
      if (!data) throw new Error("O banco não confirmou a solicitação.");

      setOpen(false);
      toast.success("Saque solicitado", {
        description: `${formatBRL(value)} foram reservados. Aprovação não significa pagamento; a liquidação será registrada somente após conciliação.`,
      });
      await onSuccess?.();
    } catch (cause) {
      toast.error("Não foi possível solicitar o saque", {
        description: cause instanceof Error ? cause.message : undefined,
      });
      await loadFinanceData();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
          <Banknote className="h-4 w-4" /> Solicitar saque
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar saque</DialogTitle>
          <DialogDescription>
            Disponível: {loading ? "Carregando..." : formatBRL(available)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Valor</span>
            <input
              type="number"
              min={0.01}
              max={available}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              disabled={loading}
              className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Conta de destino</span>
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              disabled={loading || accounts.length === 0}
              className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            >
              {accounts.length === 0 ? (
                <option value="">Nenhuma conta cadastrada</option>
              ) : accounts.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            O destino será congelado no pedido de saque. O valor será reservado de forma atômica para impedir saques concorrentes acima do saldo.
          </div>
        </div>

        <DialogFooter>
          <button onClick={() => setOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium">Cancelar</button>
          <button
            onClick={() => void submitWithdrawal()}
            disabled={loading || submitting || amount <= 0 || amount > available || !account}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "Solicitando..." : "Confirmar saque"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
