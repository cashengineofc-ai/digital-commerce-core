import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos · Cash Engine PRO" },
      { name: "description", content: "Catálogo de produtos, preços e regras de comissão." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Produtos" description="Catálogo de produtos, preços e regras de comissão." />,
});
