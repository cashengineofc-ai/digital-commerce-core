import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Eye, EyeOff, KeyRound, RefreshCcw, Webhook } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { apiKeys, curlSample, maskKey, type ApiKey } from "@/lib/mock/developers";
import { formatDateTime } from "@/lib/format";
import { CardsSkeleton, useFakeLoading } from "@/components/app/Skeletons";
import { cn } from "@/lib/utils";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          /* clipboard indisponível no preview */
        }
        setCopied(true);
        toast.success(`${label} copiada`);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:bg-muted"
      aria-label={`Copiar ${label}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function KeyRow({ apiKey }: { apiKey: ApiKey }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">{apiKey.label}</p>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              apiKey.kind === "secreta"
                ? "bg-amber-500/10 text-amber-700"
                : "bg-muted text-muted-foreground",
            )}
          >
            {apiKey.kind}
          </span>
        </div>
        <button
          onClick={() => toast.success("Chave rotacionada", { description: "A chave anterior expira em 24 horas." })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Rotacionar
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-foreground">
          {visible ? apiKey.value : maskKey(apiKey.value)}
        </code>
        <button
          onClick={() => setVisible((v) => !v)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:bg-muted"
          aria-label={visible ? "Ocultar chave" : "Mostrar chave"}
        >
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
        <CopyButton value={apiKey.value} label="Chave" />
      </div>

      <p className="mt-2.5 text-[11px] text-muted-foreground">
        Criada em {formatDateTime(apiKey.createdAt)}
        {apiKey.lastUsed ? ` · último uso ${formatDateTime(apiKey.lastUsed)}` : " · nunca usada"}
      </p>
    </div>
  );
}

export function ApiPage() {
  const loading = useFakeLoading();
  const [env, setEnv] = useState<"teste" | "producao">("teste");
  const keys = apiKeys.filter((k) => k.env === env);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">API</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chaves de acesso, ambientes e exemplos de integração.
          </p>
        </div>
        <div className="flex gap-1.5 rounded-lg border border-border bg-card p-1 shadow-sm">
          {(["teste", "producao"] as const).map((e) => (
            <button
              key={e}
              onClick={() => setEnv(e)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition",
                env === e ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {e === "teste" ? "Teste" : "Produção"}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {loading ? <CardsSkeleton count={2} /> : keys.map((k) => <KeyRow key={k.id} apiKey={k} />)}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Webhook className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Webhooks</p>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Receba eventos de pagamento, split e estorno em tempo real no seu servidor.
            </p>
            <Link
              to="/app/webhooks"
              className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
            >
              Configurar endpoints
            </Link>
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Criar uma cobrança</p>
            <CopyButton value={curlSample} label="Requisição" />
          </header>
          <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {curlSample}
          </pre>
        </section>
      </div>
    </div>
  );
}
