import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/checkouts")({
  head: () => ({
    meta: [
      { title: "Checkouts · Cash Engine PRO" },
      { name: "description", content: "Checkouts publicados, conversão e personalização." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Checkouts" description="Checkouts publicados, conversão e personalização." />,
});
