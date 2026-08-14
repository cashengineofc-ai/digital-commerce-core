import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/app/links")({
  head: () => ({
    meta: [
      { title: "Links · Cash Engine PRO" },
      { name: "description", content: "Links de afiliação e rastreio de origem." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Links" description="Links de afiliação e rastreio de origem." />,
});
