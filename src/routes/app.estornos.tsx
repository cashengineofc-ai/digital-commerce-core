import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/estornos")({
  head: () => ({
    meta: [
      { title: "Estornos · Cash Engine PRO" },
      { name: "description", content: "Estornos solicitados e processados." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Estornos" description="Estornos solicitados e processados." />,
});
