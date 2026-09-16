// Disabled until signature validation and the payment processor are implemented
// and tested together. Never accept unverified events or report them as processed.
Deno.serve((request) => {
  const status = request.method === "POST" ? 503 : 405;
  return new Response(JSON.stringify({
    error: status === 503 ? "payment_webhook_not_ready" : "method_not_allowed",
  }), {
    status,
    headers: { "content-type": "application/json", "retry-after": "300" },
  });
});
