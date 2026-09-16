import { createFileRoute } from "@tanstack/react-router";
import { PublicCheckoutPage } from "@/components/checkout/PublicCheckoutPage";

export const Route = createFileRoute("/checkout/$slug")({
  component: CheckoutRoute,
});

function CheckoutRoute() {
  const { slug } = Route.useParams();
  return <PublicCheckoutPage source={{ checkoutSlug: slug }} />;
}
