import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

type Event = { id: string; titulo: string; created_at: string; lida: boolean };

export function RecentActivity() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await (supabase as any).rpc("fn_notificacoes_me", { p_limit: 6, p_offset: 0 });
        if (result.error) throw result.error;
        if (active) setEvents(result.data ?? []);
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, []);
  return <section className="rounded-2xl border border-border bg-card p-6">
    <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Atividade recente</h2></div>
    <p className="mt-1 text-xs text-muted-foreground">Eventos recebidos pela sua conta</p>
    <div className="mt-5 divide-y divide-border">
      {loading ? <Skeleton className="h-36 w-full" /> : error ? <p role="alert" className="py-6 text-sm text-destructive">Não foi possível carregar os eventos.</p> : events.length === 0 ? <p className="py-8 text-sm text-muted-foreground">Nenhuma atividade recebida. Os eventos aparecerão aqui conforme sua operação acontecer.</p> : events.map(event => <div key={event.id} className="flex items-start gap-3 py-4">
        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${event.lida ? "bg-muted-foreground" : "bg-primary"}`} />
        <div><p className="text-sm">{event.titulo}</p><p className="mt-1 text-xs text-muted-foreground">{formatDateTime(event.created_at)}</p></div>
      </div>)}
    </div>
    <Link to="/app/ajuda" preload="intent" className="mt-4 inline-block text-xs text-primary hover:underline">Precisa de ajuda com sua operação?</Link>
  </section>;
}
