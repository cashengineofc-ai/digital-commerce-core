import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/relatorios/afiliados")({
  head: () => ({
    meta: [
      { title: "Relatório de afiliados · Cash Engine PRO" },
      { name: "description", content: "Ranking de afiliados e comissões geradas." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Relatório de afiliados" description="Ranking de afiliados e comissões geradas." />,
});
