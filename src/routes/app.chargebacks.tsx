import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/chargebacks")({
  head: () => ({
    meta: [
      { title: "Chargebacks · Cash Engine PRO" },
      { name: "description", content: "Contestações, prazos e defesa de chargebacks." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Chargebacks" description="Contestações, prazos e defesa de chargebacks." />,
});
