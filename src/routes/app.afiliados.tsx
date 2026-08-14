import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/afiliados")({
  head: () => ({
    meta: [
      { title: "Afiliados · Cash Engine PRO" },
      { name: "description", content: "Gestão da rede de afiliados e aprovações." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Afiliados" description="Gestão da rede de afiliados e aprovações." />,
});
