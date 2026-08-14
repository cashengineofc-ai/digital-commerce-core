import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/logs")({
  head: () => ({
    meta: [
      { title: "Logs · Cash Engine PRO" },
      { name: "description", content: "Auditoria de ações e eventos da plataforma." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Logs" description="Auditoria de ações e eventos da plataforma." />,
});
