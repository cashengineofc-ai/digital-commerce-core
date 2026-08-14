import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/configuracoes/seguranca")({
  head: () => ({
    meta: [
      { title: "Segurança · Cash Engine PRO" },
      { name: "description", content: "Autenticação em duas etapas e sessões." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Segurança" description="Autenticação em duas etapas e sessões." />,
});
