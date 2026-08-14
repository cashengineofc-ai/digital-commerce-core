import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/taxas")({
  head: () => ({
    meta: [
      { title: "Taxas · Cash Engine PRO" },
      { name: "description", content: "Taxas por método de pagamento e antecipação." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Taxas" description="Taxas por método de pagamento e antecipação." />,
});
