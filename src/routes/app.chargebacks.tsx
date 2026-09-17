import { createFileRoute } from "@tanstack/react-router";
import { RefundsPage } from "@/components/app/finance/RefundsPage";

export const Route = createFileRoute("/app/chargebacks")({
  head: () => ({
    meta: [
      { title: "Estornos e contestações · Cash Engine PRO" },
      {
        name: "description",
        content: "Área unificada de reembolsos, ocorrências Pix e chargebacks reais.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RefundsPage,
});
