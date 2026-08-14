import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/repasses")({
  head: () => ({
    meta: [
      { title: "Repasses · Cash Engine PRO" },
      { name: "description", content: "Repasses automáticos para produtores e afiliados." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Repasses" description="Repasses automáticos para produtores e afiliados." />,
});
