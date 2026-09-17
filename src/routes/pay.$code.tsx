import { createFileRoute } from "@tanstack/react-router";
import { PublicCheckoutPage } from "@/components/checkout/PublicCheckoutPage";

export const Route = createFileRoute("/pay/$code")({
  component: PaymentLinkRoute,
});

function PaymentLinkRoute() {
  const { code } = Route.useParams();
  return <PublicCheckoutPage source={{ paymentLinkCode: code }} />;
}
