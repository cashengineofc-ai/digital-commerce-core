import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/links-de-pagamento")({
  head: () => ({
    meta: [
      { title: "Links de pagamento · Cash Engine PRO" },
      { name: "description", content: "Links avulsos para cobrar em qualquer canal." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Links de pagamento" description="Links avulsos para cobrar em qualquer canal." />,
});
