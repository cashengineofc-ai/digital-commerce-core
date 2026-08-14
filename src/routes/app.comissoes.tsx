import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/comissoes")({
  head: () => ({
    meta: [
      { title: "Comissões · Cash Engine PRO" },
      { name: "description", content: "Comissões geradas, pagas e a pagar." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Comissões" description="Comissões geradas, pagas e a pagar." />,
});
