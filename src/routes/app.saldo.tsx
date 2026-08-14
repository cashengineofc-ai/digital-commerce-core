import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/saldo")({
  head: () => ({
    meta: [
      { title: "Saldo · Cash Engine PRO" },
      { name: "description", content: "Saldo disponível, pendente e reservado." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Saldo" description="Saldo disponível, pendente e reservado." />,
});
