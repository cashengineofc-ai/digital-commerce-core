import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/api")({
  head: () => ({
    meta: [
      { title: "API · Cash Engine PRO" },
      { name: "description", content: "Chaves de API, ambientes e documentação." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="API" description="Chaves de API, ambientes e documentação." />,
});
