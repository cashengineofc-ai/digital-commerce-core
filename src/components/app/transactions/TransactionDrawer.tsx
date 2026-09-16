import { Check, Clock, Copy, Mail, Receipt, User, WalletCards } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/app/dashboard/RecentTransactions";
import type { TransactionView } from "@/components/app/transactions/types";
import { formatBRL, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TransactionDrawer({
  transaction,
  onOpenChange,
}: {
  transaction: TransactionView | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={!!transaction} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-lg">
        {transaction ? <DrawerBody transaction={transaction} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ transaction }: { transaction: TransactionView }) {
  const paid = ["aprovada", "autorizada", "capturada", "paga", "disponivel"].includes(transaction.status);
  const net = transaction.netAmount || Math.max(0, transaction.amount - transaction.processingFee);

  return (
    <div className="flex flex-col">
      <SheetHeader className="space-y-3 border-b border-border px-6 py-5 text-left">
        <div className="flex items-center gap-2">
          <StatusBadge status={transaction.status} />
          <span className="font-mono text-xs text-muted-foreground">{transaction.id}</span>
        </div>
        <SheetTitle className="text-2xl font-semibold tracking-tight tabular-nums">{formatBRL(transaction.amount)}</SheetTitle>
        <SheetDescription>{transaction.product} · {transaction.method} · {formatDateTime(transaction.date)}</SheetDescription>
      </SheetHeader>

      <div className="space-y-6 px-6 py-6">
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Cliente e referência</h3>
          <div className="mt-3 space-y-2 text-sm">
            <Row icon={User} label="Nome" value={transaction.customer} />
            <Row icon={Mail} label="E-mail" value={transaction.customerEmail ?? "Não informado"} />
            <Row icon={Receipt} label="Afiliado" value={transaction.affiliate ?? "Venda direta"} />
            <Row icon={Copy} label="ID interno" value={transaction.dbId} mono />
            <Row icon={WalletCards} label="Gateway" value={transaction.provider ?? "Não informado"} />
            <Row icon={Copy} label="ID no gateway" value={transaction.gatewayId ?? "—"} mono />
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Timeline do pagamento</h3>
          <ol className="mt-4 space-y-0">
            <TimelineItem done label="Transação criada" description="Registro criado na operação" at={transaction.date} last={false} />
            <TimelineItem
              done={paid}
              label={paid ? "Pagamento confirmado" : "Aguardando confirmação"}
              description={transaction.statusDetail ?? (paid ? "Pagamento aprovado pelo provedor" : `Status atual: ${transaction.status}`)}
              at={transaction.paidAt}
              last
            />
          </ol>
        </section>

        <section className="rounded-xl border border-border bg-muted/40 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Valores registrados</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <ValueRow label="Valor bruto" value={transaction.amount} />
            <ValueRow label="Taxa de processamento" value={transaction.processingFee} />
            <ValueRow label="Valor líquido" value={net} strong />
          </ul>
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">Os valores acima vêm diretamente da transação salva no banco. Nenhuma divisão ou comissão é estimada nesta tela.</p>
        </section>
      </div>
    </div>
  );
}

function TimelineItem({ done, label, description, at, last }: { done: boolean; label: string; description: string; at: string | null; last: boolean }) {
  const Icon = done ? Check : Clock;
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last && <span className={cn("absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-px", done ? "bg-success/30" : "bg-border")} />}
      <span className={cn("relative z-[1] mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full", done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground")}> <Icon className="h-3 w-3" /> </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        <p className="mt-1 text-[11px] tabular-nums text-muted-foreground/80">{at ? formatDateTime(at) : "—"}</p>
      </div>
    </li>
  );
}

function ValueRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return <li className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className={cn("tabular-nums text-foreground", strong ? "font-semibold" : "font-medium")}>{formatBRL(value)}</span></li>;
}

function Row({ icon: Icon, label, value, mono }: { icon: React.ElementType; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</span>
      <span className={cn("max-w-[58%] truncate text-right text-foreground", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}
