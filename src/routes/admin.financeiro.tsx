import { createFileRoute } from "@tanstack/react-router";
import { AdminFinancePage } from "@/components/app/admin/AdminFinancePage";

export const Route = createFileRoute("/admin/financeiro")({
  head: () => ({
    meta: [
      { title: "Operações financeiras · Admin Global · Cash Engine PRO" },
      {
        name: "description",
        content: "Análise e conciliação administrativa de saques e estornos.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminFinancePage,
});
