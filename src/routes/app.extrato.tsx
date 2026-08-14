import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/extrato")({
  head: () => ({
    meta: [
      { title: "Extrato · Cash Engine PRO" },
      { name: "description", content: "Entradas, saídas e taxas da sua carteira." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Extrato" description="Entradas, saídas e taxas da sua carteira." />,
});
