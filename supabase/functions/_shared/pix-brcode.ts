export type StaticPixPayloadInput = {
  key: string;
  receiverName: string;
  receiverCity: string;
  amount?: number | null;
  txid?: string | null;
};

const encoder = new TextEncoder();

function byteLength(value: string) {
  return encoder.encode(value).length;
}

function emv(id: string, value: string) {
  const length = byteLength(value);
  if (id.length !== 2 || length > 99) throw new Error("invalid_emv_field");
  return `${id}${String(length).padStart(2, "0")}${value}`;
}

export function normalizePixText(value: string, maxLength: number) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 $%*+\-./:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function normalizePixTxid(value?: string | null) {
  if (!value) return "***";
  const normalized = value.replace(/[^A-Za-z0-9]/g, "").slice(0, 25);
  return normalized || "***";
}

export function crc16Ccitt(payloadWithCrcHeader: string) {
  let crc = 0xffff;
  for (const byte of encoder.encode(payloadWithCrcHeader)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildStaticPixPayload(input: StaticPixPayloadInput) {
  const key = input.key.trim();
  if (!key || byteLength(key) > 77) throw new Error("invalid_pix_key");
  const receiverName = normalizePixText(input.receiverName, 25);
  const receiverCity = normalizePixText(input.receiverCity, 15);
  if (!receiverName || !receiverCity) throw new Error("invalid_pix_receiver");
  const amount = input.amount == null ? null : Number(input.amount);
  if (amount != null && (!Number.isFinite(amount) || amount <= 0)) throw new Error("invalid_pix_amount");

  const merchantAccount = emv("00", "br.gov.bcb.pix") + emv("01", key);
  const additionalData = emv("05", normalizePixTxid(input.txid));
  let payload = emv("00", "01") + emv("26", merchantAccount) + emv("52", "0000") + emv("53", "986");
  if (amount != null) payload += emv("54", amount.toFixed(2));
  payload += emv("58", "BR") + emv("59", receiverName) + emv("60", receiverCity) + emv("62", additionalData);
  const withCrcHeader = `${payload}6304`;
  return `${withCrcHeader}${crc16Ccitt(withCrcHeader)}`;
}
