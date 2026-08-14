import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/configuracoes/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe · Cash Engine PRO" },
      { name: "description", content: "Membros da equipe e convites." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Equipe" description="Membros da equipe e convites." />,
});
