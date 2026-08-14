import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Cash Engine PRO" },
      {
        name: "description",
        content: "Visão geral do volume processado, vendas e aprovação da sua operação.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Dashboard"
      description="Volume processado, vendas, receita e taxa de aprovação em um só lugar. Os indicadores e gráficos chegam na próxima etapa."
    />
  ),
});
