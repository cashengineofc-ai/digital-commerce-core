const encoder = new TextEncoder();

function byteLength(value: string) {
  return encoder.encode(value).length;
}

function tlv(id: string, value: string) {
  const length = byteLength(value);
  if (length > 99) throw new Error(`pix_field_too_long:${id}`);
  return `${id}${String(length).padStart(2, "0")}${value}`;
}

function normalizeMerchantText(value: string, maxLength: number) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 $%*+\-./:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.slice(0, maxLength);
}

function crc16CcittFalse(value: string) {
  let crc = 0xffff;
  const bytes = encoder.encode(value);

  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0
        ? ((crc << 1) ^ 0x1021) & 0xffff
        : (crc << 1) & 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function normalizePixTxid(value: string) {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 25);
  if (!normalized) throw new Error("pix_txid_invalid");
  return normalized;
}

export function buildStaticPixPayload({
  key,
  receiverName,
  receiverCity,
  amount,
  txid,
}: {
  key: string;
  receiverName: string;
  receiverCity: string;
  amount: number;
  txid: string;
}) {
  const normalizedKey = key.trim();
  const merchantName = normalizeMerchantText(receiverName, 25);
  const merchantCity = normalizeMerchantText(receiverCity, 15);
  const normalizedTxid = normalizePixTxid(txid);

  if (!normalizedKey || byteLength(normalizedKey) > 77) {
    throw new Error("pix_key_invalid");
  }
  if (!merchantName || !merchantCity) {
    throw new Error("pix_receiver_invalid");
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount >= 10000000000) {
    throw new Error("pix_amount_invalid");
  }

  const merchantAccount = tlv("00", "BR.GOV.BCB.PIX") + tlv("01", normalizedKey);
  const additionalData = tlv("05", normalizedTxid);
  const amountText = amount.toFixed(2);

  const withoutCrc = [
    tlv("00", "01"),
    tlv("26", merchantAccount),
    tlv("52", "0000"),
    tlv("53", "986"),
    tlv("54", amountText),
    tlv("58", "BR"),
    tlv("59", merchantName),
    tlv("60", merchantCity),
    tlv("62", additionalData),
    "6304",
  ].join("");

  return `${withoutCrc}${crc16CcittFalse(withoutCrc)}`;
}
