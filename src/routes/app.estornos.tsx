import { createFileRoute } from "@tanstack/react-router";
import { RefundsPage } from "@/components/app/finance/RefundsPage";

export const Route = createFileRoute("/app/estornos")({
  head: () => ({
    meta: [
      { title: "Estornos e contestações · Cash Engine PRO" },
      { name: "description", content: "Reembolsos, ocorrências Pix e chargebacks reais em uma única área." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <RefundsPage />,
});
