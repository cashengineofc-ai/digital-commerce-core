import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/configuracoes/conta")({
  head: () => ({
    meta: [
      { title: "Conta · Cash Engine PRO" },
      { name: "description", content: "Dados pessoais, preferências e notificações." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Conta" description="Dados pessoais, preferências e notificações." />,
});
