import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/relatorios/financeiro")({
  head: () => ({
    meta: [
      { title: "Relatório financeiro · Cash Engine PRO" },
      { name: "description", content: "Receita, taxas e liquidações consolidadas." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Relatório financeiro" description="Receita, taxas e liquidações consolidadas." />,
});
