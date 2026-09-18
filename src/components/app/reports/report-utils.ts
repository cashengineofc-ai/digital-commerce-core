export type ReportPeriod = "today" | "7d" | "30d" | "90d";

export const reportPeriods: Array<{ key: ReportPeriod; label: string; days: number }> = [
  { key: "today", label: "Hoje", days: 1 },
  { key: "7d", label: "7 dias", days: 7 },
  { key: "30d", label: "30 dias", days: 30 },
  { key: "90d", label: "90 dias", days: 90 },
];

function isoDateInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function reportDateRange(
  period: ReportPeriod,
  timeZone = "America/Sao_Paulo",
) {
  const option = reportPeriods.find((item) => item.key === period) ?? reportPeriods[2]!;
  const today = isoDateInZone(new Date(), timeZone);
  const end = new Date(`${today}T12:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (option.days - 1));
  return {
    start: start.toISOString().slice(0, 10),
    end: today,
  };
}

export function safeCsvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const csv = [
    headers.map(safeCsvCell).join(","),
    ...rows.map((row) => row.map(safeCsvCell).join(",")),
  ].join("\n");
  const url = URL.createObjectURL(
    new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export type ReportDefinitions = {
  timezone?: string;
  faturamento_bruto?: string;
  devolucoes?: string;
  faturamento_liquido_devolucoes?: string;
  taxas?: string;
  comissoes?: string;
  resultado_financeiro?: string;
  data_vendas?: string;
  data_financeiro?: string;
  pedido_pendente?: string;
  pagamento_confirmado?: string;
};
