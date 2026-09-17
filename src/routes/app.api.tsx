import { createFileRoute } from "@tanstack/react-router";
import { ApiPage } from "@/components/app/developers/ApiPage";
import { PlatformAdminGuard } from "@/components/app/security/PlatformAdminGuard";

function ProtectedPage() {
  return (
    <PlatformAdminGuard compact>
      <ApiPage />
    </PlatformAdminGuard>
  );
}

export const Route = createFileRoute("/app/api")({
  head: () => ({
    meta: [
      { title: "API · Cash Engine PRO" },
      { name: "description", content: "Chaves de API por ambiente, rotação e exemplos de integração." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProtectedPage,
});
