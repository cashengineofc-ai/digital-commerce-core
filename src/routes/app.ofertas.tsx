import { createFileRoute } from "@tanstack/react-router";
import { OffersPage } from "@/components/app/products/OffersPage";

export const Route = createFileRoute("/app/ofertas")({
  head: () => ({
    meta: [
      { title: "Ofertas · Cash Engine PRO" },
      { name: "description", content: "Condições comerciais vinculadas aos produtos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OffersPage,
});
