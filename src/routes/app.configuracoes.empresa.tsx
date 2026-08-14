import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/configuracoes/empresa")({
  head: () => ({
    meta: [
      { title: "Empresa · Cash Engine PRO" },
      { name: "description", content: "Dados cadastrais e documentos da empresa." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Empresa" description="Dados cadastrais e documentos da empresa." />,
});
