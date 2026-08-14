import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/vendas")({
  head: () => ({
    meta: [
      { title: "Vendas · Cash Engine PRO" },
      { name: "description", content: "Acompanhe pedidos, receita e status de cada venda." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Vendas" description="Acompanhe pedidos, receita e status de cada venda." />,
});
