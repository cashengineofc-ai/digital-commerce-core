import { createFileRoute } from "@tanstack/react-router";
import { AdminSupportPage } from "@/components/app/admin/AdminSupportPage";

export const Route = createFileRoute("/admin/suporte")({
  head: () => ({
    meta: [
      { title: "Suporte · Admin · Cash Engine PRO" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSupportPage,
});
