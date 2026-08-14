import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes · Cash Engine PRO" },
      { name: "description", content: "Base de clientes, histórico de compras e contatos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Clientes" description="Base de clientes, histórico de compras e contatos." />,
});
