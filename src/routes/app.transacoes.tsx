import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/transacoes")({
  head: () => ({
    meta: [
      { title: "Transações · Cash Engine PRO" },
      { name: "description", content: "Todas as transações da sua operação, com filtros e detalhe por pagamento." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Transações" description="Todas as transações da sua operação, com filtros e detalhe por pagamento." />,
});
