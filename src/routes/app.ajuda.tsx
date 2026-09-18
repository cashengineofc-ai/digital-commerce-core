import { createFileRoute } from "@tanstack/react-router";
import { HelpCenterPage } from "@/components/app/help/HelpCenterPage";

export const Route = createFileRoute("/app/ajuda")({
  head: () => ({
    meta: [
      { title: "Central de Ajuda · Cash Engine PRO" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HelpCenterPage,
});
