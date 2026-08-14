import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/configuracoes/integracoes")({
  head: () => ({
    meta: [
      { title: "Integrações · Cash Engine PRO" },
      { name: "description", content: "Conecte ferramentas externas à sua operação." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Integrações" description="Conecte ferramentas externas à sua operação." />,
});
