import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/r/$code")({
  component: AffiliateRedirectPage,
});

function getFingerprint() {
  const key = "ce-affiliate-fingerprint";
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function AffiliateRedirectPage() {
  const { code } = Route.useParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function resolve() {
      try {
        const { data, error: rpcError } = await (supabase as any).rpc(
          "fn_afiliado_link_resolver",
          {
            p_code: code,
            p_fingerprint: getFingerprint(),
            p_referrer: document.referrer || null,
          },
        );
        if (rpcError) throw rpcError;

        const destination = String(data?.destination ?? "");
        const affiliateCode = String(data?.affiliate_code ?? code);

        if (!destination.startsWith("/") || destination.startsWith("//")) {
          throw new Error("Destino do link inválido.");
        }

        const url = new URL(destination, window.location.origin);
        url.searchParams.set("ref", affiliateCode);
        window.location.replace(url.toString());
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Este link de afiliado não está disponível.",
          );
        }
      }
    }

    void resolve();
    return () => {
      active = false;
    };
  }, [code]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <div className="max-w-md text-center">
        {error ? (
          <>
            <h1 className="text-xl font-semibold">Link indisponível</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">
              Validando origem e abrindo a página de compra...
            </p>
          </>
        )}
      </div>
    </main>
  );
}
