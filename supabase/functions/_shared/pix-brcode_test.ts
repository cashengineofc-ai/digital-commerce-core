import { buildStaticPixPayload, normalizePixTxid } from "./pix-brcode.ts";

function assertEquals<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

Deno.test("normalizePixTxid keeps only uppercase alphanumeric characters", () => {
  assertEquals(normalizePixTxid("ab-c 123!"), "ABC123", "normalized txid");
});

Deno.test("buildStaticPixPayload emits deterministic BR Code with valid CRC", () => {
  const payload = buildStaticPixPayload({
    key: "pix@example.invalid",
    receiverName: "Cash Engine",
    receiverCity: "Curitiba",
    amount: 47,
    txid: "ABC123",
  });

  assertEquals(
    payload,
    "00020126410014BR.GOV.BCB.PIX0119pix@example.invalid520400005303986540547.005802BR5911CASH ENGINE6008CURITIBA62100506ABC1236304B251",
    "Pix BR Code payload",
  );
  assertEquals(payload.slice(-4), "B251", "CRC16-CCITT-FALSE");
});
