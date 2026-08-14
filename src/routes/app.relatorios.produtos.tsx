import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/relatorios/produtos")({
  head: () => ({
    meta: [
      { title: "Relatório de produtos · Cash Engine PRO" },
      { name: "description", content: "Produtos mais vendidos e ticket médio." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Relatório de produtos" description="Produtos mais vendidos e ticket médio." />,
});
