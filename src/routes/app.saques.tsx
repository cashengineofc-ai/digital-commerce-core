import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/saques")({
  head: () => ({
    meta: [
      { title: "Saques · Cash Engine PRO" },
      { name: "description", content: "Solicitações de saque e status de liquidação." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Saques" description="Solicitações de saque e status de liquidação." />,
});
