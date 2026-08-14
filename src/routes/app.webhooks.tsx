import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/webhooks")({
  head: () => ({
    meta: [
      { title: "Webhooks · Cash Engine PRO" },
      { name: "description", content: "Endpoints, eventos e tentativas de entrega." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Webhooks" description="Endpoints, eventos e tentativas de entrega." />,
});
