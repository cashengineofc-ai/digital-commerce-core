import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace · Cash Engine PRO" },
      { name: "description", content: "Vitrine de produtos disponíveis para afiliação." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Marketplace" description="Vitrine de produtos disponíveis para afiliação." />,
});
