import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/configuracoes/permissoes")({
  head: () => ({
    meta: [
      { title: "Permissões · Cash Engine PRO" },
      { name: "description", content: "Papéis e níveis de acesso." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Permissões" description="Papéis e níveis de acesso." />,
});
